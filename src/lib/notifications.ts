/**
 * Push notifications.
 *
 * Behaviour by environment:
 *   - Expo Go (SDK 53+): expo-notifications is stubbed by Expo. We skip
 *     entirely (no token, no foreground handler) so we don't spam the
 *     console with "removed in Expo Go" warnings.
 *   - Development build / TestFlight / installed APK: full functionality.
 *     Token is registered, foreground handler shows banners, push pipeline
 *     calls the `notify` Edge Function which dispatches to Expo Push.
 *
 * Diagnostics:
 *   `registerForPushNotifications` returns a structured result so the UI
 *   (Settings → Notifications "Test push" button) can show users WHY push
 *   isn't working on their device. We used to swallow every failure with a
 *   bare `try/catch {}` which is exactly why the production build had zero
 *   tokens saved for weeks: every error was invisible.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { UserSettings } from '@/types';

// expo-notifications is removed from Expo Go in SDK 53 — skip loading entirely
// to avoid console.error spam.
const isExpoGo = Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationsLoad: Promise<NotificationsModule | null> | null = null;

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (notificationsModule) return notificationsModule;
  if (!notificationsLoad) {
    notificationsLoad = import('expo-notifications')
      .then((mod) => {
        notificationsModule = mod;
        mod.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        return mod;
      })
      .catch(() => null);
  }
  const mod = await notificationsLoad;
  notificationsModule = mod;
  return mod;
}

// ── Android notification channels ────────────────────────────────────────────
//
// Channels MUST be created before the first notification of that channelId is
// delivered, otherwise Android falls back to the default channel — which on
// some OEMs is muted by default. That's the second-most-common reason "no
// sound on Android" reports happen, after missing FCM credentials.
async function setupAndroidChannels(n: NotificationsModule) {
  try {
    await n.setNotificationChannelAsync('message', {
      name: 'New Messages',
      importance: n.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 100, 200],
      enableVibrate: true,
      lightColor: '#0E9F6E',
    });
    await n.setNotificationChannelAsync('like', {
      name: 'Likes',
      importance: n.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 100],
      enableVibrate: true,
      lightColor: '#FF6B6B',
    });
    await n.setNotificationChannelAsync('match', {
      name: 'Matches 🔥',
      importance: n.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      enableVibrate: true,
      lightColor: '#0E9F6E',
    });
    await n.setNotificationChannelAsync('view', {
      name: 'Profile Views',
      importance: n.AndroidImportance.LOW,
      vibrationPattern: [],
      lightColor: '#0E9F6E',
    });
    await n.setNotificationChannelAsync('favourite', {
      name: 'Stars',
      importance: n.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 120],
      enableVibrate: true,
      lightColor: '#F6C458',
    });
  } catch (e) {
    console.warn('[notifications] Android channel setup failed', e);
  }
}

/**
 * Result of attempting to register the device for push.
 *
 * Call sites log failures instead of swallowing errors — that visibility is
 * how we avoid silent "zero push tokens saved" production regressions.
 */
export type PushRegistrationResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason:
        | 'expo_go'
        | 'permission_denied'
        | 'no_project_id'
        | 'token_failed'
        | 'upsert_failed'
        | 'unsupported';
      detail?: string;
    };

// ── Register device + save push token ────────────────────────────────────────
export async function registerForPushNotifications(
  userId: string,
): Promise<PushRegistrationResult> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    // Either Expo Go or environment without expo-notifications.
    return { ok: false, reason: isExpoGo ? 'expo_go' : 'unsupported' };
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { ok: false, reason: 'permission_denied' };
    }

    if (Platform.OS === 'android') await setupAndroidChannels(Notifications);

    const projectId =
      (
        Constants as unknown as {
          expoConfig?: { extra?: { eas?: { projectId?: string } } };
          easConfig?: { projectId?: string };
        }
      ).expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      // Without an EAS projectId, getExpoPushTokenAsync silently returns the
      // wrong token (or throws on newer SDKs). Surface this loudly.
      return {
        ok: false,
        reason: 'no_project_id',
        detail: 'expo.extra.eas.projectId is missing in app.json',
      };
    }

    let token: string;
    try {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      token = data;
    } catch (err) {
      // Most common cause on Android: FCM v1 service account JSON not
      // uploaded to the Expo project (https://docs.expo.dev/push-notifications/fcm-credentials/).
      // Most common cause on iOS: APNs key not configured during `eas build`.
      // The original error message is verbose but helpful — surface it.
      return {
        ok: false,
        reason: 'token_failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, push_token: token }, { onConflict: 'user_id' });

    if (upsertError) {
      return { ok: false, reason: 'upsert_failed', detail: upsertError.message };
    }

    return { ok: true, token };
  } catch (err) {
    // Truly unexpected — log it instead of swallowing.
    const detail = err instanceof Error ? err.message : String(err);
    console.warn('[push] registerForPushNotifications unexpected error:', detail);
    return { ok: false, reason: 'unsupported', detail };
  }
}

/** Whether to show haptic + local notification for an incoming message (mirrors `notify` Edge Function rules). */
export function allowIncomingMessageNotificationCue(
  settings: Pick<UserSettings, 'receive_messages' | 'notify_messages'> | null | undefined,
): boolean {
  if (settings?.receive_messages === false) return false;
  if (settings?.notify_messages === false) return false;
  return true;
}

// ── Local notification (foreground ping for incoming messages) ─────────────
//
// When Realtime delivers a message while the user is on the main tabs (not in
// that chat), we ping locally — push may be late or unavailable. Honours the
// same prefs as the `notify` Edge Function via `allowIncomingMessageNotificationCue`.
export async function sendLocalNotification(
  title: string,
  body: string,
  channelId: 'message' | 'like' | 'match' | 'view' | 'favourite' = 'match',
  data?: Record<string, string>,
): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[notifications] sendLocalNotification failed', e);
  }
}

// ── Call Edge Function to push-notify another user ───────────────────────────
export type ActivityNotificationType = 'message' | 'like' | 'match' | 'view' | 'favourite';

export type LifecycleEmailCampaign =
  | 'welcome'
  | 'first_message'
  | 'first_like'
  | 'away_7d'
  | 'away_14d'
  | 'away_30d';

const queuedLifecycleEmails = new Set<string>();

export async function notifyUser(params: {
  type: ActivityNotificationType;
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}): Promise<void> {
  try {
    // `invoke` attaches the session JWT; Edge Function verifies senderId === caller.
    await supabase.functions.invoke('notify', { body: params });
  } catch {
    // Non-critical — best effort
  }
}

export async function notifyLifecycleEmail(params: {
  campaign: LifecycleEmailCampaign;
  recipientId: string;
  senderName?: string | null;
  extra?: Record<string, string>;
}): Promise<void> {
  try {
    await supabase.functions.invoke('notify', {
      body: {
        kind: 'campaign',
        campaign: params.campaign,
        recipientId: params.recipientId,
        senderName: params.senderName ?? null,
        extra: params.extra,
      },
    });
  } catch {
    // Non-critical — best effort
  }
}

export function queueWelcomeEmail(recipientId: string): void {
  const key = `welcome:${recipientId}`;
  if (queuedLifecycleEmails.has(key)) return;
  queuedLifecycleEmails.add(key);
  void notifyLifecycleEmail({ campaign: 'welcome', recipientId });
}

export function resetLifecycleEmailQueue(): void {
  queuedLifecycleEmails.clear();
}

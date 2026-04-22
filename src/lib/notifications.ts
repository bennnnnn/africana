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

// expo-notifications is removed from Expo Go in SDK 53 — skip loading entirely
// to avoid console.error spam.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    const loadedNotifications = require('expo-notifications') as typeof import('expo-notifications');
    Notifications = loadedNotifications;

    // Foreground notification display: when a push arrives while the app is
    // open we still want a banner + sound + badge update. Without this the OS
    // suppresses the notification UI entirely (the user just sees nothing).
    loadedNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Unsupported environment — continue silently
  }
}

// ── Android notification channels ────────────────────────────────────────────
//
// Channels MUST be created before the first notification of that channelId is
// delivered, otherwise Android falls back to the default channel — which on
// some OEMs is muted by default. That's the second-most-common reason "no
// sound on Android" reports happen, after missing FCM credentials.
async function setupAndroidChannels() {
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('message', {
      name: 'New Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 100, 200],
      enableVibrate: true,
      lightColor: '#C84B31',
    });
    await Notifications.setNotificationChannelAsync('like', {
      name: 'Likes',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 100],
      enableVibrate: true,
      lightColor: '#FF6B6B',
    });
    await Notifications.setNotificationChannelAsync('match', {
      name: 'Matches 🔥',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      enableVibrate: true,
      lightColor: '#C84B31',
    });
    await Notifications.setNotificationChannelAsync('view', {
      name: 'Profile Views',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      lightColor: '#C84B31',
    });
    await Notifications.setNotificationChannelAsync('favourite', {
      name: 'Stars',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 120],
      enableVibrate: true,
      lightColor: '#F6C458',
    });
  } catch {}
}

/**
 * Result of attempting to register the device for push.
 *
 * The Settings screen surfaces this so users can self-diagnose. The previous
 * implementation was a `Promise<void>` with `try/catch {}` swallowing
 * everything — which is exactly how the production build ended up with zero
 * tokens saved across every signup.
 */
export type PushRegistrationResult =
  | { ok: true;  token: string }
  | { ok: false; reason: 'expo_go' | 'permission_denied' | 'no_project_id' | 'token_failed' | 'upsert_failed' | 'unsupported'; detail?: string };

// ── Register device + save push token ────────────────────────────────────────
export async function registerForPushNotifications(userId: string): Promise<PushRegistrationResult> {
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

    if (Platform.OS === 'android') await setupAndroidChannels();

    const projectId =
      (Constants as unknown as {
        expoConfig?: { extra?: { eas?: { projectId?: string } } };
        easConfig?: { projectId?: string };
      }).expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      // Without an EAS projectId, getExpoPushTokenAsync silently returns the
      // wrong token (or throws on newer SDKs). Surface this loudly.
      return { ok: false, reason: 'no_project_id', detail: 'expo.extra.eas.projectId is missing in app.json' };
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
      return { ok: false, reason: 'token_failed', detail: err instanceof Error ? err.message : String(err) };
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

// ── Local notification (foreground ping for incoming messages, etc.) ─────────
//
// Used in two places:
//   1. Match celebration after `MatchModal` is dismissed (channelId: 'match').
//   2. Foreground "ping" when a realtime INSERT delivers a message AND the
//      user is on the inbox or another chat — the OS push from the Edge
//      Function might arrive late or not at all (if FCM/APNs aren't
//      configured yet), so this is the only reliable in-app cue.
export async function sendLocalNotification(
  title: string,
  body: string,
  channelId: 'message' | 'like' | 'match' | 'view' | 'favourite' = 'match',
  data?: Record<string, string>,
): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data, ...(Platform.OS === 'android' ? { channelId } : {}) },
      trigger: null,
    });
  } catch {}
}

// ── Call Edge Function to push-notify another user ───────────────────────────
export async function notifyUser(params: {
  type: 'message' | 'like' | 'match' | 'view' | 'favourite';
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}): Promise<void> {
  try {
    // Use functions.invoke so the SDK attaches BOTH the user JWT (Authorization)
    // and the project apikey header — bare fetch was missing apikey, which is
    // why every notify call was returning 401 at the gateway.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.functions.invoke('notify', { body: params });
  } catch {
    // Non-critical — best effort
  }
}

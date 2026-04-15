/**
 * Push notifications — gracefully disabled in Expo Go (SDK 53+).
 * Fully functional in development builds and production builds.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// expo-notifications removed from Expo Go in SDK 53 — skip loading entirely to avoid console.error spam
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    const loadedNotifications = require('expo-notifications') as typeof import('expo-notifications');
    Notifications = loadedNotifications;

    // Configure foreground notification display (only when available)
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

// ── Android notification channels ─────────────────────────────────────────────
async function setupAndroidChannels() {
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('message', {
      name: 'New Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#C84B31',
    });
    await Notifications.setNotificationChannelAsync('like', {
      name: 'Likes',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 100],
      lightColor: '#FF6B6B',
    });
    await Notifications.setNotificationChannelAsync('match', {
      name: 'Matches 🔥',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      lightColor: '#C84B31',
    });
    await Notifications.setNotificationChannelAsync('view', {
      name: 'Profile Views',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      lightColor: '#8B5E3C',
    });
  } catch {}
}

// ── Register device + save push token ─────────────────────────────────────────
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Notifications) return; // Expo Go — skip silently
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') await setupAndroidChannels();

    const projectId =
      (Constants as unknown as {
        expoConfig?: { extra?: { eas?: { projectId?: string } } };
        easConfig?: { projectId?: string };
      }).expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await supabase
      .from('user_settings')
      .upsert({ user_id: userId, push_token: token }, { onConflict: 'user_id' });
  } catch {
    // Simulator / permission denied / Expo Go — ignore
  }
}

// ── Local notification (match celebration etc.) ────────────────────────────────
export async function sendLocalNotification(
  title: string,
  body: string,
  channelId: 'message' | 'like' | 'match' | 'view' = 'match',
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

// ── Call Edge Function to push-notify another user ────────────────────────────
export async function notifyUser(params: {
  type: 'message' | 'like' | 'match' | 'view';
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}): Promise<void> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${supabaseUrl}/functions/v1/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-critical — best effort
  }
}

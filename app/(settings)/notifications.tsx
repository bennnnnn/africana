import React, { useCallback, useState } from 'react';
import { Text, ScrollView, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingRow,
  settingsStyles,
} from '@/components/settings/settings-shared';
import {
  registerForPushNotifications,
  sendLocalNotification,
  type PushRegistrationResult,
} from '@/lib/notifications';
import { COLORS, RADIUS } from '@/constants';
import type { UserSettings } from '@/types';

/** Friendly explainer for the diagnostic banner. */
function describeRegistrationResult(r: PushRegistrationResult): { title: string; body: string; tone: 'ok' | 'warn' | 'error' } {
  if (r.ok) {
    return {
      tone: 'ok',
      title: 'Push is set up correctly',
      body: 'You should hear a sound and feel a vibration when a message arrives. A test notification was just sent — check your notification shade.',
    };
  }
  switch (r.reason) {
    case 'expo_go':
      return {
        tone: 'warn',
        title: 'Push is disabled in Expo Go',
        body: 'Push notifications were removed from Expo Go in SDK 53. Test on a development build, TestFlight, or installed APK to hear sounds.',
      };
    case 'permission_denied':
      return {
        tone: 'error',
        title: 'Notifications are turned off in your phone settings',
        body: 'Open your phone\u2019s system Settings \u2192 Africana \u2192 Notifications and turn them on, then come back and tap "Test push" again.',
      };
    case 'no_project_id':
      return {
        tone: 'error',
        title: 'App is missing the Expo project id',
        body: r.detail ?? 'Add expo.extra.eas.projectId to app.json and rebuild.',
      };
    case 'token_failed':
      return {
        tone: 'error',
        title: 'Couldn\u2019t get a push token from Expo',
        body: `${r.detail ?? 'Unknown error.'}\n\nMost common cause: the FCM v1 service account JSON (Android) or the APNs key (iOS) hasn\u2019t been uploaded to your Expo project yet. See https://docs.expo.dev/push-notifications/fcm-credentials/`,
      };
    case 'upsert_failed':
      return {
        tone: 'error',
        title: 'Got a token but couldn\u2019t save it',
        body: r.detail ?? 'The user_settings table rejected the push_token write.',
      };
    case 'unsupported':
    default:
      return {
        tone: 'error',
        title: 'Push isn\u2019t supported on this device',
        body: r.detail ?? 'expo-notifications failed to load on this build.',
      };
  }
}

export default function NotificationsSettingsScreen() {
  const { user, settings, updateSettings } = useAuthStore();
  const { showToast } = useDialog();

  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<PushRegistrationResult | null>(null);

  const applySettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      const r = await updateSettings(updates);
      if (!r.ok) {
        showToast({ message: r.message, icon: 'alert-circle-outline' });
      }
    },
    [showToast, updateSettings],
  );

  const notifyToggle =
    (key: 'notify_messages' | 'notify_likes' | 'notify_matches' | 'notify_views') => async (v: boolean) => {
      const r = await updateSettings({ [key]: v } as Partial<UserSettings>);
      if (!r.ok) {
        showToast({ message: r.message, icon: 'alert-circle-outline' });
        return;
      }
      if (v && user?.id) void registerForPushNotifications(user.id);
    };

  const runDiagnostic = useCallback(async () => {
    if (!user?.id) return;
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const result = await registerForPushNotifications(user.id);
      setDiagResult(result);
      if (result.ok) {
        // Fire a local notification so they hear the channel sound + see a
        // banner. This is the same code path that fires when a message
        // arrives in the foreground — confirms the channel is configured.
        await sendLocalNotification(
          '\ud83d\udcac Test message',
          'If you can hear this and see this banner, push is working on your device.',
          'message',
        );
      }
    } finally {
      setDiagnosing(false);
    }
  }, [user?.id]);

  const summary = diagResult ? describeRegistrationResult(diagResult) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Notifications" titleAlign="leading" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
        <Text style={settingsStyles.screenIntro}>
          Choose what you want to hear about. Allow notifications for Africana in your phone settings if alerts are quiet.
        </Text>
        <>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            iconColor="#3B82F6"
            label="Messages"
            description="New messages from people you chat with"
            value={settings?.notify_messages ?? true}
            onToggle={notifyToggle('notify_messages')}
          />
          <SettingRow
            icon="heart-outline"
            iconColor="#EF4444"
            label="Likes"
            description="Someone likes your profile"
            value={settings?.notify_likes ?? true}
            onToggle={notifyToggle('notify_likes')}
          />
          <SettingRow
            icon="flame-outline"
            iconColor={COLORS.primary}
            label="Matches"
            description="You and someone else like each other"
            value={settings?.notify_matches ?? true}
            onToggle={notifyToggle('notify_matches')}
          />
          <SettingRow
            icon="eye-outline"
            iconColor={COLORS.earth}
            label="Profile views"
            description="Someone opens your profile"
            value={settings?.notify_views ?? false}
            onToggle={notifyToggle('notify_views')}
          />
          <SettingRow
            icon="mail-outline"
            iconColor={COLORS.textSecondary}
            label="Email updates"
            description="Occasional emails for likes and matches (not every message)"
            value={settings?.email_notifications ?? true}
            onToggle={(v) => applySettings({ email_notifications: v })}
            isLast
          />
        </>

        {/* Diagnostic — answers "why don't I hear a sound?" without a back-and-forth. */}
        <View style={{ marginTop: 24 }}>
          <Text style={[settingsStyles.screenIntro, { marginBottom: 8 }]}>
            Not hearing a sound? Tap below to test push delivery on this device.
          </Text>
          <TouchableOpacity
            onPress={runDiagnostic}
            disabled={diagnosing || !user?.id}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: COLORS.primary,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: RADIUS.lg,
              opacity: diagnosing ? 0.7 : 1,
            }}
          >
            {diagnosing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {diagnosing ? 'Testing\u2026' : 'Test push notification'}
            </Text>
          </TouchableOpacity>

          {summary ? (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor:
                  summary.tone === 'ok' ? COLORS.success
                  : summary.tone === 'warn' ? COLORS.warning
                  : '#EF4444',
                backgroundColor:
                  summary.tone === 'ok' ? COLORS.successSurface
                  : summary.tone === 'warn' ? COLORS.savanna
                  : 'rgba(239, 68, 68, 0.08)',
              }}
            >
              <Text style={{ fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
                {summary.title}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 }}>
                {summary.body}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

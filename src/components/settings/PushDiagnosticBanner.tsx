import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  registerForPushNotifications,
  sendLocalNotification,
  type PushRegistrationResult,
} from '@/lib/notifications';
import { COLORS, RADIUS } from '@/constants';
import { settingsStyles } from '@/components/settings/settings-shared';

export function describeRegistrationResult(
  r: PushRegistrationResult,
): { title: string; body: string; tone: 'ok' | 'warn' | 'error' } {
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

export function PushDiagnosticBanner({ userId }: { userId: string | undefined }) {
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<PushRegistrationResult | null>(null);

  const runDiagnostic = useCallback(async () => {
    if (!userId) return;
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const result = await registerForPushNotifications(userId);
      setDiagResult(result);
      if (result.ok) {
        await sendLocalNotification(
          '\ud83d\udcac Test message',
          'If you can hear this and see this banner, push is working on your device.',
          'message',
        );
      }
    } finally {
      setDiagnosing(false);
    }
  }, [userId]);

  const summary = diagResult ? describeRegistrationResult(diagResult) : null;

  return (
    <View style={styles.wrap}>
      <Text style={[settingsStyles.screenIntro, styles.introTight]}>
        Not hearing a sound? Tap below to test push delivery on this device.
      </Text>
      <TouchableOpacity
        onPress={runDiagnostic}
        disabled={diagnosing || !userId}
        activeOpacity={0.8}
        style={[styles.testBtn, diagnosing && styles.testBtnBusy]}
        accessibilityRole="button"
        accessibilityLabel="Test push notification"
        accessibilityState={{ disabled: diagnosing || !userId }}
      >
        {diagnosing ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <Ionicons name="notifications-outline" size={18} color={COLORS.white} />
        )}
        <Text style={styles.testBtnText}>{diagnosing ? 'Testing\u2026' : 'Test push notification'}</Text>
      </TouchableOpacity>

      {summary ? (
        <View
          style={[
            styles.banner,
            summary.tone === 'ok' && styles.bannerOk,
            summary.tone === 'warn' && styles.bannerWarn,
            summary.tone === 'error' && styles.bannerErr,
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.bannerTitle}>{summary.title}</Text>
          <Text style={styles.bannerBody}>{summary.body}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
  },
  introTight: {
    marginBottom: 8,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
  },
  testBtnBusy: {
    opacity: 0.7,
  },
  testBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  banner: {
    marginTop: 12,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  bannerOk: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successSurface,
  },
  bannerWarn: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.savanna,
  },
  bannerErr: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorSurface,
  },
  bannerTitle: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  bannerBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});

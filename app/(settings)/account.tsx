import React, { useCallback, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingRow,
  settingsStyles,
} from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';
import { exportAndShareUserData } from '@/lib/data-export';

const appVersion =
  (Constants.expoConfig?.version as string | undefined) ??
  (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } })?.extra?.expoClient?.version ??
  '1.0.0';

export default function AccountSettingsScreen() {
  const { signOut } = useAuthStore();
  const { showDialog, showToast } = useDialog();
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportAndShareUserData();
      if (result.ok) {
        showToast({
          message: 'Data export ready — pick a destination',
          icon: 'cloud-download-outline',
        });
        return;
      }
      if (result.reason === 'share_cancelled') {
        return;
      }
      showDialog({
        title: 'Could not export data',
        message:
          result.reason === 'unauthenticated'
            ? 'You are signed out. Please sign back in and try again.'
            : 'Something went wrong preparing your data. Please try again in a moment.',
        icon: 'alert-circle-outline',
        actions: [{ label: 'OK', style: 'primary' }],
      });
    } finally {
      setExporting(false);
    }
  }, [exporting, showDialog, showToast]);

  const handleSignOut = useCallback(() => {
    showDialog({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      icon: 'log-out-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await signOut();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    });
  }, [showDialog, signOut]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Account" titleAlign="leading" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
        <Text style={settingsStyles.screenIntro}>
          App info, sign out, and permanently deleting your account.
        </Text>
        <>
          <SettingRow
            icon="information-circle-outline"
            iconColor={COLORS.earth}
            label="About"
            description={`Version ${appVersion}`}
            onPress={() =>
              showDialog({
                title: `Africana v${appVersion}`,
                message:
                  'A dating app built for Africans and the African diaspora — connecting hearts across the world.',
                icon: 'information-circle-outline',
                actions: [{ label: 'Close', style: 'primary' }],
              })
            }
          />
          <SettingRow
            icon="cloud-download-outline"
            iconColor="#3B82F6"
            label="Download my data"
            description="Export your profile, likes, messages, and more as JSON"
            onPress={() => void handleExport()}
            showArrow={false}
            disabled={exporting}
          />
          <SettingRow
            icon="log-out-outline"
            iconColor={COLORS.textSecondary}
            label="Sign Out"
            onPress={handleSignOut}
            showArrow={false}
            disabled={busy}
          />
          <SettingRow
            icon="trash-outline"
            label="Delete account"
            description="Remove your profile and data for good"
            onPress={() => router.push('/(settings)/delete-account')}
            showArrow={false}
            danger
            isLast
          />
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useCallback, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { SettingRow, settingsStyles } from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';
import { UI_LABELS, UI_TOAST } from '@/constants/copy';
import { exportAndShareUserData } from '@/lib/data-export';

const appVersion =
  (Constants.expoConfig?.version as string | undefined) ??
  (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } })?.extra?.expoClient
    ?.version ??
  '1.0.0';

export default function AccountSettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
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
          message: UI_TOAST.exportReady,
          icon: 'cloud-download-outline',
        });
        return;
      }
      if (result.reason === 'share_cancelled') {
        return;
      }
      showToast({
        message:
          result.reason === 'unauthenticated' ? UI_TOAST.sessionExpired : UI_TOAST.exportFailed,
        icon: 'alert-circle-outline',
      });
    } finally {
      setExporting(false);
    }
  }, [exporting, showToast]);

  const handleSignOut = useCallback(() => {
    showDialog({
      title: 'Sign out',
      message: 'Sign out of your account?',
      icon: 'log-out-outline',
      actions: [
        { label: UI_LABELS.cancel, style: 'cancel' },
        {
          label: UI_LABELS.signOut,
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settingsStyles.scrollContent}
      >
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
                message: 'Africana connects Africans and the African diaspora around the world.',
                icon: 'information-circle-outline',
                actions: [{ label: UI_LABELS.ok, style: 'primary' }],
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
            danger
            isLast
          />
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useCallback } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { SettingRow, settingsStyles } from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';
import type { UserSettings } from '@/types';
import { isProSync } from '@/lib/payments';
import { showProGateDialog } from '@/lib/pro-gate';

export default function PrivacySettingsScreen() {
  const { settings, updateSettings } = useAuthStore(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings })),
  );
  const { showToast } = useDialog();

  const applySettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      const r = await updateSettings(updates);
      if (!r.ok) {
        showToast({ message: r.message, icon: 'alert-circle-outline' });
      }
    },
    [showToast, updateSettings],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Privacy" titleAlign="leading" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settingsStyles.scrollContent}
      >
        <Text style={settingsStyles.screenIntro}>
          Control who can reach you and who sees you in Discover.
        </Text>
        <>
          <SettingRow
            icon="chatbubble-outline"
            iconColor={COLORS.success}
            label="Messages"
            description="Turn off to pause incoming and outgoing messages"
            value={settings?.receive_messages ?? true}
            onToggle={(v) => applySettings({ receive_messages: v })}
          />
          <SettingRow
            icon="eye-outline"
            iconColor={COLORS.earth}
            label="Show my profile"
            description="Appear in Discover and Online. Hiding requires Pro."
            value={settings?.profile_visible ?? true}
            onToggle={(v) => {
              // Free users can turn visibility back ON, but hiding (turning it OFF)
              // is a Pro-only feature. Pro check is currently a no-op while
              // PAYMENTS_ENABLED = false; treat everyone as Free.
              const isHiding = v === false;
              if (isHiding && !isProSync()) {
                showProGateDialog({
                  title: 'Hiding your profile is a Pro feature',
                  message: 'Disappear from Discover with Africana Pro.',
                });
                return;
              }
              void applySettings({ profile_visible: v });
            }}
          />
          <SettingRow
            icon="eye-off-outline"
            iconColor={COLORS.earth}
            label="Incognito browsing"
            description="Browse profiles without showing up in their Views. Pro only."
            value={settings?.incognito ?? false}
            onToggle={(v) => {
              const isTurningOn = v === true;
              if (isTurningOn && !isProSync()) {
                showProGateDialog({
                  title: 'Incognito browsing is a Pro feature',
                  message: 'Browse profiles silently with Africana Pro.',
                });
                return;
              }
              void applySettings({ incognito: v });
            }}
          />
          <SettingRow
            icon="ban-outline"
            iconColor={COLORS.warning}
            label="Blocked people"
            description="Unblock or review who you’ve blocked"
            onPress={() => router.push('/(settings)/blocked')}
            isLast
          />
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

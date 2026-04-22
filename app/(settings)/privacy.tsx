import React, { useCallback } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingRow,
  settingsStyles,
} from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';
import type { UserSettings } from '@/types';

export default function PrivacySettingsScreen() {
  const { settings, updateSettings } = useAuthStore();
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
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
            description="Appear in Discover and Online. Chats you already have stay open"
            value={settings?.profile_visible ?? true}
            onToggle={(v) => applySettings({ profile_visible: v })}
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

import React, { useCallback, useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingRow,
  settingsStyles,
  SettingsSectionHeader,
} from '@/components/settings/settings-shared';
import { registerForPushNotifications } from '@/lib/notifications';
import { COLORS } from '@/constants';
import type { UserSettings } from '@/types';

export default function NotificationsSettingsScreen() {
  const { user, settings, updateSettings } = useAuthStore(
    useShallow((s) => ({ user: s.user, settings: s.settings, updateSettings: s.updateSettings })),
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

  const notifyToggle =
    (key: 'notify_messages' | 'notify_likes' | 'notify_matches' | 'notify_views') =>
    async (v: boolean) => {
      const r = await updateSettings({ [key]: v } as Partial<UserSettings>);
      if (!r.ok) {
        showToast({ message: r.message, icon: 'alert-circle-outline' });
        return;
      }
      if (v && user?.id) void registerForPushNotifications(user.id);
    };

  // Keep device token + Android channels fresh when user opens this screen
  // (replaces the removed diagnostic "Test push" path for permission/token recovery).
  useEffect(() => {
    if (!user?.id) return;
    void registerForPushNotifications(user.id).then((r) => {
      if (!r.ok && r.reason !== 'expo_go') {
        console.warn('[push] register on notifications screen:', r.reason, r.detail ?? '');
      }
    });
  }, [user?.id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Notifications" titleAlign="leading" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settingsStyles.scrollContent}
      >
        <SettingsSectionHeader label="What to notify" first />
        <View style={settingsStyles.sectionBlock}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            iconColor={COLORS.notificationsAccent}
            label="Messages"
            description="New messages from people you chat with"
            value={settings?.notify_messages ?? true}
            onToggle={notifyToggle('notify_messages')}
          />
          <SettingRow
            icon="heart-outline"
            iconColor={COLORS.error}
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
            description="Likes, matches, stars, and occasional we-miss-you notes (push stays primary)"
            value={settings?.email_notifications ?? true}
            onToggle={(v) => applySettings({ email_notifications: v })}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

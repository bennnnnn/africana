import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { COLORS, FONT } from '@/constants';
import { registerForPushNotifications } from '@/lib/notifications';
import type { UserSettings } from '@/types';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function SettingRow({
  icon,
  iconColor,
  label,
  description,
  value,
  onToggle,
  onPress,
  showArrow = true,
  danger = false,
}: SettingRowProps) {
  const iconTint = danger ? COLORS.error : (iconColor ?? COLORS.primary);
  const iconBg = danger ? '#FEE2E2' : `${iconColor ?? COLORS.primary}18`;

  const iconBox = (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: iconBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={iconTint} />
    </View>
  );

  const labelBlock = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: FONT.md, fontWeight: FONT.medium, color: danger ? COLORS.error : COLORS.text }}>
        {label}
      </Text>
      {description ? (
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1, lineHeight: 16 }}>{description}</Text>
      ) : null}
    </View>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  };

  if (onToggle !== undefined) {
    const a11yLabel = [label, description].filter(Boolean).join('. ');
    const current = value ?? false;
    return (
      <View style={rowStyle} accessibilityRole="none">
        <Pressable
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
          onPress={() => onToggle(!current)}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ checked: current }}
        >
          {iconBox}
          {labelBlock}
        </Pressable>
        <Switch
          value={current}
          onValueChange={onToggle}
          trackColor={{ true: COLORS.primary }}
          thumbColor="#FFFFFF"
          accessibilityLabel={label}
        />
      </View>
    );
  }

  const navA11y = [label, description].filter(Boolean).join('. ');
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={rowStyle}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={onPress ? navA11y : undefined}
    >
      {iconBox}
      {labelBlock}
      {showArrow ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} /> : null}
    </TouchableOpacity>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {label}
    </Text>
  );
}

export default function SettingsScreen() {
  const { user, settings, updateSettings, signOut } = useAuthStore();
  const { showDialog, showToast } = useDialog();

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

  const handleSignOut = () => {
    showDialog({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      actions: [
        { label: 'Cancel' },
        { label: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ],
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Settings" titleAlign="leading" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionHeader label="Privacy" />
        <View style={{ backgroundColor: COLORS.white }}>
          <SettingRow
            icon="chatbubble-outline"
            iconColor={COLORS.success}
            label="Messages"
            description="Turn off to pause incoming and outgoing messages"
            value={settings?.receive_messages ?? true}
            onToggle={(v) => applySettings({ receive_messages: v })}
          />
          <SettingRow
            icon="radio-outline"
            iconColor={COLORS.online}
            label="Online status"
            description="Show as online when you’re using the app"
            value={settings?.show_online_status ?? true}
            onToggle={(v) => applySettings({ show_online_status: v })}
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
          />
        </View>

        <SectionHeader label="Notifications" />
        <Text
          style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            paddingHorizontal: 16,
            paddingBottom: 8,
            lineHeight: 17,
          }}
        >
          Choose what you want to hear about. Allow notifications for Africana in your phone settings if alerts are quiet.
        </Text>
        <View style={{ backgroundColor: COLORS.white }}>
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
          />
        </View>

        <SectionHeader label="Premium & trust" />
        <View style={{ backgroundColor: COLORS.white }}>
          <SettingRow
            icon="sparkles-outline"
            iconColor={COLORS.primary}
            label="Go Premium"
            description="Unlock more visibility and features"
            onPress={() => router.push('/(settings)/upgrade')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            iconColor={COLORS.success}
            label="Profile verification"
            description="Submit a selfie for a verified badge"
            onPress={() => router.push('/(settings)/verify')}
          />
        </View>

        <SectionHeader label="Legal" />
        <View style={{ backgroundColor: COLORS.white }}>
          <SettingRow
            icon="document-text-outline"
            iconColor={COLORS.earth}
            label="Privacy & terms"
            description="Policies for using Africana"
            onPress={() => router.push('/(settings)/legal')}
          />
        </View>

        <SectionHeader label="Account" />
        <View style={{ backgroundColor: COLORS.white }}>
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
                actions: [{ label: 'Close' }],
              })
            }
          />
          <SettingRow
            icon="log-out-outline"
            iconColor={COLORS.textSecondary}
            label="Sign Out"
            onPress={handleSignOut}
            showArrow={false}
          />
          <SettingRow
            icon="trash-outline"
            label="Delete account"
            description="Remove your profile and data for good"
            onPress={() => router.push('/(settings)/delete-account')}
            showArrow={false}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

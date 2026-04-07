import React, { useState } from 'react';
import {
  View,
  Text,

  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, APP_NAME } from '@/constants';

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

function SettingRow({ icon, iconColor, label, description, value, onToggle, onPress, showArrow = true, danger = false }: SettingRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && onToggle === undefined}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: danger ? '#FEE2E2' : `${iconColor ?? COLORS.primary}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={danger ? COLORS.error : (iconColor ?? COLORS.primary)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: danger ? COLORS.error : COLORS.text }}>
          {label}
        </Text>
        {description && (
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1, lineHeight: 16 }}>
            {description}
          </Text>
        )}
      </View>
      {onToggle !== undefined ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ true: COLORS.primary }}
          thumbColor="#FFFFFF"
        />
      ) : showArrow ? (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      ) : null}
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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => router.push('/(settings)/delete-account'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <SectionHeader label="Profile" />
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 0 }}>
          <SettingRow
            icon="person-outline"
            label="Edit Profile"
            description="Update your name, bio, photos"
            onPress={() => router.push('/(profile)/edit')}
          />
          <SettingRow
            icon="images-outline"
            label="Manage Photos"
            description={`${user?.profile_photos.length ?? 0} photos uploaded`}
            onPress={() => router.push('/(profile)/photos')}
          />
        </View>

        {/* Privacy */}
        <SectionHeader label="Privacy & Safety" />
        <View style={{ backgroundColor: '#FFFFFF' }}>
          <SettingRow
            icon="chatbubble-outline"
            iconColor={COLORS.success}
            label="Receive Messages"
            description="Allow other members to message you"
            value={settings?.receive_messages ?? true}
            onToggle={(v) => updateSettings({ receive_messages: v })}
          />
          <SettingRow
            icon="radio-outline"
            iconColor={COLORS.online}
            label="Show Online Status"
            description="Let others see when you're online"
            value={settings?.show_online_status ?? true}
            onToggle={(v) => updateSettings({ show_online_status: v })}
          />
          <SettingRow
            icon="eye-outline"
            iconColor={COLORS.earth}
            label="Profile Visible"
            description="Allow your profile to appear in discover"
            value={settings?.profile_visible ?? true}
            onToggle={(v) => updateSettings({ profile_visible: v })}
          />
          <SettingRow
            icon="ban-outline"
            iconColor={COLORS.warning}
            label="Blocked Users"
            description="Manage people you've blocked"
            onPress={() => router.push('/(settings)/blocked')}
          />
        </View>

        {/* Notifications */}
        <SectionHeader label="Notifications" />
        <View style={{ backgroundColor: '#FFFFFF' }}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            iconColor="#3B82F6"
            label="New Messages"
            description="Notify when someone messages you"
            value={settings?.notify_messages ?? true}
            onToggle={(v) => updateSettings({ notify_messages: v })}
          />
          <SettingRow
            icon="heart-outline"
            iconColor="#EF4444"
            label="New Likes"
            description="Notify when someone likes your profile"
            value={settings?.notify_likes ?? true}
            onToggle={(v) => updateSettings({ notify_likes: v })}
          />
          <SettingRow
            icon="flame-outline"
            iconColor={COLORS.primary}
            label="Matches"
            description="Notify when you get a mutual match"
            value={settings?.notify_matches ?? true}
            onToggle={(v) => updateSettings({ notify_matches: v })}
          />
          <SettingRow
            icon="eye-outline"
            iconColor={COLORS.earth}
            label="Profile Views"
            description="Notify when someone views your profile"
            value={settings?.notify_views ?? false}
            onToggle={(v) => updateSettings({ notify_views: v })}
          />
          <SettingRow
            icon="mail-outline"
            iconColor={COLORS.textSecondary}
            label="Email Notifications"
            description="Receive re-engagement emails"
            value={settings?.email_notifications ?? true}
            onToggle={(v) => updateSettings({ email_notifications: v })}
          />
        </View>

        {/* Legal */}
        <SectionHeader label="Legal" />
        <View style={{ backgroundColor: '#FFFFFF' }}>
          <SettingRow
            icon="document-text-outline"
            iconColor={COLORS.earth}
            label="Privacy Policy & Terms"
            description="Read our privacy policy and terms of service"
            onPress={() => router.push('/(settings)/legal')}
          />
        </View>

        {/* Account */}
        <SectionHeader label="Account" />
        <View style={{ backgroundColor: '#FFFFFF' }}>
          <SettingRow
            icon="information-circle-outline"
            iconColor={COLORS.earth}
            label="About Africana"
            description="Version 1.0.0"
            onPress={() => Alert.alert(
              'Africana v1.0.0',
              'Africana is a dating app built for Africans and the African diaspora — connecting hearts across the world.\n\nBuilt with ❤️ for the culture.',
              [{ text: 'Close', style: 'cancel' }],
            )}
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
            label="Delete Account"
            description="Permanently delete your account"
            onPress={handleDeleteAccount}
            showArrow={false}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

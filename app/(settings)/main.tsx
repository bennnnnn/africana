import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingsHubRow,
  settingsStyles,
} from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Settings" titleAlign="leading" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
        <Text style={settingsStyles.screenIntro}>
          Manage privacy, alerts, premium options, and your account — each section opens its own screen.
        </Text>
          <SettingsHubRow
            icon="lock-closed-outline"
            iconColor={COLORS.earth}
            label="Privacy"
            description="Messages, online status, visibility, blocked people"
            onPress={() => router.push('/(settings)/privacy')}
          />
          <SettingsHubRow
            icon="notifications-outline"
            iconColor="#3B82F6"
            label="Notifications"
            description="Push and email for messages, likes, matches, and views"
            onPress={() => router.push('/(settings)/notifications')}
          />
          <SettingsHubRow
            icon="sparkles-outline"
            iconColor={COLORS.primary}
            label="Premium & trust"
            description="Upgrade and profile verification"
            onPress={() => router.push('/(settings)/premium-trust')}
          />
          <SettingsHubRow
            icon="shield-checkmark-outline"
            iconColor={COLORS.success}
            label="Stay safe"
            description="Dating-safety tips and what to do if something feels off"
            onPress={() => router.push('/(settings)/safety')}
          />
          <SettingsHubRow
            icon="document-text-outline"
            iconColor={COLORS.earth}
            label="Legal"
            description="Privacy policy and terms of use"
            onPress={() => router.push('/(settings)/legal')}
          />
          <SettingsHubRow
            icon="person-circle-outline"
            iconColor={COLORS.textSecondary}
            label="Account"
            description="About, sign out, delete account"
            onPress={() => router.push('/(settings)/account')}
            isLast
          />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

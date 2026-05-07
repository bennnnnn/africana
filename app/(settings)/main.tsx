import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { SettingsHubRow, settingsStyles } from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Settings" titleAlign="leading" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
        <Text style={settingsStyles.screenIntro}>
          Manage privacy, alerts, premium options, and your account.
        </Text>
        <SettingsHubRow
          icon="lock-closed-outline"
          iconColor={COLORS.earth}
          label="Privacy"
          onPress={() => router.push('/(settings)/privacy')}
        />
        <SettingsHubRow
          icon="notifications-outline"
          iconColor={COLORS.notificationsAccent}
          label="Notifications"
          onPress={() => router.push('/(settings)/notifications')}
        />
        <SettingsHubRow
          icon="sparkles-outline"
          iconColor={COLORS.primary}
          label="Premium & trust"
          onPress={() => router.push('/(settings)/premium-trust')}
        />
        <SettingsHubRow
          icon="shield-checkmark-outline"
          iconColor={COLORS.success}
          label="Stay safe"
          onPress={() => router.push('/(settings)/safety')}
        />
        <SettingsHubRow
          icon="document-text-outline"
          iconColor={COLORS.earth}
          label="Legal"
          onPress={() => router.push('/(settings)/legal')}
        />
        <SettingsHubRow
          icon="person-circle-outline"
          iconColor={COLORS.textSecondary}
          label="Account"
          onPress={() => router.push('/(settings)/account')}
          isLast
        />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

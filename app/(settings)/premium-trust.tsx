import React from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import {
  SettingRow,
  settingsStyles,
} from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';

export default function PremiumTrustSettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Premium & trust" titleAlign="leading" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={settingsStyles.scrollContent}>
        <Text style={settingsStyles.screenIntro}>
          Unlock more visibility and features, or submit a selfie for a verified badge.
        </Text>
        <>
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
            isLast
          />
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

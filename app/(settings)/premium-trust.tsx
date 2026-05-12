import React from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { SettingRow, settingsStyles } from '@/components/settings/settings-shared';
import { COLORS } from '@/constants';
import { isProSync, PAYMENTS_ENABLED } from '@/lib/payments';
import { presentCustomerCenter } from '@/lib/paywall';

export default function PremiumTrustSettingsScreen() {
  const isPro = isProSync();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Premium & trust" titleAlign="leading" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settingsStyles.scrollContent}
      >
        <Text style={settingsStyles.screenIntro}>
          Unlock more visibility and features, or submit a selfie for a verified badge.
        </Text>
        <SettingRow
          icon="sparkles-outline"
          iconColor={COLORS.primary}
          label={isPro ? 'Africana Pro is active' : 'Go Pro'}
          description={
            isPro
              ? 'Tap to view or change your plan'
              : 'Unlimited likes and messages, see who viewed you, and more'
          }
          onPress={() => router.push('/(settings)/upgrade')}
        />
        {/* RevenueCat Customer Center — handles cancel, refund, restore, support.
            Always available when payments are on; otherwise we hide it. */}
        {PAYMENTS_ENABLED && (
          <SettingRow
            icon="card-outline"
            iconColor={COLORS.earth}
            label="Manage subscription"
            description="Cancel, restore, or change plan"
            onPress={() => void presentCustomerCenter()}
          />
        )}
        <SettingRow
          icon="shield-checkmark-outline"
          iconColor={COLORS.success}
          label="Profile verification"
          description="Submit a selfie for a verified badge"
          onPress={() => router.push('/(settings)/verify')}
          isLast
        />
      </ScrollView>
    </SafeAreaView>
  );
}

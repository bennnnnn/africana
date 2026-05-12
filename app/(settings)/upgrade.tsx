import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '@/constants';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { PAYMENTS_ENABLED, PRO_PLAN } from '@/lib/payments';
import { presentPaywall } from '@/lib/paywall';
import { appDialog } from '@/lib/app-dialog';
import { useDialog } from '@/components/ui/DialogProvider';

type Cycle = 'monthly' | 'annual';

/**
 * Two-mode screen:
 *
 *   1. PAYMENTS_ENABLED = false → renders the in-app preview card with a
 *      "Notify me 🔔" CTA. No native paywall, no SDK touched.
 *
 *   2. PAYMENTS_ENABLED = true → auto-launches the RevenueCat dashboard
 *      paywall on mount. The dashboard owns the design; this screen is just
 *      the entry point. After the paywall is dismissed/purchased/cancelled
 *      we either pop back to the previous screen (cancel) or show a success
 *      toast (purchased / restored).
 */
export default function UpgradeScreen() {
  const [cycle, setCycle] = useState<Cycle>('annual');
  const { showToast } = useDialog();
  const presentedRef = useRef(false);

  useEffect(() => {
    if (!PAYMENTS_ENABLED) return;
    if (presentedRef.current) return;
    presentedRef.current = true;
    void (async () => {
      const outcome = await presentPaywall();
      if (outcome === 'purchased') {
        showToast({ icon: 'sparkles', message: 'Welcome to Africana Pro!' });
        router.back();
      } else if (outcome === 'restored') {
        showToast({ icon: 'checkmark-circle', message: 'Subscription restored.' });
        router.back();
      } else if (outcome === 'cancelled') {
        router.back();
      } else if (outcome === 'error') {
        appDialog({
          title: 'Couldn’t open paywall',
          message: 'Please try again in a moment.',
          icon: 'alert-circle-outline',
          actions: [{ label: 'OK', style: 'alert' }],
        });
      }
    })();
  }, [showToast]);

  const handleNotifyMe = () => {
    appDialog({
      title: 'You’re on the list',
      message: 'We’ll let you know the moment Africana Pro launches.',
      icon: 'sparkles-outline',
    });
  };

  // When payments are live we render an empty shell — the paywall is the UI.
  if (PAYMENTS_ENABLED) {
    return (
      <SafeAreaView style={s.screen}>
        <SettingsHeaderBar title="Africana Pro" titleAlign="center" />
      </SafeAreaView>
    );
  }

  const activePrice = cycle === 'monthly' ? PRO_PLAN.monthlyPrice : PRO_PLAN.annualMonthly;
  const billedLabel =
    cycle === 'monthly'
      ? 'billed monthly'
      : `billed ${PRO_PLAN.annualPrice} yearly · ${PRO_PLAN.annualDiscountLabel}`;

  return (
    <SafeAreaView style={s.screen}>
      <SettingsHeaderBar title="Africana Pro" titleAlign="center" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.heroEmoji}>{PRO_PLAN.emoji}</Text>
          <Text style={s.heroTitle}>Go Pro</Text>
          <Text style={s.heroSub}>
            One simple upgrade. Unlimited likes and messages, see who viewed you, and browse
            privately.
          </Text>
        </View>

        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, cycle === 'monthly' && s.toggleBtnOn]}
            onPress={() => setCycle('monthly')}
            activeOpacity={0.7}
          >
            <Text style={[s.toggleText, cycle === 'monthly' && s.toggleTextOn]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, cycle === 'annual' && s.toggleBtnOn]}
            onPress={() => setCycle('annual')}
            activeOpacity={0.7}
          >
            <Text style={[s.toggleText, cycle === 'annual' && s.toggleTextOn]}>Annual</Text>
            <View style={s.saveBadge}>
              <Text style={s.saveBadgeText}>SAVE 50%</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.planCard}>
          <View style={s.priceRow}>
            <Text style={s.price}>{activePrice}</Text>
            <Text style={s.priceUnit}>/mo</Text>
          </View>
          <Text style={s.billed}>{billedLabel}</Text>

          <View style={s.divider} />

          {PRO_PLAN.features.map((feat) => (
            <View key={feat} style={s.featRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={s.featText}>{feat}</Text>
            </View>
          ))}

          <TouchableOpacity style={s.buyBtn} onPress={handleNotifyMe} activeOpacity={0.85}>
            <Text style={s.buyBtnText}>Notify me 🔔</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.note}>
          Subscription auto-renews. Cancel anytime in App Store / Google Play settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 24 },
  heroEmoji: { fontSize: 56, marginBottom: 10 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  heroSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.savanna,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtnOn: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  toggleTextOn: { color: COLORS.text, fontWeight: '700' },
  saveBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.6 },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontSize: 40, fontWeight: '900', color: COLORS.primary },
  priceUnit: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },
  billed: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 18 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  featText: { fontSize: 14, color: COLORS.text, flex: 1 },
  buyBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  buyBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  note: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
    marginTop: 8,
  },
});

void FONT;

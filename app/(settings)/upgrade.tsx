import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { PAYMENTS_ENABLED, PLANS } from '@/lib/payments';

const { width } = Dimensions.get('window');

export default function UpgradeScreen() {
  const handlePurchase = (plan: 'gold' | 'platinum') => {
    if (!PAYMENTS_ENABLED) {
      Alert.alert(
        'Coming Soon 🚀',
        "Premium features are launching soon. You'll be notified when they're available!",
        [{ text: 'Got it' }],
      );
      return;
    }
    // TODO: call purchasePlan(userId, plan) when PAYMENTS_ENABLED = true
    Alert.alert('Purchase', `Starting purchase for ${PLANS[plan].name}...`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Go Premium</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>💎</Text>
          <Text style={s.heroTitle}>Unlock Everything</Text>
          <Text style={s.heroSub}>
            Get more matches, see who likes you, and stand out from the crowd.
          </Text>
        </View>

        {/* Plans */}
        {(['gold', 'platinum'] as const).map((id) => {
          const plan = PLANS[id];
          const isPopular = id === 'platinum';
          return (
            <View key={id} style={[s.planCard, isPopular && s.planCardPop]}>
              {isPopular && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Text style={{ fontSize: 28 }}>{plan.emoji}</Text>
                <Text style={[s.planName, isPopular && { color: COLORS.primary }]}>{plan.name}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[s.planPrice, isPopular && { color: COLORS.primary }]}>{plan.monthlyPrice}/mo</Text>
              </View>
              <View style={s.divider} />
              {plan.features.map((feat) => (
                <View key={feat} style={s.featRow}>
                  <Ionicons name="checkmark-circle" size={18} color={isPopular ? COLORS.primary : COLORS.success} />
                  <Text style={s.featText}>{feat}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[s.buyBtn, isPopular && s.buyBtnPop]}
                onPress={() => handlePurchase(id)}
                activeOpacity={0.85}
              >
                <Text style={[s.buyBtnText, isPopular && { color: '#FFF' }]}>
                  {PAYMENTS_ENABLED
                    ? (isPopular ? `Get ${plan.name} →` : `Try ${plan.name}`)
                    : 'Notify Me 🔔'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={s.note}>
          All plans auto-renew monthly. Cancel anytime in App Store / Google Play Settings.
          Prices may vary by region.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  scroll: { padding: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 28 },
  heroEmoji: { fontSize: 56, marginBottom: 10 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  heroSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  planCardPop: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 10,
  },
  popularText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.8 },
  planName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  planPrice: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  featText: { fontSize: 14, color: COLORS.text, flex: 1 },
  buyBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  buyBtnPop: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  buyBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  note: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
    marginTop: 8,
  },
});

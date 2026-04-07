/**
 * Africana — Payment / Subscription Layer (RevenueCat)
 *
 * PAYMENTS_ENABLED = false → everyone gets free access, upgrade UI shows "Coming Soon"
 * PAYMENTS_ENABLED = true  → RevenueCat is live, premium gating is active
 *
 * To activate payments:
 *   1. Set PAYMENTS_ENABLED = true below
 *   2. npx expo install react-native-purchases
 *   3. Add to .env:
 *        EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxx
 *        EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxx
 *   4. Run `npx expo prebuild` to link native modules
 *   5. Configure products in App Store Connect / Google Play Console
 *   6. Configure entitlements "gold" and "platinum" in RevenueCat dashboard
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ── Feature flag ──────────────────────────────────────────────────────────────
export const PAYMENTS_ENABLED = false;

export type PlanId = 'free' | 'gold' | 'platinum';

export interface Subscription {
  plan: PlanId;
  expiresAt: string | null;
  isActive: boolean;
  provider: 'revenuecat' | 'stripe' | 'manual' | null;
}

export const FREE_SUB: Subscription = {
  plan: 'free',
  expiresAt: null,
  isActive: false,
  provider: null,
};

// ── Plan definitions ──────────────────────────────────────────────────────────
export const PLANS = {
  gold: {
    id: 'gold' as PlanId,
    name: 'Gold',
    emoji: '⭐',
    monthlyPrice: '$9.99',
    annualPrice: '$79.99',
    annualMonthly: '$6.67',
    revenuecatId: {
      ios: 'africana_gold_monthly',
      android: 'africana_gold_monthly',
    },
    features: [
      'See who liked you',
      '100 likes per day',
      'Read receipts in chat',
      'Advanced filters (religion, education)',
      'Priority support',
    ],
  },
  platinum: {
    id: 'platinum' as PlanId,
    name: 'Platinum',
    emoji: '💎',
    monthlyPrice: '$19.99',
    annualPrice: '$149.99',
    annualMonthly: '$12.50',
    revenuecatId: {
      ios: 'africana_platinum_monthly',
      android: 'africana_platinum_monthly',
    },
    features: [
      'Everything in Gold',
      'Unlimited likes',
      'Profile boost (1× per week)',
      'Priority in Discover feed',
      'Incognito browsing',
      'See who viewed your profile',
    ],
  },
} as const;

// ── RevenueCat initialization ─────────────────────────────────────────────────
let _rcInitialized = false;

export async function initializePayments(userId: string): Promise<void> {
  if (!PAYMENTS_ENABLED || _rcInitialized) return;
  try {
    // Dynamic import — only works after `npx expo install react-native-purchases`
    const Purchases = (await import('react-native-purchases' as any)).default;
    const apiKey =
      Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!;
    if (!apiKey) return;
    await Purchases.configure({ apiKey });
    await Purchases.logIn(userId);
    _rcInitialized = true;
  } catch {
    // react-native-purchases not installed yet — skip silently
  }
}

// ── Fetch subscription ────────────────────────────────────────────────────────
export async function getSubscription(userId: string): Promise<Subscription> {
  if (!PAYMENTS_ENABLED) return FREE_SUB;

  // Try RevenueCat first (most up-to-date)
  if (_rcInitialized) {
    try {
      const Purchases = (await import('react-native-purchases' as any)).default;
      const info = await Purchases.getCustomerInfo();
      const isGold     = !!info.entitlements.active['gold'];
      const isPlatinum = !!info.entitlements.active['platinum'];
      if (isPlatinum) return { plan: 'platinum', expiresAt: null, isActive: true, provider: 'revenuecat' };
      if (isGold)     return { plan: 'gold',     expiresAt: null, isActive: true, provider: 'revenuecat' };
    } catch {}
  }

  // Fall back to DB
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, expires_at, is_active, provider')
    .eq('user_id', userId)
    .single();

  if (!data || !data.is_active) return FREE_SUB;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ...FREE_SUB, expiresAt: data.expires_at };
  }
  return {
    plan: data.plan as PlanId,
    expiresAt: data.expires_at,
    isActive: true,
    provider: (data.provider ?? null) as Subscription['provider'],
  };
}

// ── Simple helper ─────────────────────────────────────────────────────────────
export async function isPremium(userId: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return false;
  const sub = await getSubscription(userId);
  return sub.isActive;
}

// ── Purchase a plan ───────────────────────────────────────────────────────────
export async function purchasePlan(
  userId: string,
  plan: 'gold' | 'platinum',
): Promise<{ success: boolean; error?: string }> {
  if (!PAYMENTS_ENABLED) return { success: false, error: 'Payments not enabled yet.' };
  if (!_rcInitialized) return { success: false, error: 'Payment system not initialized.' };
  try {
    const Purchases = (await import('react-native-purchases' as any)).default;
    const offerings = await Purchases.getOfferings();
    const pkgId = PLANS[plan].revenuecatId[Platform.OS === 'ios' ? 'ios' : 'android'];
    const pkg = offerings.current?.availablePackages.find(
      (p: any) => p.identifier === pkgId,
    );
    if (!pkg) return { success: false, error: 'Package not found.' };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isActive = !!customerInfo.entitlements.active[plan];
    if (isActive) {
      // Sync to DB for offline access
      await supabase.from('subscriptions').upsert(
        { user_id: userId, plan, is_active: true, provider: 'revenuecat' },
        { onConflict: 'user_id' },
      );
    }
    return { success: isActive };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, error: 'cancelled' };
    return { success: false, error: e?.message ?? 'Purchase failed.' };
  }
}

// ── Restore purchases ─────────────────────────────────────────────────────────
export async function restorePurchases(
  userId: string,
): Promise<{ success: boolean; plan?: PlanId }> {
  if (!PAYMENTS_ENABLED || !_rcInitialized) return { success: false };
  try {
    const Purchases = (await import('react-native-purchases' as any)).default;
    const info = await Purchases.restorePurchases();
    const isPlatinum = !!info.entitlements.active['platinum'];
    const isGold     = !!info.entitlements.active['gold'];
    const plan: PlanId = isPlatinum ? 'platinum' : isGold ? 'gold' : 'free';
    if (plan !== 'free') {
      await supabase.from('subscriptions').upsert(
        { user_id: userId, plan, is_active: true, provider: 'revenuecat' },
        { onConflict: 'user_id' },
      );
    }
    return { success: true, plan };
  } catch {
    return { success: false };
  }
}

// ── Premium feature gates ─────────────────────────────────────────────────────
/** Daily like limit for free users */
export const FREE_DAILY_LIKES = 20;

/** Plans that can see who liked them */
export const CAN_SEE_LIKERS: PlanId[] = ['gold', 'platinum'];

/** Plans that can boost their profile */
export const CAN_BOOST: PlanId[] = ['platinum'];

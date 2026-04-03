/**
 * Africana — Payment / Subscription Layer
 *
 * Currently: Free app, no payments.
 *
 * To add payments later, install RevenueCat:
 *   npx expo install react-native-purchases
 *
 * Then replace the stub functions below with real RevenueCat calls.
 * The rest of the app uses isPremium() so no other files need to change.
 *
 * Planned premium features (gate with isPremium()):
 *   - See who liked you (Likes tab — blur for free users)
 *   - Unlimited likes (free = 20/day)
 *   - Read receipts in chat
 *   - Boost profile (appear at top of Discover for 1 hour)
 *   - Advanced filters (religion, education, height range)
 */

import { supabase } from './supabase';

export type PlanId = 'free' | 'gold' | 'platinum';

export interface Subscription {
  plan: PlanId;
  expiresAt: string | null;
  isActive: boolean;
}

// ── Fetch subscription from DB ─────────────────────────────────────────────────
export async function getSubscription(userId: string): Promise<Subscription> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, expires_at, is_active')
    .eq('user_id', userId)
    .single();

  if (!data || !data.is_active) {
    return { plan: 'free', expiresAt: null, isActive: false };
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { plan: 'free', expiresAt: data.expires_at, isActive: false };
  }

  return { plan: data.plan as PlanId, expiresAt: data.expires_at, isActive: true };
}

// ── Simple helper used throughout the app ─────────────────────────────────────
export async function isPremium(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  return sub.isActive;
}

// ── Stub: purchase a plan ──────────────────────────────────────────────────────
// Replace this with RevenueCat's Purchases.purchasePackage() when ready
export async function purchasePlan(_userId: string, _plan: PlanId): Promise<boolean> {
  console.warn('[Payments] purchasePlan called but RevenueCat not yet integrated.');
  return false;
}

// ── Stub: restore purchases ────────────────────────────────────────────────────
export async function restorePurchases(_userId: string): Promise<boolean> {
  console.warn('[Payments] restorePurchases called but RevenueCat not yet integrated.');
  return false;
}

// ── Premium feature constants ─────────────────────────────────────────────────
export const PLANS = {
  gold: {
    id: 'gold' as PlanId,
    name: 'Gold',
    emoji: '⭐',
    price: '$9.99/mo',
    features: [
      'See who liked you',
      '100 likes per day',
      'Read receipts',
      'Advanced filters',
    ],
  },
  platinum: {
    id: 'platinum' as PlanId,
    name: 'Platinum',
    emoji: '💎',
    price: '$19.99/mo',
    features: [
      'Everything in Gold',
      'Unlimited likes',
      'Profile boost (1×/week)',
      'Priority in Discover',
      'Incognito browsing',
    ],
  },
};

/**
 * Africana — Payment / Subscription Layer (RevenueCat)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MONETIZATION MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single subscription tier: **Africana Pro**
 *   - Monthly: $9.99/mo
 *   - Annual:  $59.99/yr  (≈ $5/mo — 50% off the monthly)
 *
 * RevenueCat entitlement identifier: `pro` (display name: "Africana Pro").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ROLLOUT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Phase 1: PAYMENTS_ENABLED = false → everyone gets Free. Upgrade screen
 *          renders the in-app preview ("Notify me 🔔") and the SDK is not
 *          initialized. No native side effects.
 *
 * Phase 2: PAYMENTS_ENABLED = true  → RevenueCat is configured at app
 *          bootstrap (after auth), the paywall is presented from the Upgrade
 *          screen, and `isProSync()` reads from the cached CustomerInfo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FREE vs PRO (enforced)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Free for everyone (no gate):
 *   - See who liked you (clear avatars)
 *   - All Discover filters
 *   - Read receipts in chat
 *
 * Free has limits (gated):
 *   - 10 likes / day
 *   - 10 messages / day
 *
 * Pro (paid):
 *   - Unlimited likes
 *   - Unlimited messages
 *   - See who viewed your profile (Views tab)
 *   - Hide / incognito browsing
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { growthShareRewardsCurrentlyApplies, userHasRecordedProfileShare } from './share-reward';
import { logError, logWarn } from './logger';

// ── Feature flag ──────────────────────────────────────────────────────────────
/** Master switch. While false, all users are on Free and the SDK is not loaded. */
export const PAYMENTS_ENABLED = false;

/** RevenueCat entitlement identifier. Must match what's configured in the
 *  RevenueCat dashboard. Display name in the dashboard can be "Africana Pro". */
export const RC_ENTITLEMENT_ID = 'pro';

export type PlanId = 'free' | 'pro';

export interface Subscription {
  plan: PlanId;
  expiresAt: string | null;
  isActive: boolean;
  provider: 'revenuecat' | 'manual' | null;
}

export const FREE_SUB: Subscription = {
  plan: 'free',
  expiresAt: null,
  isActive: false,
  provider: null,
};

// ── Plan definitions ──────────────────────────────────────────────────────────
export const PRO_PLAN = {
  id: 'pro' as const,
  name: 'Pro',
  emoji: '✨',
  monthlyPrice: '$9.99',
  annualPrice: '$59.99',
  annualMonthly: '$5.00',
  annualDiscountLabel: '50% off',
  /** RevenueCat package identifiers. Must match the products configured in
   *  the dashboard offering. RevenueCat normalizes these across stores. */
  packageIds: {
    monthly: '$rc_monthly',
    annual: '$rc_annual',
  },
  features: [
    'Unlimited likes',
    'Unlimited messages',
    'See who viewed your profile',
    'Hide profile / incognito browsing',
  ],
} as const;

export const PLANS = { pro: PRO_PLAN } as const;

// ── Free-tier limits ──────────────────────────────────────────────────────────
export const FREE_DAILY_LIKES = 10;
export const FREE_DAILY_MESSAGES = 10;

// ── Pro feature gates ─────────────────────────────────────────────────────────
/** Plans that can see who viewed their profile (Views tab). */
export const CAN_SEE_VIEWERS: PlanId[] = ['pro'];

/** Plans with incognito browsing + ability to hide profile. */
export const HAS_INCOGNITO: PlanId[] = ['pro'];

// ── Synchronous subscription cache ────────────────────────────────────────────
// The CustomerInfo update listener mirrors RevenueCat state into this cache so
// app code can do a synchronous `isProSync()` check without RPC/IO on every
// like/message send. Updated automatically.

let _cachedSubscription: Subscription = FREE_SUB;
const _subscriptionListeners = new Set<(sub: Subscription) => void>();

export function getCachedSubscription(): Subscription {
  return _cachedSubscription;
}

export function isProSync(): boolean {
  return PAYMENTS_ENABLED && _cachedSubscription.isActive && _cachedSubscription.plan === 'pro';
}

/** Subscribe to subscription state changes (e.g. for auth store integration). */
export function onSubscriptionChange(cb: (sub: Subscription) => void): () => void {
  _subscriptionListeners.add(cb);
  return () => {
    _subscriptionListeners.delete(cb);
  };
}

function setCachedSubscription(next: Subscription): void {
  _cachedSubscription = next;
  for (const cb of _subscriptionListeners) {
    try {
      cb(next);
    } catch (e) {
      logWarn('[payments] subscription listener threw', e);
    }
  }
}

// ── RevenueCat SDK ────────────────────────────────────────────────────────────

let _rcConfigured = false;
let _currentUserId: string | null = null;

function resolveApiKey(): string | null {
  const platformKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  const fallback = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  return platformKey || fallback || null;
}

function subscriptionFromCustomerInfo(info: unknown): Subscription {
  // info is RevenueCat's CustomerInfo. Untyped here so we don't hard-depend
  // on the package being installed at type-check time.
  const c = info as
    | {
        entitlements?: {
          active?: Record<
            string,
            { isActive?: boolean; expirationDate?: string | null; productIdentifier?: string }
          >;
        };
      }
    | null
    | undefined;
  const ent = c?.entitlements?.active?.[RC_ENTITLEMENT_ID];
  if (ent?.isActive) {
    return {
      plan: 'pro',
      expiresAt: ent.expirationDate ?? null,
      isActive: true,
      provider: 'revenuecat',
    };
  }
  return FREE_SUB;
}

/**
 * Configure RevenueCat for the current user. Idempotent. Safe to call
 * multiple times — only the first call configures the SDK; later calls just
 * log the user in (which is also idempotent).
 */
export async function initializePayments(userId: string): Promise<void> {
  if (!PAYMENTS_ENABLED) return;
  const apiKey = resolveApiKey();
  if (!apiKey) {
    logWarn('[payments] no RevenueCat API key set — skipping SDK init');
    return;
  }

  try {
    const Purchases = (await import('react-native-purchases')).default;

    if (!_rcConfigured) {
      // Modern SDK API: pass appUserID at configure time so initial CustomerInfo
      // reflects the right user immediately.
      Purchases.configure({ apiKey, appUserID: userId });
      _rcConfigured = true;

      // Wire the listener once. Updates flow through `setCachedSubscription`
      // so app code stays in sync with entitlement changes (purchase, expiry,
      // restore from another device, etc.).
      Purchases.addCustomerInfoUpdateListener((info) => {
        const next = subscriptionFromCustomerInfo(info);
        setCachedSubscription(next);
        void syncSubscriptionToDb(userId, next);
      });
    } else if (_currentUserId !== userId) {
      // User changed (signed out + in as someone else). Re-identify.
      await Purchases.logIn(userId);
    }

    _currentUserId = userId;

    // Seed the cache from the current CustomerInfo right away.
    const info = await Purchases.getCustomerInfo();
    const sub = subscriptionFromCustomerInfo(info);
    setCachedSubscription(sub);
    void syncSubscriptionToDb(userId, sub);
  } catch (e) {
    // SDK may be unavailable in Expo Go or before a native rebuild — that's OK.
    logWarn('[payments] RevenueCat unavailable (Expo Go or pre-rebuild?)', e);
  }
}

/**
 * Tear down on sign-out. Logs the user out of RevenueCat and resets the cache
 * so the next user doesn't inherit Pro state.
 */
export async function teardownPayments(): Promise<void> {
  setCachedSubscription(FREE_SUB);
  _currentUserId = null;
  if (!PAYMENTS_ENABLED || !_rcConfigured) return;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    await Purchases.logOut();
  } catch (e) {
    logWarn('[payments] logOut failed', e);
  }
}

// ── Subscription retrieval (RPC + DB fallback) ─────────────────────────────────

/**
 * Async subscription lookup. Use `isProSync()` for hot paths (like/message
 * gates) — that reads from the in-memory cache. Use this only when you need
 * up-to-the-second confirmation, e.g. on the Manage Subscription screen.
 */
export async function getSubscription(userId: string): Promise<Subscription> {
  if (!PAYMENTS_ENABLED) return FREE_SUB;

  // 1) Live from RevenueCat if configured.
  if (_rcConfigured) {
    try {
      const Purchases = (await import('react-native-purchases')).default;
      const info = await Purchases.getCustomerInfo();
      const sub = subscriptionFromCustomerInfo(info);
      if (sub.isActive) return sub;
    } catch (e) {
      logWarn('[payments] getCustomerInfo failed', e);
    }
  }

  // 2) Growth-phase share reward.
  if ((await growthShareRewardsCurrentlyApplies()) && (await userHasRecordedProfileShare(userId))) {
    return { plan: 'pro', expiresAt: null, isActive: true, provider: 'manual' };
  }

  // 3) Fall back to DB row (catches edge cases where SDK is unreachable but
  //    our backend recorded a successful purchase via webhook).
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, expires_at, is_active, provider')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || !data.is_active) return FREE_SUB;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ...FREE_SUB, expiresAt: data.expires_at };
  }
  return {
    plan: data.plan === 'pro' ? 'pro' : 'free',
    expiresAt: data.expires_at,
    isActive: true,
    provider: (data.provider ?? null) as Subscription['provider'],
  };
}

/** True if the user currently has an active Pro entitlement. */
export async function isPremium(userId: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return false;
  const sub = await getSubscription(userId);
  return sub.isActive && sub.plan === 'pro';
}

/** Mirror RevenueCat's entitlement state to our `subscriptions` table so server
 *  code (notifications, emails, RLS) can also check Pro status without hitting
 *  the RevenueCat API. */
async function syncSubscriptionToDb(userId: string, sub: Subscription): Promise<void> {
  try {
    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: sub.plan,
        is_active: sub.isActive,
        expires_at: sub.expiresAt,
        provider: sub.provider,
      },
      { onConflict: 'user_id' },
    );
  } catch (e) {
    logError('[payments] syncSubscriptionToDb failed', e);
  }
}

// ── Offerings (dynamic product fetch) ──────────────────────────────────────────
// Best practice: never hardcode product IDs in app UI. Fetch the active
// Offering from RevenueCat and render whatever packages it returns. The
// dashboard then controls availability, pricing, and A/B tests remotely
// without an app update.
//
// The RevenueCat-hosted paywall (presentPaywall) does this automatically.
// These helpers are for any *custom* UI we add later (inline upsell cards,
// product comparison tables, A/B tested paywalls, etc.).

/** Minimal shape of a RevenueCat Package we care about in app code. Anything
 *  not listed here can still be accessed by casting via `raw`. */
export interface RcPackage {
  identifier: string;
  /** RevenueCat normalized type: MONTHLY, ANNUAL, LIFETIME, etc. */
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
    /** Optional intro/trial — present when configured in App Store Connect / Play. */
    introPrice?: {
      priceString: string;
      price: number;
      periodUnit?: string;
      periodNumberOfUnits?: number;
    } | null;
  };
  /** Raw RevenueCat package — escape hatch for fields not normalized above. */
  raw: unknown;
}

export interface RcOffering {
  identifier: string;
  serverDescription: string;
  metadata: Record<string, unknown> | null;
  availablePackages: RcPackage[];
  monthly: RcPackage | null;
  annual: RcPackage | null;
  lifetime: RcPackage | null;
}

interface RawRcPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
    introPrice?: {
      priceString: string;
      price: number;
      periodUnit?: string;
      periodNumberOfUnits?: number;
    } | null;
  };
}

interface RawRcOffering {
  identifier: string;
  serverDescription: string;
  metadata?: Record<string, unknown> | null;
  availablePackages: RawRcPackage[];
  monthly?: RawRcPackage | null;
  annual?: RawRcPackage | null;
  lifetime?: RawRcPackage | null;
}

function normalizePackage(pkg: RawRcPackage | null | undefined): RcPackage | null {
  if (!pkg) return null;
  return {
    identifier: pkg.identifier,
    packageType: pkg.packageType,
    product: {
      identifier: pkg.product.identifier,
      title: pkg.product.title,
      description: pkg.product.description,
      priceString: pkg.product.priceString,
      price: pkg.product.price,
      currencyCode: pkg.product.currencyCode,
      introPrice: pkg.product.introPrice ?? null,
    },
    raw: pkg,
  };
}

function normalizeOffering(off: RawRcOffering | null | undefined): RcOffering | null {
  if (!off) return null;
  return {
    identifier: off.identifier,
    serverDescription: off.serverDescription,
    metadata: off.metadata ?? null,
    availablePackages: off.availablePackages
      .map(normalizePackage)
      .filter((p): p is RcPackage => p !== null),
    monthly: normalizePackage(off.monthly),
    annual: normalizePackage(off.annual),
    lifetime: normalizePackage(off.lifetime),
  };
}

/** Fetch the user's "current" Offering — the one targeted to them by the
 *  dashboard (default Offering, A/B experiment, or Targeting rule).
 *
 *  Returns null when payments are disabled, the SDK isn't linked, or no
 *  offering is configured. Caller is expected to fall back gracefully. */
export async function getCurrentOffering(): Promise<RcOffering | null> {
  if (!PAYMENTS_ENABLED) return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    return normalizeOffering(offerings.current as RawRcOffering | null);
  } catch (e) {
    logWarn('[payments] getCurrentOffering failed', e);
    return null;
  }
}

/** Fetch a specific Offering for a named placement. Use this when you want
 *  to control which paywall renders based on the surface (e.g. "post_match",
 *  "boost_button"). Placements are configured under Project → Placements
 *  in the RevenueCat dashboard.
 *
 *  Falls back to `getCurrentOffering()` semantics when no placement matches. */
export async function getCurrentOfferingForPlacement(
  placement: string,
): Promise<RcOffering | null> {
  if (!PAYMENTS_ENABLED) return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const off = await Purchases.getCurrentOfferingForPlacement(placement);
    return normalizeOffering(off as RawRcOffering | null);
  } catch (e) {
    logWarn('[payments] getCurrentOfferingForPlacement failed', e);
    return null;
  }
}

/** Fetch every configured Offering (current + experiments + custom). Use when
 *  building a product-comparison UI or implementing your own client-side
 *  targeting logic. */
export async function getAllOfferings(): Promise<Record<string, RcOffering>> {
  if (!PAYMENTS_ENABLED) return {};
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    const out: Record<string, RcOffering> = {};
    for (const [id, raw] of Object.entries(offerings.all ?? {})) {
      const normalized = normalizeOffering(raw as RawRcOffering);
      if (normalized) out[id] = normalized;
    }
    return out;
  } catch (e) {
    logWarn('[payments] getAllOfferings failed', e);
    return {};
  }
}

/** Programmatic purchase of a Package. Prefer presenting the RevenueCat
 *  paywall (which handles UI, loading states, error messages, and platform
 *  rules for you) — use this only for custom flows like an inline upgrade
 *  button that needs to skip the full paywall screen. */
export async function purchasePackage(pkg: RcPackage): Promise<{
  success: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  if (!PAYMENTS_ENABLED) return { success: false, error: 'Payments not enabled' };
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const result = await Purchases.purchasePackage(
      pkg.raw as Parameters<typeof Purchases.purchasePackage>[0],
    );
    const info = result.customerInfo;
    const sub = subscriptionFromCustomerInfo(info);
    setCachedSubscription(sub);
    if (_currentUserId) void syncSubscriptionToDb(_currentUserId, sub);
    return { success: sub.isActive };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { success: false, cancelled: true };
    logError('[payments] purchasePackage failed', e);
    return { success: false, error: err?.message ?? 'Purchase failed' };
  }
}

// ── Restore purchases ─────────────────────────────────────────────────────────

/**
 * Restore purchases from the device's store account. Useful on app reinstall
 * or device switch — the Customer Center already exposes this, but expose
 * an explicit helper for any custom UI.
 */
export async function restorePurchases(): Promise<{ success: boolean; plan?: PlanId }> {
  if (!PAYMENTS_ENABLED || !_rcConfigured) return { success: false };
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.restorePurchases();
    const sub = subscriptionFromCustomerInfo(info);
    setCachedSubscription(sub);
    if (_currentUserId) void syncSubscriptionToDb(_currentUserId, sub);
    return { success: true, plan: sub.plan };
  } catch (e) {
    logError('[payments] restorePurchases failed', e);
    return { success: false };
  }
}

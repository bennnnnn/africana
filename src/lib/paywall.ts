/**
 * Africana — Paywall + Customer Center launchers (RevenueCat UI).
 *
 * Thin wrappers around `react-native-purchases-ui`. Use these everywhere the
 * app needs to present the upgrade flow or let users manage their existing
 * subscription. Keeps the SDK import in one place and gives us a single
 * spot to add analytics / fallback behavior.
 *
 * The UI library renders the paywall configured in the RevenueCat dashboard
 * under Paywalls → Editor. Edits in the dashboard ship instantly without an
 * app update — that's the whole reason we use it instead of a custom screen.
 */

import { Platform, Linking } from 'react-native';
import { PAYMENTS_ENABLED, RC_ENTITLEMENT_ID } from './payments';
import { logError, logWarn } from './logger';

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'error' | 'not_presented';

interface PaywallUIModule {
  presentPaywall: (options?: {
    offering?: unknown;
    displayCloseButton?: boolean;
  }) => Promise<number>;
  presentPaywallIfNeeded: (options: {
    requiredEntitlementIdentifier: string;
    offering?: unknown;
    displayCloseButton?: boolean;
  }) => Promise<number>;
  presentCustomerCenter: () => Promise<void>;
  /** RevenueCatUI exports PAYWALL_RESULT as both an enum and a const object. */
  PAYWALL_RESULT: {
    NOT_PRESENTED: number;
    CANCELLED: number;
    ERROR: number;
    PURCHASED: number;
    RESTORED: number;
  };
}

async function loadUi(): Promise<PaywallUIModule | null> {
  try {
    const mod = (await import('react-native-purchases-ui')) as unknown as {
      default: PaywallUIModule;
    };
    return mod.default;
  } catch (e) {
    logWarn('[paywall] react-native-purchases-ui unavailable (Expo Go or pre-rebuild)', e);
    return null;
  }
}

function outcomeFor(result: number, ui: PaywallUIModule): PaywallOutcome {
  switch (result) {
    case ui.PAYWALL_RESULT.PURCHASED:
      return 'purchased';
    case ui.PAYWALL_RESULT.RESTORED:
      return 'restored';
    case ui.PAYWALL_RESULT.CANCELLED:
      return 'cancelled';
    case ui.PAYWALL_RESULT.NOT_PRESENTED:
      return 'not_presented';
    default:
      return 'error';
  }
}

/**
 * Present the dashboard-configured paywall. Returns the user's outcome so
 * the caller can decide whether to navigate, refresh state, etc.
 *
 * No-op (returns `'not_presented'`) when payments are disabled or the SDK
 * isn't installed in the current build.
 */
export async function presentPaywall(): Promise<PaywallOutcome> {
  if (!PAYMENTS_ENABLED) return 'not_presented';
  const ui = await loadUi();
  if (!ui) return 'not_presented';
  try {
    const result = await ui.presentPaywall({ displayCloseButton: true });
    return outcomeFor(result, ui);
  } catch (e) {
    logError('[paywall] presentPaywall failed', e);
    return 'error';
  }
}

/**
 * Present the paywall only if the user is missing the Pro entitlement.
 * No-op for paid users. Use this when a Pro-only action is attempted, so
 * we don't bother existing subscribers with the paywall.
 */
export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
  if (!PAYMENTS_ENABLED) return 'not_presented';
  const ui = await loadUi();
  if (!ui) return 'not_presented';
  try {
    const result = await ui.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: RC_ENTITLEMENT_ID,
      displayCloseButton: true,
    });
    return outcomeFor(result, ui);
  } catch (e) {
    logError('[paywall] presentPaywallIfNeeded failed', e);
    return 'error';
  }
}

/**
 * Present the RevenueCat Customer Center — handles subscription management,
 * restore purchases, cancellation flow, refund requests, support email, etc.
 * Configure the surface (header, sections, support contact) in the RevenueCat
 * dashboard under Customer Center.
 *
 * If the SDK is unavailable, falls back to opening the platform's native
 * subscription management URL so users on older builds still have a path.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (PAYMENTS_ENABLED) {
    const ui = await loadUi();
    if (ui) {
      try {
        await ui.presentCustomerCenter();
        return;
      } catch (e) {
        logError('[paywall] presentCustomerCenter failed, falling back', e);
      }
    }
  }
  // Fallback: open the platform's native subscriptions screen.
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  try {
    await Linking.openURL(url);
  } catch (e) {
    logWarn('[paywall] could not open subscription URL', e);
  }
}

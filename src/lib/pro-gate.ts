/**
 * Africana — Pro-gate dialog.
 *
 * Single source of truth for "this feature is Pro" prompts across the app:
 *   - Daily likes/messages caps
 *   - Hide profile toggle
 *   - Incognito browsing toggle
 *   - Any future Pro-only feature
 *
 * Always presents an "Upgrade" CTA that routes to the Upgrade screen — even
 * while PAYMENTS_ENABLED is false. The Upgrade screen renders the preview
 * ("Notify me 🔔") in that mode, so users still learn what Pro will be and
 * can register interest.
 */

import { router } from 'expo-router';
import { appDialog } from '@/lib/app-dialog';

export interface ProGateDialogOptions {
  /** Dialog headline. Be concrete: "You've used your 10 free likes today",
   *  "Hiding your profile is a Pro feature", etc. */
  title: string;
  /** Optional short body line. Omit unless it adds information beyond the title. */
  message?: string;
  /** Ionicons name; defaults to a soft alert. */
  icon?: string;
  /** Override the cancel button label (e.g. "Not now"). */
  cancelLabel?: string;
  /** Override the upgrade button label (e.g. "See Pro"). */
  upgradeLabel?: string;
}

/**
 * Show the canonical Pro-upgrade dialog. The "Go Pro" action routes to the
 * Upgrade screen, which then either:
 *   - presents the RevenueCat paywall (PAYMENTS_ENABLED = true), or
 *   - renders the preview card with a Notify-me CTA (PAYMENTS_ENABLED = false).
 */
export function showProGateDialog(options: ProGateDialogOptions): void {
  appDialog({
    title: options.title,
    message: options.message,
    icon: options.icon ?? 'alert-circle-outline',
    actions: [
      { label: options.cancelLabel ?? 'Not now', style: 'cancel' },
      {
        label: options.upgradeLabel ?? 'Go Pro',
        style: 'primary',
        onPress: () => router.push('/(settings)/upgrade'),
      },
    ],
  });
}

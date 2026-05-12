/**
 * Analytics stub — PostHog removed. All calls are no-ops.
 * Replace this file with a real provider (e.g. Mixpanel, Amplitude) when ready.
 * Crash reporting is handled by Sentry (src/lib/sentry.ts).
 */

export async function initAnalytics(): Promise<void> {}

export function track(_event: string, _props?: Record<string, unknown>): void {}

export function identify(_distinctId: string, _props?: Record<string, unknown>): void {}

export function resetAnalytics(): void {}

export const EVENTS = {
  AUTH_SIGNUP_COMPLETE: 'auth_signup_complete',
  AUTH_LOGIN: 'auth_login',
  AUTH_SIGNOUT: 'auth_signout',
  PROFILE_VIEWED: 'profile_viewed',
  LIKE_SENT: 'like_sent',
  LIKE_REMOVED: 'like_removed',
  MATCH_CREATED: 'match_created',
  MESSAGE_SENT: 'message_sent',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  VERIFICATION_COMPLETE: 'verification_complete',
  FAVOURITE_ADDED: 'favourite_added',
  BLOCK_REMOVED: 'block_removed',
} as const;

/**
 * Thin analytics wrapper around PostHog.
 *
 * Stores talk to this module directly (zustand stores can't use hooks), and
 * screens can call the same functions — one surface, one codepath. If
 * `EXPO_PUBLIC_POSTHOG_KEY` is not set (dev), every call is a no-op, so
 * instrumentation is safe to ship without creds.
 *
 * Design notes:
 *   - NEVER send PII. We pass `user.id` only as the distinct-id; no emails,
 *     names, or messages. Values passed here should be counts/booleans.
 *   - Events are intentionally coarse. Too many events = noisy dashboards.
 *   - The module keeps its own tiny queue while PostHog finishes async init
 *     so early-boot `track()` calls aren't dropped.
 */

import PostHog from 'posthog-react-native';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;
let initializing = false;

type QueuedCall =
  | { kind: 'track'; event: string; props?: Record<string, unknown> }
  | { kind: 'identify'; distinctId: string; props?: Record<string, unknown> }
  | { kind: 'reset' };
const queue: QueuedCall[] = [];

function flushQueue() {
  if (!client) return;
  while (queue.length) {
    const call = queue.shift()!;
    try {
      switch (call.kind) {
        case 'track':
          client.capture(call.event, call.props);
          break;
        case 'identify':
          client.identify(call.distinctId, call.props);
          break;
        case 'reset':
          client.reset();
          break;
      }
    } catch {
      /* swallow — analytics must never break the app */
    }
  }
}

/**
 * Boot analytics once at app start. Safe to call multiple times.
 * If `EXPO_PUBLIC_POSTHOG_KEY` is missing, this is a no-op.
 */
export async function initAnalytics(): Promise<void> {
  if (!API_KEY || client || initializing) return;
  initializing = true;
  try {
    const instance = new PostHog(API_KEY, {
      host: HOST,
      flushAt: 20,
      // In debug we want events to appear quickly in the PostHog UI.
      flushInterval: __DEV__ ? 2_000 : 10_000,
      disableGeoip: false,
      captureAppLifecycleEvents: true,
    });
    // Newer versions of posthog-react-native are synchronous on construction;
    // the `.ready()` await is kept in case older Expo-prebuilt versions need
    // storage to warm up before capture calls land.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeReady = (instance as any).ready;
    if (typeof maybeReady === 'function') {
      try { await maybeReady.call(instance); } catch { /* ignore */ }
    }
    client = instance;
    flushQueue();
  } catch (e) {
    if (__DEV__) console.warn('[analytics] init failed:', e);
  } finally {
    initializing = false;
  }
}

/**
 * Record an event. Non-blocking, never throws.
 *
 * Keep event names SCREAMING_SNAKE_CASE and properties small/serializable.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!API_KEY) return;
  if (!client) {
    queue.push({ kind: 'track', event, props });
    return;
  }
  try { client.capture(event, props); } catch { /* swallow */ }
}

/** Associate subsequent events with a user id. Call on sign-in. */
export function identify(distinctId: string, props?: Record<string, unknown>): void {
  if (!API_KEY) return;
  if (!client) {
    queue.push({ kind: 'identify', distinctId, props });
    return;
  }
  try { client.identify(distinctId, props); } catch { /* swallow */ }
}

/** Forget the current user. Call on sign-out. */
export function resetAnalytics(): void {
  if (!API_KEY) return;
  if (!client) {
    queue.push({ kind: 'reset' });
    return;
  }
  try { client.reset(); } catch { /* swallow */ }
}

/** Event name constants — centralized to avoid typos in dashboards. */
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
} as const;

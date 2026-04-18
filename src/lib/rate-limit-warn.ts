/**
 * Client-side soft warnings for rate limits.
 *
 * Calls the `public.rate_limit_counts` RPC after a successful message send
 * or like. When the user crosses into the "few left" window (<= SOFT_WARN
 * away from the cap), we pop an `appDialog` exactly *once* per window per
 * session. This turns the hard 40/hr, 100/day walls into a predictable
 * experience instead of a surprise error.
 *
 * We intentionally debounce per-bucket-per-session — a user who just saw
 * "5 messages left" shouldn't get pestered on every subsequent send.
 */

import { supabase } from '@/lib/supabase';
import { appDialog } from '@/lib/app-dialog';

/** Trigger the warning when remaining in a bucket is <= this many. */
const SOFT_WARN = 5;

type Bucket =
  | 'messages_hour'
  | 'messages_day'
  | 'likes_hour'
  | 'likes_day';

const warnedThisSession = new Set<Bucket>();

interface Counts {
  messages_hour_used: number;
  messages_hour_limit: number;
  messages_day_used: number;
  messages_day_limit: number;
  likes_hour_used: number;
  likes_hour_limit: number;
  likes_day_used: number;
  likes_day_limit: number;
}

async function fetchCounts(): Promise<Counts | null> {
  const { data, error } = await supabase.rpc('rate_limit_counts');
  if (error || !data) return null;
  return data as unknown as Counts;
}

function evaluate(
  counts: Counts,
  topic: 'messages' | 'likes',
): { bucket: Bucket; remaining: number; limit: number } | null {
  const hour = topic === 'messages'
    ? { used: counts.messages_hour_used, limit: counts.messages_hour_limit, bucket: 'messages_hour' as const }
    : { used: counts.likes_hour_used,    limit: counts.likes_hour_limit,    bucket: 'likes_hour' as const };
  const day = topic === 'messages'
    ? { used: counts.messages_day_used, limit: counts.messages_day_limit, bucket: 'messages_day' as const }
    : { used: counts.likes_day_used,    limit: counts.likes_day_limit,    bucket: 'likes_day' as const };

  // Prefer whichever bucket is closer to its cap — that's the one the user
  // will actually hit first, and the one worth warning about.
  const hourRem = hour.limit - hour.used;
  const dayRem  = day.limit - day.used;
  const tight = hourRem <= dayRem ? hour : day;

  const remaining = tight.limit - tight.used;
  if (remaining > SOFT_WARN || remaining <= 0) return null; // outside the warn band
  return { bucket: tight.bucket, remaining, limit: tight.limit };
}

function presentDialog(bucket: Bucket, remaining: number) {
  const noun = bucket.startsWith('messages') ? 'messages' : 'likes';
  const window = bucket.endsWith('_hour') ? 'hour' : 'day';
  appDialog({
    title: remaining === 1 ? `1 ${noun.slice(0, -1)} left this ${window}` : `${remaining} ${noun} left this ${window}`,
    message:
      window === 'hour'
        ? `You can send ${remaining} more ${noun} this hour before you\u2019ll need to wait.`
        : `You can send ${remaining} more ${noun} today. Resets in 24 hours.`,
    icon: 'time-outline',
  });
}

/**
 * Call after a successful message send. No-op on failure, network errors, or
 * if we've already warned for the current bucket in this session.
 */
export async function maybeWarnMessageQuota(): Promise<void> {
  try {
    const counts = await fetchCounts();
    if (!counts) return;
    const hit = evaluate(counts, 'messages');
    if (!hit) return;
    if (warnedThisSession.has(hit.bucket)) return;
    warnedThisSession.add(hit.bucket);
    presentDialog(hit.bucket, hit.remaining);
  } catch {
    /* swallow — never break send flow over a warning */
  }
}

/** Call after a successful like. Same contract as `maybeWarnMessageQuota`. */
export async function maybeWarnLikeQuota(): Promise<void> {
  try {
    const counts = await fetchCounts();
    if (!counts) return;
    const hit = evaluate(counts, 'likes');
    if (!hit) return;
    if (warnedThisSession.has(hit.bucket)) return;
    warnedThisSession.add(hit.bucket);
    presentDialog(hit.bucket, hit.remaining);
  } catch {
    /* swallow */
  }
}

/** Reset state (e.g. on sign-out). */
export function resetRateLimitWarnings(): void {
  warnedThisSession.clear();
}

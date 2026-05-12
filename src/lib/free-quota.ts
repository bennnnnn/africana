/**
 * Free-tier daily quota gate (likes + messages).
 *
 * Enforces FREE_DAILY_LIKES / FREE_DAILY_MESSAGES client-side so users get a
 * friendly "you've used your free X for today" dialog with an Upgrade CTA
 * instead of silently hitting the DB anti-spam ceiling at 100/day.
 *
 * While PAYMENTS_ENABLED = false, EVERYONE is on Free and these caps apply.
 * Once PAYMENTS_ENABLED = true, Pro users skip the gate (the helper checks
 * `isProSync()` first).
 *
 * Backed by the `rate_limit_counts` RPC for the initial read; subsequent
 * sends increment an in-memory counter to avoid round-tripping the server
 * for every send. Cache resets at UTC day rollover and on sign-out.
 */

import { supabase } from '@/lib/supabase';
import { FREE_DAILY_LIKES, FREE_DAILY_MESSAGES, isProSync } from '@/lib/payments';
import { showProGateDialog } from '@/lib/pro-gate';

type Counts = { messages: number; likes: number };

let cached: { date: string; counts: Counts } | null = null;
let inFlight: Promise<Counts> | null = null;

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchFromServer(): Promise<Counts> {
  const { data } = await supabase.rpc('rate_limit_counts');
  if (!data) return { messages: 0, likes: 0 };
  const d = data as Record<string, number>;
  return {
    messages: Number(d.messages_day_used) || 0,
    likes: Number(d.likes_day_used) || 0,
  };
}

async function getCounts(): Promise<Counts> {
  const today = todayUtcKey();
  if (cached && cached.date === today) return cached.counts;
  if (!inFlight) {
    inFlight = fetchFromServer()
      .then((counts) => {
        cached = { date: today, counts };
        return counts;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Increment the in-memory counter after a successful send. */
export function noteSentMessage(): void {
  const today = todayUtcKey();
  if (cached && cached.date === today) cached.counts.messages += 1;
}

/** Increment the in-memory counter after a successful like. */
export function noteSentLike(): void {
  const today = todayUtcKey();
  if (cached && cached.date === today) cached.counts.likes += 1;
}

export type QuotaGate = { allowed: true } | { allowed: false; cap: number };

/** Call before inserting a message. If `allowed === false`, show the dialog and abort. */
export async function gateSendMessage(): Promise<QuotaGate> {
  if (isProSync()) return { allowed: true };
  const counts = await getCounts();
  if (counts.messages >= FREE_DAILY_MESSAGES) {
    return { allowed: false, cap: FREE_DAILY_MESSAGES };
  }
  return { allowed: true };
}

/** Call before inserting a like. If `allowed === false`, show the dialog and abort. */
export async function gateSendLike(): Promise<QuotaGate> {
  if (isProSync()) return { allowed: true };
  const counts = await getCounts();
  if (counts.likes >= FREE_DAILY_LIKES) {
    return { allowed: false, cap: FREE_DAILY_LIKES };
  }
  return { allowed: true };
}

/** User-facing daily-cap dialog. Always shows an upgrade CTA — the Upgrade
 *  screen handles both the live paywall and the "notify me" preview state. */
export function showFreeLimitDialog(kind: 'messages' | 'likes', cap: number): void {
  const noun = kind === 'messages' ? 'messages' : 'likes';
  showProGateDialog({
    title: `You've used your ${cap} free ${noun} today`,
    message: 'Get unlimited with Africana Pro.',
  });
}

/** Reset on sign-out so a different user doesn't inherit cached counts. */
export function resetFreeQuotaCache(): void {
  cached = null;
  inFlight = null;
}

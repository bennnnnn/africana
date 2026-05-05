import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Shared, ref-counted "typing" broadcast channel per conversation.
 *
 * Why this exists:
 *   Both the Messages tab (to render "typing…" in row previews) and the
 *   open chat screen (to render "Typing…" in the header) want to subscribe
 *   to the same `chat-typing:${convId}` broadcast topic. supabase-js dedupes
 *   channels by topic to a single underlying object, so if either screen
 *   independently calls `supabase.removeChannel(...)` at unmount, the channel
 *   dies for the OTHER screen too — and the next typing send is silently
 *   dropped because the cached reference is now in a torn-down state.
 *
 *   That's exactly the symptom the user reported ("typing is not working"):
 *   navigating from the inbox into a chat caused the inbox's focus-cleanup
 *   to take down the channel the chat screen had just attached to.
 *
 * The fix:
 *   Hand out a single channel per conversation, ref-counted by listener
 *   acquire/release pairs. The underlying channel is created on the first
 *   `acquire` and torn down only when the LAST listener releases.
 */
export type TypingPayload = { userId?: string };
export type TypingListener = (payload: TypingPayload) => void;

interface Entry {
  channel: RealtimeChannel;
  listeners: Set<TypingListener>;
  // 'closing' prevents a new acquire from racing with an async removeChannel
  state: 'active' | 'closing';
}

const entries = new Map<string, Entry>();

function createEntry(conversationId: string): Entry {
  const channel = supabase.channel(`chat-typing:${conversationId}`, {
    // ack:false avoids per-send round-trips; self:false means we don't
    // echo our own broadcasts back to ourselves.
    config: { broadcast: { self: false, ack: false } },
  });

  const listeners = new Set<TypingListener>();
  channel.on('broadcast', { event: 'typing' }, (msg) => {
    const p = (msg.payload ?? {}) as TypingPayload;
    for (const fn of listeners) {
      try {
        fn(p);
      } catch {
        // listener errors must never break sibling listeners
      }
    }
  });

  channel.subscribe((status, err) => {
    // `CLOSED` is normal when the last listener calls `removeChannel` — do not
    // warn (it spams the console on every chat exit / tab switch).
    if (status === 'CLOSED') {
      if (entries.get(conversationId)?.channel === channel) {
        entries.delete(conversationId);
        supabase.removeChannel(channel).catch(() => {});
      }
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const errMsg = err instanceof Error ? err.message : String(err ?? status);
      console.warn(`[typing] ${conversationId} ${status}: ${errMsg}`);

      // Auto-recover: remove the dead entry so the next acquire gets a fresh
      // channel. We don't attempt an immediate re-subscribe here to avoid
      // infinite retry loops on a truly broken connection.
      if (entries.get(conversationId)?.channel === channel) {
        entries.delete(conversationId);
        supabase.removeChannel(channel).catch(() => {});
      }
    }
  });

  const entry: Entry = { channel, listeners, state: 'active' };
  entries.set(conversationId, entry);
  return entry;
}

/**
 * Acquire the typing channel for `conversationId`. Returns the underlying
 * channel (used by senders to call `.send(...)`) and a `release` callback
 * the caller MUST invoke on cleanup.
 *
 * IMPORTANT: `listener` must be a stable reference (wrap in `useCallback`).
 * The dedup check uses reference equality — an unstable function passed on
 * every render will accumulate duplicate handlers in the Set.
 */
export function acquireTypingChannel(
  conversationId: string,
  listener: TypingListener,
): { channel: RealtimeChannel; release: () => void } {
  // Guard against empty/invalid conversation IDs
  if (!conversationId) {
    console.warn('[typing] acquireTypingChannel called with empty conversationId');
    // Return a no-op stub so callers don't need to null-check the return value
    const stub = supabase.channel('chat-typing:__noop__');
    return { channel: stub, release: () => {} };
  }

  let entry = entries.get(conversationId);

  // If the existing entry is being torn down, wait for a fresh one
  if (entry?.state === 'closing') {
    entry = undefined;
  }

  if (!entry) {
    entry = createEntry(conversationId);
  }

  entry.listeners.add(listener);
  const captured = entry;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    captured.listeners.delete(listener);

    if (captured.listeners.size === 0) {
      // Last subscriber for this conversation → tear down the channel.
      // Mark as closing FIRST so a concurrent acquire sees the sentinel and
      // creates a fresh entry rather than reusing a half-torn-down one.
      captured.state = 'closing';
      entries.delete(conversationId);

      // Async teardown — we've already removed the entry so new acquires
      // are unaffected regardless of when removeChannel resolves.
      supabase.removeChannel(captured.channel).catch(() => {});
    }
  };

  return { channel: entry.channel, release };
}

/**
 * Release ALL typing channels (e.g. on logout).
 * Prevents channels from one user session leaking into the next.
 */
export function releaseAllTypingChannels(): void {
  for (const [, entry] of entries) {
    entry.state = 'closing';
    supabase.removeChannel(entry.channel).catch(() => {});
  }
  entries.clear();
}

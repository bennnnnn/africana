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
}

const entries = new Map<string, Entry>();

/**
 * Acquire the typing channel for `conversationId`. Returns the underlying
 * channel (used by senders to call `.send(...)`) and a `release` callback
 * the caller MUST invoke on cleanup.
 */
export function acquireTypingChannel(
  conversationId: string,
  listener: TypingListener,
): { channel: RealtimeChannel; release: () => void } {
  let entry = entries.get(conversationId);

  if (!entry) {
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
      if (
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') &&
        err
      ) {
        console.warn(`[typing] ${conversationId} ${status}: ${err.message}`);
      }
    });

    entry = { channel, listeners };
    entries.set(conversationId, entry);
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
      // We use removeChannel (not unsubscribe) so the SDK clears its internal
      // cache; otherwise a fresh acquire would reuse a torn-down reference.
      supabase.removeChannel(captured.channel).catch(() => {});
      entries.delete(conversationId);
    }
  };

  return { channel: entry.channel, release };
}

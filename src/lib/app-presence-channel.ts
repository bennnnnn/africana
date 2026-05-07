import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { usePresenceStore } from '@/store/presence.store';
import { logWarn } from '@/lib/logger';

const TOPIC = 'app-global-presence-v1';

let channel: RealtimeChannel | null = null;
let joinedUserId: string | null = null;

function applyPresenceState(ch: RealtimeChannel): void {
  const state = ch.presenceState();
  const ids = new Set<string>();
  for (const key of Object.keys(state)) {
    if (key) ids.add(key);
  }
  usePresenceStore.getState().setPeerOnlineIds(ids);
}

/**
 * Join global presence (websocket `track`) — does not write `profiles.last_seen` on an interval.
 * Pair with `leaveAppPresenceChannel` on background / sign-out.
 */
export async function joinAppPresenceChannel(userId: string): Promise<void> {
  if (!userId) return;

  if (joinedUserId === userId && channel) {
    try {
      await channel.track({ online_at: new Date().toISOString() });
      applyPresenceState(channel);
    } catch (e) {
      logWarn('[presence] re-track failed', e);
    }
    return;
  }

  await leaveAppPresenceChannel();

  joinedUserId = userId;
  const ch = supabase.channel(TOPIC, {
    config: { presence: { key: userId } },
  });

  ch.on('presence', { event: 'sync' }, () => applyPresenceState(ch));
  ch.on('presence', { event: 'join' }, () => applyPresenceState(ch));
  ch.on('presence', { event: 'leave' }, () => applyPresenceState(ch));

  channel = ch;

  await new Promise<void>((resolve) => {
    ch.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ online_at: new Date().toISOString() });
          applyPresenceState(ch);
        } catch (e) {
          logWarn('[presence] track failed', e);
        }
        resolve();
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logWarn('[presence] channel error', err ?? status);
        resolve();
      }
    });
  });
}

export async function leaveAppPresenceChannel(): Promise<void> {
  const ch = channel;
  channel = null;
  joinedUserId = null;
  usePresenceStore.getState().setPeerOnlineIds(new Set());
  if (!ch) return;
  try {
    await supabase.removeChannel(ch);
  } catch {
    // ignore
  }
}

export function resetPresenceModuleStateAtLogout(): void {
  void leaveAppPresenceChannel();
}

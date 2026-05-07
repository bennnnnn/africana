import { create } from 'zustand';

/**
 * User IDs currently reported by Supabase Realtime Presence on the global app channel.
 * Updated on sync/join/leave — avoids O(N²) postgres_changes fan-out from profile heartbeats.
 */
type PresenceState = {
  peerOnlineIds: ReadonlySet<string>;
  setPeerOnlineIds: (ids: Set<string>) => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  peerOnlineIds: new Set<string>(),
  setPeerOnlineIds: (ids) => set({ peerOnlineIds: ids }),
}));

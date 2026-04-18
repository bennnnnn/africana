/**
 * Shared store for "unseen activity" counts across the Likes tab + tab bar.
 *
 * Counts are fetched via the `activity_unseen_counts` Postgres RPC (see
 * migration `..._activity_counts.sql`) and kept in sync via realtime
 * subscriptions that both the tab bar badge (`app/(tabs)/_layout.tsx`) and
 * the Likes screen (`app/(tabs)/likes.tsx`) read from.
 *
 * The Likes screen intentionally does NOT expose an outgoing "sent" tab —
 * users care about incoming attention, not a stream of their own outgoing
 * likes (the DB still keeps the `likes` rows for matching).
 */

import { create } from 'zustand';

export type ActivityTab = 'matches' | 'received' | 'viewers' | 'favourites';

const EMPTY_COUNTS: Record<ActivityTab, number> = {
  matches: 0,
  received: 0,
  viewers: 0,
  favourites: 0,
};

interface ActivityState {
  counts: Record<ActivityTab, number>;
  setCounts: (next: Record<ActivityTab, number>) => void;
  clearTab: (tab: ActivityTab) => void;
  clearAll: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  counts: { ...EMPTY_COUNTS },
  setCounts: (next) => set({ counts: next }),
  clearTab: (tab) =>
    set((state) => ({ counts: { ...state.counts, [tab]: 0 } })),
  clearAll: () => set({ counts: { ...EMPTY_COUNTS } }),
}));

/**
 * The number shown in the Likes tab-bar badge — sum of every tracked tab.
 */
export const selectLikesTabBadge = (state: ActivityState): number =>
  state.counts.matches +
  state.counts.received +
  state.counts.viewers +
  state.counts.favourites;

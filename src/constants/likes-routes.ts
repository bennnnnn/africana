import type { LikesTab } from '@/constants/likes-screen';

/**
 * When opening the Likes hub root (`/(tabs)/likes` → index), land on the first
 * tab that still has unseen items so new likes/views/stars surface immediately.
 */
export const LIKES_LANDING_TAB_PRIORITY: LikesTab[] = [
  'received',
  'viewers',
  'favourites',
  'matches',
];

export function pickLandingLikesTab(counts: Record<LikesTab, number>): LikesTab {
  for (const t of LIKES_LANDING_TAB_PRIORITY) {
    if ((counts[t] ?? 0) > 0) return t;
  }
  return 'matches';
}

/** Path segment for `/(tabs)/likes/[tab]` — matches `LIKES_TAB_PATH_SEGMENT` values. */
export type LikesHubPathSegment = 'matches' | 'received' | 'viewers' | 'stars';

export function likesPathSegmentForNotifyType(
  type: 'like' | 'match' | 'view' | 'favourite',
): LikesHubPathSegment {
  switch (type) {
    case 'like':
      return 'received';
    case 'match':
      return 'matches';
    case 'view':
      return 'viewers';
    case 'favourite':
      return 'stars';
    default:
      return 'matches';
  }
}

/** URL segment under `/(tabs)/likes/` (favourites → `stars` for a readable path). */
export const LIKES_TAB_PATH_SEGMENT: Record<LikesTab, string> = {
  matches: 'matches',
  received: 'received',
  viewers: 'viewers',
  favourites: 'stars',
};

export function likesTabFromPathSegment(seg: string | undefined): LikesTab {
  switch (seg) {
    case 'matches':
      return 'matches';
    case 'received':
      return 'received';
    case 'viewers':
      return 'viewers';
    case 'stars':
      return 'favourites';
    case 'likes':
      return 'matches';
    default:
      return 'matches';
  }
}

/**
 * Likes hub uses a single screen (`/(tabs)/likes`) and switches tabs via a
 * query param (`?tab=received`) so the screen is not remounted on each press.
 */
export function likesParamForTab(tab: LikesTab): LikesHubPathSegment {
  return LIKES_TAB_PATH_SEGMENT[tab] as LikesHubPathSegment;
}

import { LIKES_TAB_ORDER, type LikesTab } from '@/constants/likes-screen';

/** Module-scoped pagination (same semantics as the original screen). */
export const _likesTabOffsets: Record<LikesTab, number> = {
  matches: 0,
  received: 0,
  viewers: 0,
  favourites: 0,
};

export const _likesTabHasMore: Record<LikesTab, boolean> = {
  matches: true,
  received: true,
  viewers: true,
  favourites: true,
};

/** @deprecated Use `_likesTabOffsets` (mutable module state). */
export const likesTabOffsets = _likesTabOffsets;
/** @deprecated Use `_likesTabHasMore` (mutable module state). */
export const likesTabHasMore = _likesTabHasMore;

export function resetLikesTabPagination(tab: LikesTab): void {
  _likesTabOffsets[tab] = 0;
  _likesTabHasMore[tab] = true;
}

export function resetAllLikesTabPagination(): void {
  for (const tab of LIKES_TAB_ORDER) {
    resetLikesTabPagination(tab);
  }
}

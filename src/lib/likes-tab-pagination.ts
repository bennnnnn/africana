import type { LikesTab } from '@/constants/likes-screen';

/** Module-scoped pagination (same semantics as the original screen). */
export const likesTabOffsets: Record<LikesTab, number> = {
  matches: 0,
  received: 0,
  viewers: 0,
  favourites: 0,
};

export const likesTabHasMore: Record<LikesTab, boolean> = {
  matches: true,
  received: true,
  viewers: true,
  favourites: true,
};

export function resetLikesTabPagination(tab: LikesTab): void {
  likesTabOffsets[tab] = 0;
  likesTabHasMore[tab] = true;
}

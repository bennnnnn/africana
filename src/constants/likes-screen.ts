import { Ionicons } from '@expo/vector-icons';

export type LikesTab = 'matches' | 'received' | 'viewers' | 'favourites';

export type LikesIonIcon = keyof typeof Ionicons.glyphMap;

export const LIKES_PAGE_SIZE = 20;
export const LIKES_LIST_STALE_MS = 15_000;
export const LIKES_ROW_HEIGHT = 72;

export const LIKES_TAB_ORDER: LikesTab[] = ['matches', 'received', 'viewers', 'favourites'];

export const LIKES_TAB_META: Record<
  LikesTab,
  { label: string; icon: LikesIonIcon; iconActive: LikesIonIcon }
> = {
  matches: { label: 'Matches', icon: 'flame-outline', iconActive: 'flame' },
  received: { label: 'Likes', icon: 'heart-outline', iconActive: 'heart' },
  viewers: { label: 'Views', icon: 'eye-outline', iconActive: 'eye' },
  favourites: { label: 'Stars', icon: 'star-outline', iconActive: 'star' },
};

export const LIKES_EMPTY_STATES: Record<
  LikesTab,
  { icon: LikesIonIcon; title: string; desc: string }
> = {
  matches: {
    icon: 'flame-outline',
    title: 'No matches yet',
    desc: 'Like someone who already liked you to spark a match.',
  },
  received: {
    icon: 'heart-outline',
    title: 'No likes yet',
    desc: 'Complete your profile and add photos to attract more attention.',
  },
  viewers: {
    icon: 'eye-outline',
    title: 'No profile views yet',
    desc: 'A complete profile with a photo gets seen far more often.',
  },
  favourites: {
    icon: 'star-outline',
    title: 'No stars yet',
    desc: 'When someone stars your profile, they appear here.',
  },
};

export const LIKES_SEEN_AT_COLUMN: Record<LikesTab, string> = {
  matches: 'matches_seen_at',
  received: 'likes_seen_at',
  viewers: 'views_seen_at',
  favourites: 'favourites_seen_at',
};

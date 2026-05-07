import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { LIKES_PAGE_SIZE, type LikesTab } from '@/constants/likes-screen';
import { isUuidString } from '@/lib/utils';
import { profileImageUrlForList } from '@/lib/storage-image-url';

export type LikesHubListItem = {
  user: User;
  /** When this activity happened (like / view / star / mutual match time). */
  activityAt: string;
};

export interface LikesFetchResult {
  items: LikesHubListItem[];
  hasMore: boolean;
}

function parseMatchesRpcPayload(data: unknown): LikesHubListItem[] {
  const raw =
    Array.isArray(data) ? data : typeof data === 'string' ? (JSON.parse(data) as unknown) : [];
  if (!Array.isArray(raw)) return [];

  const out: LikesHubListItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.matched_at !== 'string') continue;
    const { matched_at: _m, ...profile } = rec;
    const candidate = profile as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id : undefined;
    if (!isUuidString(id)) continue;
    out.push({ user: candidate as unknown as User, activityAt: rec.matched_at });
  }
  return out;
}

export async function fetchUsersForLikesTab(
  targetTab: LikesTab,
  userId: string,
  blockedSet: Set<string>,
  profileSelect: string,
  offset: number,
): Promise<LikesFetchResult> {
  const from = offset;
  const to = from + LIKES_PAGE_SIZE - 1;
  let items: LikesHubListItem[] = [];

  if (targetTab === 'received') {
    const { data, error } = await supabase
      .from('likes')
      .select(`created_at, from_user:profiles!from_user_id(${profileSelect})`)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data as { created_at?: string; from_user?: User }[] | null | undefined) ?? [];
    items = rows
      .filter((row) => row.from_user && row.created_at && isUuidString(row.from_user.id))
      .map((row) => ({
        user: row.from_user as User,
        activityAt: row.created_at as string,
      }))
      .filter(({ user: u }) => !blockedSet.has(u.id));
  } else if (targetTab === 'viewers') {
    const { data, error } = await supabase
      .from('profile_views')
      .select(`viewed_at, viewer:profiles!viewer_id(${profileSelect})`)
      .eq('viewed_id', userId)
      .order('viewed_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data as { viewed_at?: string; viewer?: User }[] | null | undefined) ?? [];
    items = rows
      .filter((row) => row.viewer && row.viewed_at && isUuidString(row.viewer.id))
      .map((row) => ({
        user: row.viewer as User,
        activityAt: row.viewed_at as string,
      }))
      .filter(({ user: u }) => !blockedSet.has(u.id));
  } else if (targetTab === 'favourites') {
    const { data, error } = await supabase
      .from('favourites')
      .select(`created_at, user:profiles!user_id(${profileSelect})`)
      .eq('favourited_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data as { created_at?: string; user?: User }[] | null | undefined) ?? [];
    items = rows
      .filter((row) => row.user && row.created_at && isUuidString(row.user.id))
      .map((row) => ({
        user: row.user as User,
        activityAt: row.created_at as string,
      }))
      .filter(({ user: u }) => !blockedSet.has(u.id));
  } else {
    const { data, error } = await supabase.rpc('get_matches', {
      p_limit: LIKES_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;
    items = parseMatchesRpcPayload(data).filter(({ user: u }) => !blockedSet.has(u.id));
  }

  return {
    items,
    hasMore: items.length === LIKES_PAGE_SIZE,
  };
}

export function prefetchLikesUserImages(items: LikesHubListItem[]): void {
  const urls = items
    .map((it) => it.user.avatar_url || (it.user.profile_photos ?? [])[0])
    .filter((url): url is string => !!url)
    .map((url) => profileImageUrlForList(url) ?? url);
  if (urls.length > 0) {
    void Image.prefetch(urls);
  }
}

import { Image } from 'expo-image';
import { DEFAULT_AVATAR } from '@/constants';
import { supabase } from '@/lib/supabase';

const MAX_GALLERY_CACHE = 30;
const MAX_PREFETCHED_URIS = 120;

const profileGalleryCache = new Map<string, string[]>();
// Track insertion order so we can evict oldest prefetched URIs.
const prefetchedPhotoUris = new Set<string>();
const _prefetchOrder: string[] = [];

function lruSetGallery(key: string, value: string[]): void {
  profileGalleryCache.delete(key);
  profileGalleryCache.set(key, value);
  if (profileGalleryCache.size > MAX_GALLERY_CACHE) {
    const oldest = profileGalleryCache.keys().next().value;
    if (oldest) profileGalleryCache.delete(oldest);
  }
}

function addPrefetchedUri(uri: string): void {
  if (prefetchedPhotoUris.has(uri)) return;
  prefetchedPhotoUris.add(uri);
  _prefetchOrder.push(uri);
  while (_prefetchOrder.length > MAX_PREFETCHED_URIS) {
    const oldest = _prefetchOrder.shift();
    if (oldest) prefetchedPhotoUris.delete(oldest);
  }
}

export { profileGalleryCache, lruSetGallery as setProfileGalleryCache };

/** Clear in-memory gallery / prefetch state on logout (avoids cross-user leakage on shared devices). */
export function resetProfileGalleryModuleState(): void {
  profileGalleryCache.clear();
  prefetchedPhotoUris.clear();
  _prefetchOrder.length = 0;
}

export function buildFallbackPhotoList(
  fullName?: string | null,
  avatarUrl?: string | null,
): string[] {
  return avatarUrl
    ? [avatarUrl]
    : [`${DEFAULT_AVATAR}${encodeURIComponent((fullName ?? '?').charAt(0))}`];
}

export async function warmPhotoUris(uris: string[]) {
  const nextUris = uris.filter((uri) => !!uri && !prefetchedPhotoUris.has(uri));
  if (nextUris.length === 0) return;
  nextUris.forEach((uri) => addPrefetchedUri(uri));
  await Promise.allSettled(nextUris.map((uri) => Image.prefetch(uri)));
}

export async function loadProfilePhotoList(userId: string): Promise<string[]> {
  const cached = profileGalleryCache.get(userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('profiles')
    .select('profile_photos, avatar_url, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return [];
  const photos = data.profile_photos ?? [];
  const list = photos.length > 0 ? photos : buildFallbackPhotoList(data.full_name, data.avatar_url);

  lruSetGallery(userId, list);
  void warmPhotoUris(list.slice(0, 4));
  return list;
}

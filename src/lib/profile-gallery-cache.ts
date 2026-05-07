import { Image } from 'expo-image';
import { DEFAULT_AVATAR } from '@/constants';
import { supabase } from '@/lib/supabase';

export const profileGalleryCache = new Map<string, string[]>();
const prefetchedPhotoUris = new Set<string>();

/** Clear in-memory gallery / prefetch state on logout (avoids cross-user leakage on shared devices). */
export function resetProfileGalleryModuleState(): void {
  profileGalleryCache.clear();
  prefetchedPhotoUris.clear();
}

export function buildFallbackPhotoList(fullName?: string | null, avatarUrl?: string | null): string[] {
  return avatarUrl
    ? [avatarUrl]
    : [`${DEFAULT_AVATAR}${encodeURIComponent((fullName ?? '?').charAt(0))}`];
}

export async function warmPhotoUris(uris: string[]) {
  const nextUris = uris.filter((uri) => !!uri && !prefetchedPhotoUris.has(uri));
  if (nextUris.length === 0) return;
  nextUris.forEach((uri) => prefetchedPhotoUris.add(uri));
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

  profileGalleryCache.set(userId, list);
  void warmPhotoUris(list.slice(0, 4));
  return list;
}

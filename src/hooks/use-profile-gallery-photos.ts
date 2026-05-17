import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  profileGalleryCache,
  setProfileGalleryCache,
  warmPhotoUris,
  buildFallbackPhotoList,
} from '@/lib/profile-gallery-cache';

export function useProfileGalleryPhotos(userId: string | null) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const cached = profileGalleryCache.get(userId);
    if (cached && cached.length > 0) {
      setPhotos(cached);
      setLoading(false);
      void warmPhotoUris(cached.slice(0, 4));
      return;
    }

    setLoading(true);
    void supabase
      .from('profiles')
      .select('profile_photos, avatar_url, full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPhotos([]);
          setLoading(false);
          return;
        }
        const p = data.profile_photos ?? [];
        const list = p.length > 0 ? p : buildFallbackPhotoList(data.full_name, data.avatar_url);
        setProfileGalleryCache(userId, list);
        setPhotos(list);
        setLoading(false);
        void warmPhotoUris(list.slice(0, 4));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { photos, loading };
}

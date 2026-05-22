import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import type { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth.store';
import { DEFAULT_AVATAR, MAX_PROFILE_PHOTOS } from '@/constants';
import { UI_LABELS } from '@/constants/copy';
import { appDialog } from '@/lib/app-dialog';
import { resolveCountryFromStored } from '@/lib/country-data';
import { validateFacesInPhotos, faceRejectionMessage } from '@/lib/face-detection';
import { uploadToAvatarsBucket } from '@/lib/storage-image-upload';
import { buildMeProfileDisplayModel } from '@/lib/me-profile-display';
import { useMeProfileCultureData } from '@/hooks/use-me-profile-culture-data';
import type { LocationValue } from '@/components/ui/LocationPicker';

const screenWidth = Dimensions.get('window').width;

export function useMeProfileController() {
  const { user, updateProfile, fetchProfile } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      updateProfile: s.updateProfile,
      fetchProfile: s.fetchProfile,
    })),
  );
  const culture = useMeProfileCultureData(user ?? null);

  const heroPhotoScrollRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editSelect, setEditSelect] = useState<string | null>(null);
  const [editMulti, setEditMulti] = useState<string[]>([]);
  const [editBool, setEditBool] = useState<boolean | null>(null);
  const [editHeight, setEditHeight] = useState(170);
  const [editWeight, setEditWeight] = useState(70);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editLocation, setEditLocation] = useState<Partial<LocationValue>>({});
  const [editOriginLocation, setEditOriginLocation] = useState<Partial<LocationValue>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [heroPage, setHeroPage] = useState(0);
  const [listSearch, setListSearch] = useState('');

  useFocusEffect(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- refetch on focus when user id changes
    useCallback(() => {
      if (!user?.id) return;
      void fetchProfile(user.id);
    }, [fetchProfile, user?.id]),
  );

  const avatarForHero = useMemo(() => {
    if (!user) return '';
    return (
      user.avatar_url ||
      (user.profile_photos ?? [])[0] ||
      `${DEFAULT_AVATAR}${encodeURIComponent((user.full_name ?? '?').charAt(0))}`
    );
  }, [user]);

  const heroPhotos = useMemo(() => {
    if (!user) return [] as string[];
    const list = (user.profile_photos ?? [])
      .filter((u) => typeof u === 'string' && u.trim().length > 0)
      .slice(0, MAX_PROFILE_PHOTOS);
    if (list.length > 0) return list;
    return avatarForHero ? [avatarForHero] : [];
  }, [user, avatarForHero]);

  const mainPhotoIndex = useMemo(() => {
    if (!user) return 0;
    const list = user.profile_photos ?? [];
    if (list.length === 0) return 0;
    if (user.avatar_url) {
      const i = list.indexOf(user.avatar_url);
      if (i >= 0) return i;
    }
    return 0;
  }, [user]);

  useEffect(() => {
    if (!user || heroPhotos.length === 0 || screenWidth <= 0) return;
    const idx = Math.min(mainPhotoIndex, heroPhotos.length - 1);
    setHeroPage(idx);
    requestAnimationFrame(() => {
      heroPhotoScrollRef.current?.scrollTo({ x: idx * screenWidth, y: 0, animated: false });
    });
  }, [user?.id, mainPhotoIndex, heroPhotos.length]);

  const display = useMemo(() => (user ? buildMeProfileDisplayModel(user) : null), [user]);

  const close = useCallback(() => {
    setEditing(null);
    setListSearch('');
  }, []);

  const save = useCallback(
    async (updates: Record<string, unknown>) => {
      setSaving(true);
      try {
        await updateProfile(updates);
        close();
      } catch (e: unknown) {
        appDialog({
          title: 'Save failed',
          message: e instanceof Error ? e.message : "Couldn't save changes. Try again.",
          icon: 'alert-circle-outline',
        });
      } finally {
        setSaving(false);
      }
    },
    [updateProfile, close],
  );

  const openText = useCallback((k: string, v: string | null) => {
    setEditing(k);
    setEditText(v ?? '');
    setListSearch('');
  }, []);

  const openSelect = useCallback((k: string, v: string | null | undefined) => {
    setEditing(k);
    setEditSelect(v ?? null);
    setListSearch('');
  }, []);

  const openMulti = useCallback((k: string, v: string[]) => {
    setEditing(k);
    setEditMulti([...v]);
  }, []);

  const openBool = useCallback((k: string, v: boolean | null) => {
    setEditing(k);
    setEditBool(v);
  }, []);

  const openDate = useCallback(() => {
    if (!user) return;
    setEditing('birthdate');
    setEditDate(user.birthdate ? new Date(user.birthdate) : null);
  }, [user]);

  const openLocation = useCallback(() => {
    if (!user) return;
    const countryData = resolveCountryFromStored(user.country ?? '');
    setEditing('location');
    setEditLocation({
      country: user.country ?? '',
      countryCode: countryData?.code ?? '',
      subdivision: user.state ?? '',
      city: user.city ?? '',
    });
  }, [user]);

  const openOriginLocation = useCallback(() => {
    if (!user) return;
    const countryData = resolveCountryFromStored(user.origin_country ?? '');
    setEditing('origin_location');
    setEditOriginLocation({
      country: user.origin_country ?? '',
      countryCode: countryData?.code ?? '',
      subdivision: user.origin_state ?? '',
      city: user.origin_city ?? '',
    });
  }, [user]);

  const confirmRemovePhoto = useCallback(
    (photoUrl: string) => {
      if (!user) return;
      appDialog({
        title: 'Remove photo',
        message: 'Remove this photo from your profile?',
        icon: 'trash-outline',
        actions: [
          { label: UI_LABELS.cancel, style: 'cancel' },
          {
            label: UI_LABELS.delete,
            style: 'destructive',
            onPress: async () => {
              const current = user.profile_photos ?? [];
              const updated = current.filter((p) => p !== photoUrl);
              try {
                await updateProfile({
                  profile_photos: updated,
                  avatar_url: updated[0] ?? null,
                });
              } catch (e: unknown) {
                appDialog({
                  title: 'Remove failed',
                  message:
                    e instanceof Error ? e.message : "Couldn't remove the photo. Try again.",
                  icon: 'alert-circle-outline',
                });
              }
            },
          },
        ],
      });
    },
    [user, updateProfile],
  );

  const pickAndUploadPhoto = useCallback(async () => {
    if (!user) return;
    const currentPhotos = user.profile_photos ?? [];
    const remaining = MAX_PROFILE_PHOTOS - currentPhotos.length;
    if (remaining <= 0) {
      appDialog({
        title: 'Photo limit',
        message: `You can have up to ${MAX_PROFILE_PHOTOS} photos. Long press a photo below to remove one.`,
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setPhotoUploading(true);
    try {
      const picked = result.assets.slice(0, remaining);
      const { approved, rejected } = await validateFacesInPhotos(picked.map((a) => a.uri));
      if (rejected.length > 0) {
        const { title, message } = faceRejectionMessage(rejected.length, approved.length);
        appDialog({ title, message, icon: 'happy-outline' });
      }
      const toUpload = picked.filter((a) => approved.includes(a.uri));
      if (toUpload.length === 0) {
        setPhotoUploading(false);
        return;
      }

      const uploaded: string[] = [];
      for (const asset of toUpload) {
        const out = await uploadToAvatarsBucket(user.id, asset.uri, asset.mimeType);
        if (!('error' in out)) uploaded.push(out.publicUrl);
      }
      if (uploaded.length === 0) throw new Error("Couldn't upload photos. Try again.");
      const updatedPhotos = [...currentPhotos, ...uploaded];
      await updateProfile({
        profile_photos: updatedPhotos,
        avatar_url: currentPhotos.length === 0 ? updatedPhotos[0] : user.avatar_url,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't upload photos. Try again.";
      appDialog({ title: 'Upload failed', message: msg, icon: 'cloud-offline-outline' });
    } finally {
      setPhotoUploading(false);
    }
  }, [user, updateProfile]);

  const openEthnicity = useCallback(async () => {
    if (!user) return;
    setEditing('ethnicity');
    setEditText(user.ethnicity ?? '');
    setListSearch('');
    await culture.loadCultureData();
  }, [user, culture.loadCultureData]);

  const openLanguages = useCallback(async () => {
    if (!user) return;
    setEditing('languages');
    setEditMulti([...(user.languages ?? [])]);
    setListSearch('');
    await culture.loadCultureData();
  }, [user, culture.loadCultureData]);

  const openHeight = useCallback(() => {
    if (!user) return;
    setEditing('height');
    setEditHeight(user.height_cm ?? 170);
  }, [user]);

  const openWeight = useCallback(() => {
    if (!user) return;
    setEditing('weight_kg');
    setEditWeight(user.weight_kg ?? 70);
  }, [user]);

  return {
    user,
    display,
    heroPhotoScrollRef,
    heroPhotos,
    heroPage,
    setHeroPage,
    screenWidth,
    saving,
    editing,
    editText,
    setEditText,
    editSelect,
    setEditSelect,
    editMulti,
    setEditMulti,
    editBool,
    setEditBool,
    editHeight,
    setEditHeight,
    editWeight,
    setEditWeight,
    editDate,
    setEditDate,
    editLocation,
    setEditLocation,
    editOriginLocation,
    setEditOriginLocation,
    photoUploading,
    listSearch,
    setListSearch,
    close,
    save,
    openText,
    openSelect,
    openMulti,
    openBool,
    openDate,
    openLocation,
    openOriginLocation,
    confirmRemovePhoto,
    pickAndUploadPhoto,
    openEthnicity,
    openLanguages,
    openHeight,
    openWeight,
    cultureEthnicityOpts: culture.cultureEthnicityOpts,
    cultureLanguageOpts: culture.cultureLanguageOpts,
    cultureLoading: culture.cultureLoading,
  };
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Share,
  Pressable,
  PanResponder,
  FlatList,
  useWindowDimensions,
  StatusBar,
  Platform,
  InteractionManager,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth.store';
import { MOCK_USERS } from '@/lib/mock-data';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { User } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, DEFAULT_AVATAR, FONT, GENDER_OPTIONS, INTERESTED_IN_OPTIONS, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, LOOKING_FOR_OPTIONS, WANT_CHILDREN_YES_NO, OCCUPATION_OPTIONS, PHYSICAL_CONDITION_OPTIONS, RADIUS, SHADOWS } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { MatchModal } from '@/components/ui/MatchModal';
import { calculateAge, getEffectiveAgePreferenceRange } from '@/lib/utils';

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female' };
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;
const profileGalleryCache = new Map<string, string[]>();
const prefetchedPhotoUris = new Set<string>();

const FLOAT_ACTION_SIZE = 56;
const floatingActionCircle = {
  width: FLOAT_ACTION_SIZE,
  height: FLOAT_ACTION_SIZE,
  borderRadius: FLOAT_ACTION_SIZE / 2,
  backgroundColor: COLORS.white,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  ...SHADOWS.md,
};

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return undefined;
}

function buildFallbackPhotoList(fullName?: string | null, avatarUrl?: string | null): string[] {
  return avatarUrl
    ? [avatarUrl]
    : [`${DEFAULT_AVATAR}${encodeURIComponent((fullName ?? '?').charAt(0))}`];
}

async function warmPhotoUris(uris: string[]) {
  const nextUris = uris.filter((uri) => !!uri && !prefetchedPhotoUris.has(uri));
  if (nextUris.length === 0) return;
  nextUris.forEach((uri) => prefetchedPhotoUris.add(uri));
  await Promise.allSettled(nextUris.map((uri) => Image.prefetch(uri)));
}

async function loadProfilePhotoList(userId: string): Promise<string[]> {
  const cached = profileGalleryCache.get(userId);
  if (cached) return cached;

  let list: string[];
  if (userId.startsWith('mock-')) {
    const mock = MOCK_USERS.find((u) => u.id === userId);
    list =
      mock?.profile_photos && mock.profile_photos.length > 0
        ? mock.profile_photos
        : buildFallbackPhotoList(mock?.full_name, mock?.avatar_url);
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_photos, avatar_url, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return [];
    const photos = data.profile_photos ?? [];
    list = photos.length > 0 ? photos : buildFallbackPhotoList(data.full_name, data.avatar_url);
  }

  profileGalleryCache.set(userId, list);
  void warmPhotoUris(list.slice(0, 4));
  return list;
}

function useProfileGalleryPhotos(userId: string | null) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (String(userId).startsWith('mock-')) {
      const m = MOCK_USERS.find((u) => u.id === userId);
      const list =
        m?.profile_photos && m.profile_photos.length > 0
          ? m.profile_photos
          : m?.avatar_url
            ? [m.avatar_url]
            : [`${DEFAULT_AVATAR}${encodeURIComponent((m?.full_name ?? '?').charAt(0))}`];
      setPhotos(list);
      setLoading(false);
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
        const list =
          p.length > 0
            ? p
            : data.avatar_url
              ? [data.avatar_url]
              : [`${DEFAULT_AVATAR}${encodeURIComponent((data.full_name ?? '?').charAt(0))}`];
        setPhotos(list);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { photos, loading };
}

function ProfilePhotoGalleryPage({
  userId,
  winWidth,
  winHeight,
  activePhotoIndex,
  dotBottom,
  onHorizontalIndexChange,
}: {
  userId: string;
  winWidth: number;
  winHeight: number;
  activePhotoIndex: number;
  dotBottom: number;
  onHorizontalIndexChange: (i: number) => void;
}) {
  const { photos, loading } = useProfileGalleryPhotos(userId);
  const clampedIndex = Math.min(activePhotoIndex, Math.max(photos.length - 1, 0));

  useEffect(() => {
    if (loading) return;
    if (clampedIndex !== activePhotoIndex) {
      onHorizontalIndexChange(clampedIndex);
    }
  }, [activePhotoIndex, clampedIndex, loading, onHorizontalIndexChange]);

  if (loading) {
    return (
      <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }
  if (photos.length === 0) {
    return <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000' }} />;
  }

  return (
    <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000' }}>
      <View style={{ width: winWidth, height: winHeight, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={{ uri: photos[clampedIndex] }}
          style={{ width: winWidth, height: winHeight }}
          contentFit="cover"
          transition={180}
        />
      </View>
      {photos.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: dotBottom,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {photos.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === clampedIndex ? 22 : 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: i === clampedIndex ? '#FFF' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReadOnlyRow({ icon, label, value, isLast }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null | undefined; isLast?: boolean;
}) {
  const filled = !!value;
  return (
    <View style={[pr.fieldRow, isLast && pr.fieldRowLast]}>
      <View style={[pr.fieldIcon, !filled && pr.fieldIconEmpty]}>
        <Ionicons name={icon} size={16} color={filled ? COLORS.primary : COLORS.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={pr.fieldLabel}>{label}</Text>
        <Text style={[pr.fieldValue, !filled && pr.fieldValueEmpty]}>
          {value ?? '—'}
        </Text>
      </View>
    </View>
  );
}

type ProfileWithAgePrefs = User & { min_age_pref?: number | null; max_age_pref?: number | null };

function isMeaningfulText(value: string | null | undefined): boolean {
  const n = value?.trim();
  return !!n && n !== '-' && n !== '—';
}

export default function ProfileViewScreen() {
  const {
    id: rawId,
    viewer: rawViewer,
    photo: rawPhoto,
  } = useLocalSearchParams<{ id: string | string[]; viewer?: string | string[]; photo?: string | string[] }>();
  const id = normalizeParam(rawId);
  const viewerParam = normalizeParam(rawViewer);
  const photoParam = normalizeParam(rawPhoto);
  const routeWantsPhotoViewer = viewerParam === '1';
  const routePhotoIndex = Math.max(0, Number.parseInt(photoParam ?? '0', 10) || 0);
  const { user: currentUser } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const heroPhotoScrollRef = useRef<FlatList<string> | null>(null);
  const prevProfileIdInPhotoViewerRef = useRef<string | null>(null);
  const photoViewerSwipeX = useRef(new Animated.Value(0)).current;
  const photoViewerSwipeY = useRef(new Animated.Value(0)).current;

  const orderedUserIds = useProfileBrowseStore((s) => s.orderedUserIds);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(routeWantsPhotoViewer);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState(routePhotoIndex);

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [compatibilityExpanded, setCompatibilityExpanded] = useState(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<typeof REPORT_REASONS[number] | null>(null);
  const [reportValidationVisible, setReportValidationVisible] = useState(false);
  const [blockPromptVisible, setBlockPromptVisible] = useState(false);

  // Toast
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState<{ icon: string; msg: string } | null>(null);
  const showToast = (icon: string, msg: string) => {
    setToast({ icon, msg });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  useEffect(() => {
    setCompatibilityExpanded(false);
    setIsFavourite(false);
    setReportPromptVisible(false);
    setSelectedReportReason(null);
    setReportValidationVisible(false);
    setBlockPromptVisible(false);
  }, [id]);

  useEffect(() => {
    setPhotoViewerVisible(routeWantsPhotoViewer);
    if (routeWantsPhotoViewer) {
      setViewerPhotoIndex(routePhotoIndex);
    }
  }, [routePhotoIndex, routeWantsPhotoViewer, id]);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setProfile(null);

    // Serve mock data instantly for mock user IDs (no DB round-trip needed)
    if (String(id).startsWith('mock-')) {
      const today = new Date();
      const mock = MOCK_USERS.find((u) => u.id === id);
      if (mock) {
        const bday = mock.birthdate ? new Date(mock.birthdate) : null;
        const age = bday
          ? today.getFullYear() - bday.getFullYear()
            - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
          : undefined;
        setProfile({ ...mock, age, profile_photos: mock.profile_photos ?? [], languages: mock.languages ?? [] });
      }
      setIsLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileView] load profile:', error.message);
          setProfile(null);
          setIsLoading(false);
          return;
        }
        if (data) {
          const today = new Date();
          const bday = data.birthdate ? new Date(data.birthdate) : null;
          const age = bday
            ? today.getFullYear() - bday.getFullYear()
              - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : undefined;
          setProfile({
            ...data,
            age,
            profile_photos: data.profile_photos ?? [],
            languages: data.languages ?? [],
            looking_for: data.looking_for ?? [],
            hobbies: data.hobbies ?? [],
          });
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      });
  }, [id]);

  // Record view + notify once we know both profile and viewer (session can resolve after first paint)
  useEffect(() => {
    if (!profile || !currentUser?.id || currentUser.id === profile.id) return;
    if (String(profile.id).startsWith('mock-')) return;

    void supabase.from('profile_views').upsert(
      { viewer_id: currentUser.id, viewed_id: profile.id, viewed_at: new Date().toISOString() },
      { onConflict: 'viewer_id,viewed_id' },
    );
    notifyUser({
      type: 'view',
      recipientId: profile.id,
      senderId: currentUser.id,
      senderName: currentUser.full_name ?? 'Someone',
      extra: { userId: currentUser.id },
    });
  }, [profile?.id, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !id || currentUser.id === id || String(id).startsWith('mock-')) return;
    void fetchLikedUserIds(currentUser.id);
  }, [currentUser?.id, id, fetchLikedUserIds]);

  useEffect(() => {
    if (!currentUser || !profile || currentUser.id === profile.id) return;
    supabase
      .from('favourites')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('favourited_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [currentUser?.id, profile?.id]);

  useEffect(() => {
    if (!photoViewerVisible) {
      StatusBar.setHidden(false);
      return undefined;
    }
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, [photoViewerVisible]);

  const adjacentBrowse = useMemo(() => {
    if (!profile?.id) return { pages: [] as string[], initialIndex: 0 };
    const i = orderedUserIds.indexOf(profile.id);
    if (orderedUserIds.length < 2 || i < 0) {
      return { pages: [profile.id], initialIndex: 0 };
    }
    const prevId = i > 0 ? orderedUserIds[i - 1]! : null;
    const nextId = i < orderedUserIds.length - 1 ? orderedUserIds[i + 1]! : null;
    const pages = [prevId, profile.id, nextId].filter((x): x is string => x != null);
    const initialIndex = prevId ? 1 : 0;
    return { pages, initialIndex };
  }, [profile?.id, orderedUserIds]);

  useEffect(() => {
    if (!photoViewerVisible || !profile) return;
    if (prevProfileIdInPhotoViewerRef.current && prevProfileIdInPhotoViewerRef.current !== profile.id) {
      setViewerPhotoIndex(routePhotoIndex);
    }
    prevProfileIdInPhotoViewerRef.current = profile.id;
  }, [photoViewerVisible, profile?.id, routePhotoIndex]);

  useEffect(() => {
    const idsToWarm = adjacentBrowse.pages.filter(Boolean);
    if (idsToWarm.length === 0) return;
    void Promise.allSettled(idsToWarm.map((uid) => loadProfilePhotoList(uid)));
  }, [adjacentBrowse.pages.join('|')]);

  useEffect(() => {
    if (!profile) return;
    const safePhotos = profile.profile_photos ?? [];
    const photosToWarm = safePhotos.length > 0
      ? safePhotos
      : [profile.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`];
    void warmPhotoUris(photosToWarm.slice(0, 4));
  }, [profile]);

  const safePhotos = profile?.profile_photos ?? [];
  const photos = profile
    ? (safePhotos.length > 0
      ? safePhotos
      : [profile.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`])
    : [];

  const replaceProfileRoute = useCallback((
    nextUserId: string,
    options?: { openPhotoViewer?: boolean; photoIndex?: number },
  ) => {
    router.replace({
      pathname: '/(profile)/[id]',
      params: options?.openPhotoViewer
        ? { id: nextUserId, viewer: '1', photo: String(options.photoIndex ?? 0) }
        : { id: nextUserId },
    });
  }, []);

  const browseIndex = profile ? orderedUserIds.indexOf(profile.id) : -1;
  const galleryHasPrevProfile = browseIndex > 0;
  const galleryHasNextProfile = browseIndex >= 0 && browseIndex < orderedUserIds.length - 1;

  const goPrevProfileInGallery = useCallback(() => {
    const pid = profile?.id;
    if (!pid) return;
    const ids = useProfileBrowseStore.getState().orderedUserIds;
    const i = ids.indexOf(pid);
    if (i <= 0) return;
    replaceProfileRoute(ids[i - 1]!, { openPhotoViewer: true, photoIndex: viewerPhotoIndex });
  }, [profile?.id, replaceProfileRoute, viewerPhotoIndex]);

  const goNextProfileInGallery = useCallback(() => {
    const pid = profile?.id;
    if (!pid) return;
    const ids = useProfileBrowseStore.getState().orderedUserIds;
    const i = ids.indexOf(pid);
    if (i < 0 || i >= ids.length - 1) return;
    replaceProfileRoute(ids[i + 1]!, { openPhotoViewer: true, photoIndex: viewerPhotoIndex });
  }, [profile?.id, replaceProfileRoute, viewerPhotoIndex]);

  const resetPhotoViewerSwipe = useCallback(() => {
    Animated.parallel([
      Animated.spring(photoViewerSwipeX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 9,
      }),
      Animated.spring(photoViewerSwipeY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 9,
      }),
    ]).start();
  }, [photoViewerSwipeX, photoViewerSwipeY]);

  const photoViewerPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      photoViewerVisible &&
      (Math.abs(gestureState.dy) > 16 || Math.abs(gestureState.dx) > 16),
    onPanResponderGrant: () => {
      photoViewerSwipeX.stopAnimation();
      photoViewerSwipeY.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      if (horizontal) {
        const clampedX = Math.max(-120, Math.min(120, gestureState.dx * 0.35));
        photoViewerSwipeX.setValue(clampedX);
        photoViewerSwipeY.setValue(0);
      } else {
        const clampedY = Math.max(-120, Math.min(120, gestureState.dy * 0.38));
        photoViewerSwipeY.setValue(clampedY);
        photoViewerSwipeX.setValue(0);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      if (horizontal) {
        const triggerX = 56;
        if (gestureState.dx <= -triggerX && viewerPhotoIndex < photos.length - 1) {
          setViewerPhotoIndex((prev) => prev + 1);
          resetPhotoViewerSwipe();
          return;
        }
        if (gestureState.dx >= triggerX && viewerPhotoIndex > 0) {
          setViewerPhotoIndex((prev) => prev - 1);
          resetPhotoViewerSwipe();
          return;
        }
        resetPhotoViewerSwipe();
        return;
      }

      const trigger = 72;
      if (gestureState.dy <= -trigger && galleryHasNextProfile) {
        photoViewerSwipeX.setValue(0);
        photoViewerSwipeY.setValue(0);
        goNextProfileInGallery();
        return;
      }
      if (gestureState.dy >= trigger && galleryHasPrevProfile) {
        photoViewerSwipeX.setValue(0);
        photoViewerSwipeY.setValue(0);
        goPrevProfileInGallery();
        return;
      }
      resetPhotoViewerSwipe();
    },
    onPanResponderTerminate: () => {
      resetPhotoViewerSwipe();
    },
  }), [
    galleryHasNextProfile,
    galleryHasPrevProfile,
    goNextProfileInGallery,
    goPrevProfileInGallery,
    photos.length,
    photoViewerSwipeX,
    photoViewerSwipeY,
    photoViewerVisible,
    resetPhotoViewerSwipe,
    viewerPhotoIndex,
  ]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Profile not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  const religionLabel    = profile.religion       ? RELIGION_OPTIONS.find(r => r.value === profile.religion)?.label            ?? profile.religion       : null;
  const educationLabel   = profile.education      ? EDUCATION_OPTIONS.find(e => e.value === profile.education)?.label           ?? profile.education      : null;
  const maritalLabel     = profile.marital_status ? MARITAL_STATUS_OPTIONS.find(m => m.value === profile.marital_status)?.label ?? profile.marital_status : null;
  const wantChildLabel    = profile.want_children  ? WANT_CHILDREN_YES_NO.find(o => o.value === profile.want_children)?.label   ?? profile.want_children  : null;
  const bodyTypeLabel    = profile.body_type      ? PHYSICAL_CONDITION_OPTIONS.find(o => o.value === profile.body_type)?.label ?? profile.body_type : null;
  const occupationLabel   = profile.occupation     ? OCCUPATION_OPTIONS.find(o => o.value === profile.occupation)?.label ?? profile.occupation    : null;
  const interestedInLabel =
    profile.interested_in === 'everyone'
      ? 'Everyone'
      : INTERESTED_IN_OPTIONS.find((o) => o.value === profile.interested_in)?.label ?? profile.interested_in ?? null;

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;
  const displayOnlineStatus: 'online' | 'offline' =
    !isOwnProfile && profile.online_visible === false
      ? 'offline'
      : profile.online_status === 'online'
        ? 'online'
        : 'offline';

  const recipientMessagesPaused = !isOwnProfile && profile.accepts_messages === false;

  const photoModalDotBottom =
    !isOwnProfile && currentUser
      ? Math.max(insets.bottom + FLOAT_ACTION_SIZE + 28, 94)
      : Math.max(insets.bottom + 16, 24);

  const p = profile as ProfileWithAgePrefs;
  const normalizeText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
  const viewerLanguages = new Set((currentUser?.languages ?? []).map((lang) => normalizeText(lang)).filter(Boolean));
  const effectiveTheirAgePref = getEffectiveAgePreferenceRange(p.min_age_pref, p.max_age_pref);
  const viewerAge = calculateAge(currentUser?.birthdate) ?? null;
  const profileFirstName = profile.full_name?.trim().split(/\s+/)[0] ?? 'Their';

  type CompatibilityCriterion = {
    key: string;
    label: string;
    viewerValue: string;
    matched: boolean;
  };
  const compatibilityCriteria: CompatibilityCriterion[] = [];
  const pushCompatibility = (
    key: string,
    label: string,
    theirValue: string | null | undefined,
    viewerValue: string | null | undefined,
    matched: boolean,
  ) => {
    if (!theirValue || !viewerValue) return;
    compatibilityCriteria.push({ key, label, viewerValue, matched });
  };

  const LOOKING_SINGLE: Record<string, string> = { men: 'Male', women: 'Female' };
  const theirLookingFor =
    p.interested_in === 'men' || p.interested_in === 'women' ? LOOKING_SINGLE[p.interested_in] : null;
  const genderPrefMatch =
    !!p.interested_in &&
    (p.interested_in === 'men' || p.interested_in === 'women') &&
    !!currentUser?.gender &&
    ((p.interested_in === 'men' && currentUser.gender === 'male') ||
      (p.interested_in === 'women' && currentUser.gender === 'female'));
  pushCompatibility(
    'gender',
    'Looking for',
    theirLookingFor,
    currentUser?.gender ? GENDER_LABEL[currentUser.gender] ?? currentUser.gender : null,
    genderPrefMatch,
  );

  if (!effectiveTheirAgePref.isImplicit) {
    pushCompatibility(
      'age',
      'Age they prefer',
      `${effectiveTheirAgePref.min}–${effectiveTheirAgePref.max} yrs`,
      typeof viewerAge === 'number' ? `${viewerAge} yrs` : null,
      typeof viewerAge === 'number' &&
        viewerAge >= effectiveTheirAgePref.min &&
        viewerAge <= effectiveTheirAgePref.max,
    );
  }

  const viewerGoalLabels = (currentUser?.looking_for ?? [])
    .map((goal) => LOOKING_FOR_OPTIONS.find((option) => option.value === goal)?.label ?? goal.replace('_', ' '))
    .filter(Boolean);
  const profileGoalLabels = (p.looking_for ?? [])
    .map((goal) => LOOKING_FOR_OPTIONS.find((option) => option.value === goal)?.label ?? goal.replace('_', ' '))
    .filter(Boolean);
  const hasGoalOverlap = (currentUser?.looking_for ?? []).some((goal) => (p.looking_for ?? []).includes(goal));
  pushCompatibility(
    'relation_type',
    'Goals',
    profileGoalLabels.join(', '),
    viewerGoalLabels.join(', '),
    hasGoalOverlap,
  );

  pushCompatibility(
    'religion',
    'Religion',
    religionLabel,
    currentUser?.religion
      ? RELIGION_OPTIONS.find((option) => option.value === currentUser.religion)?.label ?? currentUser.religion
      : null,
    !!currentUser?.religion && !!p.religion && currentUser.religion === p.religion,
  );

  const viewerWantChildrenLabel = currentUser?.want_children
    ? WANT_CHILDREN_YES_NO.find((option) => option.value === currentUser.want_children)?.label ?? currentUser.want_children
    : null;
  const wantLabelRow = p.want_children
    ? WANT_CHILDREN_YES_NO.find((o) => o.value === p.want_children)?.label ?? p.want_children
    : '';
  pushCompatibility(
    'want_children',
    'Want children',
    wantLabelRow || null,
    viewerWantChildrenLabel,
    !!currentUser?.want_children && !!p.want_children && currentUser.want_children === p.want_children,
  );

  const sharedLanguages = (p.languages ?? []).filter((lang) => viewerLanguages.has(normalizeText(lang)));
  pushCompatibility(
    'languages',
    'Languages',
    (p.languages ?? []).join(', '),
    (currentUser?.languages ?? []).join(', '),
    sharedLanguages.length > 0,
  );

  pushCompatibility(
    'ethnicity',
    'Ethnicity',
    isMeaningfulText(p.ethnicity) ? (p.ethnicity ?? '').trim() : null,
    isMeaningfulText(currentUser?.ethnicity) ? (currentUser?.ethnicity ?? '').trim() : null,
    isMeaningfulText(currentUser?.ethnicity) &&
      isMeaningfulText(p.ethnicity) &&
      normalizeText(currentUser?.ethnicity) === normalizeText(p.ethnicity),
  );

  const matchedCriteriaCount = compatibilityCriteria.filter((c) => c.matched).length;
  const compatibilityPercent =
    compatibilityCriteria.length > 0
      ? Math.round((matchedCriteriaCount / compatibilityCriteria.length) * 100)
      : null;
  const canShowCompatibility = !isOwnProfile && currentUser && compatibilityCriteria.length > 0;

  const handleLike = async () => {
    if (!currentUser) return;
    const wasLiked = likedUserIds.has(profile.id);
    const isMatch = await toggleLike(currentUser.id, profile.id);
    if (isMatch && !wasLiked) {
      setMatchUser(profile);
      showToast('🔥', 'It’s a match!');
    } else {
      showToast(wasLiked ? '💔' : '❤️', wasLiked ? 'Unliked' : 'Liked!');
    }
  };

  const handleMessage = async () => {
    if (!currentUser || recipientMessagesPaused) return;
    if (photoViewerVisible) {
      setPhotoViewerVisible(false);
    }
    const convId = await getOrCreateConversation(currentUser.id, profile.id);
    if (!convId) return;
    const peerId = profile.id;
    InteractionManager.runAfterInteractions(() => {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: peerId } });
    });
  };

  const handleFavourite = async () => {
    if (!currentUser) return;
    if (isFavourite) {
      await supabase
        .from('favourites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('favourited_id', profile.id);
      setIsFavourite(false);
      showToast('⭐', 'Removed from favourites');
    } else {
      await supabase
        .from('favourites')
        .insert({ user_id: currentUser.id, favourited_id: profile.id });
      setIsFavourite(true);
      showToast('⭐', 'Added to favourites');
    }
  };

  const openPhotoViewer = (index: number) => {
    setViewerPhotoIndex(index);
    setPhotoViewerVisible(true);
    router.setParams({ viewer: '1', photo: String(index) });
  };

  const closePhotoViewer = () => {
    prevProfileIdInPhotoViewerRef.current = null;
    setPhotoIndex(viewerPhotoIndex);
    requestAnimationFrame(() => {
      heroPhotoScrollRef.current?.scrollToOffset({
        offset: viewerPhotoIndex * winWidth,
        animated: false,
      });
    });
    setPhotoViewerVisible(false);
    router.setParams({ viewer: undefined, photo: undefined });
  };

  const handleBlock = () => {
    setBlockPromptVisible(true);
  };

  const handleReport = () => {
    setSelectedReportReason(null);
    setReportValidationVisible(false);
    setReportPromptVisible(true);
  };

  const confirmBlockUser = async () => {
    if (!currentUser) return;
    await supabase.from('blocks').insert({
      blocker_id: currentUser.id,
      blocked_id: profile.id,
    });
    setBlockPromptVisible(false);
    showToast('🚫', `${profile.full_name} blocked`);
    setTimeout(() => router.back(), 1300);
  };

  const submitReport = async () => {
    if (!currentUser) return;
    if (!selectedReportReason) {
      setReportValidationVisible(true);
      return;
    }
    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: profile.id,
      reason: selectedReportReason,
    });
    setReportPromptVisible(false);
    setSelectedReportReason(null);
    setReportValidationVisible(false);
    showToast('🚩', 'Report submitted. Thank you.');
  };

  const toastOverlay = toast ? (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        zIndex: 999,
        top: 80,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(17,17,17,0.88)',
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 30,
        opacity: toastAnim,
        transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{toast.msg}</Text>
    </Animated.View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {!photoViewerVisible ? toastOverlay : null}
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        bounces
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: COLORS.surface,
          paddingBottom:
            !isOwnProfile && currentUser
              ? Math.max(insets.bottom + FLOAT_ACTION_SIZE + 36, 108)
              : Math.max(insets.bottom + 24, 32),
        }}
      >
        {/* Photo Carousel — rounded bottom for handoff into identity card */}
        <View style={{ position: 'relative', backgroundColor: '#000', overflow: 'hidden', borderBottomLeftRadius: RADIUS.xxl, borderBottomRightRadius: RADIUS.xxl }}>
          <FlatList
            ref={heroPhotoScrollRef}
            data={photos}
            keyExtractor={(photo, index) => `${photo}-${index}`}
            horizontal
            pagingEnabled
            directionalLockEnabled={Platform.OS === 'ios'}
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            onMomentumScrollEnd={(e) => {
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / winWidth));
            }}
            renderItem={({ item: photo, index: i }) => (
              <Pressable
                onPress={() => openPhotoViewer(i)}
                style={{ width: winWidth, height: winWidth * 1.1 }}
              >
                <Image
                  source={{ uri: photo }}
                  style={{ width: winWidth, height: winWidth * 1.1 }}
                  contentFit="cover"
                  transition={180}
                />
              </Pressable>
            )}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.60)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' }}
          />

          {/* Photo dots */}
          {photos.length > 1 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 28,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === photoIndex ? 20 : 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: i === photoIndex ? '#FFF' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          )}

          {/* Back button + report/block — row at top of photo */}
          <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleReport}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleBlock}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="ban-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>

        {/* Identity — overlaps hero */}
        <View style={pr.identityCard}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <Text style={pr.displayName}>
              {profile.full_name}
              {profile.age ? <Text style={pr.displayAge}>, {profile.age}</Text> : null}
            </Text>
            <View
              style={[
                pr.onlineBadge,
                { backgroundColor: displayOnlineStatus === 'online' ? `${COLORS.online}16` : COLORS.savanna },
              ]}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: displayOnlineStatus === 'online' ? COLORS.online : COLORS.textMuted }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: displayOnlineStatus === 'online' ? COLORS.online : COLORS.textSecondary }}>
                {displayOnlineStatus === 'online' ? 'Online' : `Last seen ${formatLastSeen(profile.last_seen)}`}
              </Text>
            </View>
          </View>

          {location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <View style={pr.locationIconWrap}>
                <Ionicons name="location" size={14} color={COLORS.primary} />
              </View>
              <Text style={pr.locationText}>{location}</Text>
            </View>
          ) : null}

          {(profile.looking_for ?? []).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {(profile.looking_for ?? []).map((lf) => (
                <View key={lf} style={pr.chipLooking}>
                  <Text style={pr.chipLookingText}>
                    {LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf.replace('_', ' ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {profile.bio ? (
            <View style={pr.aboutBlock}>
              <View style={pr.aboutAccent} />
              <View style={{ flex: 1 }}>
                <Text style={pr.aboutLabel}>About</Text>
                <Text style={pr.aboutBody}>{profile.bio}</Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: `${COLORS.savanna}88`, borderRadius: RADIUS.md }}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 21 }}>
                {isOwnProfile
                  ? 'You haven’t added a bio yet — edit your profile from Me to tell your story.'
                  : 'No bio yet — say hi and get the conversation started.'}
              </Text>
            </View>
          )}
        </View>

        {canShowCompatibility && compatibilityPercent !== null && (
          <View style={pr.compatibilityCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCompatibilityExpanded((prev) => !prev)}
              style={{ paddingVertical: 2 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={pr.compatibilityRing}>
                  <Text style={pr.compatibilityPercent}>{compatibilityPercent}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pr.compatibilityKicker}>Compatibility</Text>
                  <Text style={pr.compatibilityTitle}>
                    {matchedCriteriaCount} of {compatibilityCriteria.length} in common
                  </Text>
                  <Text style={pr.compatibilitySub}>
                    How their preferences line up with yours.
                  </Text>
                </View>
                <Ionicons
                  name={compatibilityExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={COLORS.primary}
                />
              </View>
            </TouchableOpacity>

            {compatibilityExpanded && (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingBottom: 10 }}>
                  <Text style={{ width: 88, fontSize: 11, fontWeight: '700', color: COLORS.textMuted }}>
                    {profileFirstName}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textAlign: 'right' }}>
                    You
                  </Text>
                </View>
                {compatibilityCriteria.map((criterion, index) => (
                  <View key={criterion.key}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 14 }}>
                      <View style={{ width: 88, paddingRight: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>
                          {criterion.label}:
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 6 }}>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              fontWeight: criterion.matched ? '700' : '600',
                              color: criterion.matched ? COLORS.text : '#C45A5A',
                              fontStyle: criterion.matched ? 'normal' : 'italic',
                              textDecorationLine: criterion.matched ? 'none' : 'line-through',
                            }}
                            numberOfLines={5}
                          >
                            {criterion.viewerValue}
                          </Text>
                          {criterion.matched ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={COLORS.success}
                              style={{ marginTop: 1 }}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                    {index < compatibilityCriteria.length - 1 ? (
                      <View style={{ height: 1, backgroundColor: `${COLORS.border}88`, marginBottom: 14, marginLeft: 98 }} />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Personal — ReadOnlyRow auto-hides null fields */}
        <View style={pr.sectionCard}>
          <Text style={pr.sectionTitle}>Personal</Text>
          <ReadOnlyRow icon="person-outline"      label="Gender"         value={GENDER_LABEL[profile.gender] ?? profile.gender} />
          <ReadOnlyRow icon="calendar-outline"    label="Age"            value={profile.age ? `${profile.age} years old` : null} />
          <ReadOnlyRow icon="search-outline"      label="Interested in"  value={interestedInLabel} />
          <ReadOnlyRow icon="location-outline"    label="Lives in"       value={location || null} />
          <ReadOnlyRow icon="heart-outline"       label="Marital status" value={maritalLabel} />
          <ReadOnlyRow icon="sunny-outline"       label="Religion"       value={religionLabel} />
          <ReadOnlyRow icon="globe-outline"       label="Ethnicity"      value={profile.ethnicity ?? null} />
          <ReadOnlyRow icon="chatbubbles-outline" label="Languages"      value={(profile.languages ?? []).join(', ') || null} isLast />
        </View>

        {/* Physical */}
        <View style={pr.sectionCard}>
          <Text style={pr.sectionTitle}>Physical</Text>
          <ReadOnlyRow icon="resize-outline" label="Height"    value={profile.height_cm ? `${(profile.height_cm / 100).toFixed(2)} m` : null} />
          <ReadOnlyRow icon="body-outline"   label="Body type" value={bodyTypeLabel} isLast />
        </View>

        {/* Work & Education */}
        <View style={pr.sectionCard}>
          <Text style={pr.sectionTitle}>Work & Education</Text>
          <ReadOnlyRow icon="briefcase-outline" label="Occupation" value={occupationLabel} />
          <ReadOnlyRow icon="school-outline"    label="Education"  value={educationLabel} isLast />
        </View>

        {/* Family */}
        <View style={pr.sectionCard}>
          <Text style={pr.sectionTitle}>Family</Text>
          <ReadOnlyRow icon="people-outline" label="Children"      value={profile.has_children == null ? null : profile.has_children ? 'Has children' : 'No children'} />
          <ReadOnlyRow icon="happy-outline"  label="Wants children" value={wantChildLabel} isLast />
        </View>

        {/* Hobbies */}
        {(profile.hobbies ?? []).length > 0 && (
          <View style={pr.sectionCard}>
            <Text style={pr.sectionTitle}>Hobbies & Interests</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {(profile.hobbies ?? []).map((h) => (
                <View key={h} style={pr.chipHobby}>
                  <Text style={pr.chipHobbyText}>{h}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {!isOwnProfile && currentUser ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: Math.max(insets.bottom + 14, 20),
            paddingHorizontal: 18,
            backgroundColor: 'transparent',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              backgroundColor: 'transparent',
            }}
          >
            <TouchableOpacity
              onPress={handleFavourite}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              style={floatingActionCircle}
            >
              <Ionicons
                name={isFavourite ? 'star' : 'star-outline'}
                size={26}
                color={isFavourite ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLike}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
              style={floatingActionCircle}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={isLiked ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMessage}
              disabled={recipientMessagesPaused}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={recipientMessagesPaused ? 'Messages paused' : 'Message'}
              accessibilityState={{ disabled: recipientMessagesPaused }}
              style={[
                floatingActionCircle,
                recipientMessagesPaused && { opacity: 0.55 },
              ]}
            >
              <Ionicons
                name={recipientMessagesPaused ? 'lock-closed-outline' : 'chatbubble-ellipses-outline'}
                size={26}
                color={recipientMessagesPaused ? COLORS.textMuted : COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePhotoViewer}
      >
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
          {toastOverlay}
          <Animated.View
            style={{
              flex: 1,
              transform: [
                { translateX: photoViewerSwipeX },
                { translateY: photoViewerSwipeY },
              ],
              opacity: Animated.add(
                photoViewerSwipeX.interpolate({
                  inputRange: [-120, 0, 120],
                  outputRange: [0.92, 1, 0.92],
                }),
                photoViewerSwipeY.interpolate({
                  inputRange: [-120, 0, 120],
                  outputRange: [0, 0, 0],
                }),
              ).interpolate({
                inputRange: [0.92, 1],
                outputRange: [0.92, 1],
              }),
            }}
            {...photoViewerPanResponder.panHandlers}
          >
            <ProfilePhotoGalleryPage
              userId={profile.id}
              winWidth={winWidth}
              winHeight={winHeight}
              activePhotoIndex={viewerPhotoIndex}
              dotBottom={photoModalDotBottom}
              onHorizontalIndexChange={(i) => {
                setViewerPhotoIndex(i);
              }}
            />
          </Animated.View>
          <SafeAreaView
            pointerEvents="box-none"
            edges={['top']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'transparent' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4, gap: 10 }}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={closePhotoViewer}
                accessibilityLabel="Close photos"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={26} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          {!isOwnProfile && currentUser ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: Math.max(insets.bottom + 12, 16),
                paddingHorizontal: 18,
                backgroundColor: 'transparent',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                backgroundColor: 'transparent',
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: FLOAT_ACTION_SIZE + 18,
                  left: 18,
                  right: 18,
                  alignItems: 'center',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    maxWidth: winWidth - 52,
                    color: '#FFF',
                    fontSize: 22,
                    fontWeight: '800',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.45)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 10,
                  }}
                >
                  {profile.full_name}
                </Text>
              </View>
                <TouchableOpacity
                  onPress={handleFavourite}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                  style={[
                    floatingActionCircle,
                    {
                      backgroundColor: 'rgba(10,10,10,0.62)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isFavourite ? 'star' : 'star-outline'}
                    size={26}
                    color={isFavourite ? '#F6B94C' : '#FFF'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLike}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
                  style={[
                    floatingActionCircle,
                    {
                      backgroundColor: 'rgba(10,10,10,0.74)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.16)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={26}
                    color={isLiked ? '#FF7B7B' : '#FFF'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleMessage}
                  disabled={recipientMessagesPaused}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={recipientMessagesPaused ? 'Messages paused' : 'Message'}
                  accessibilityState={{ disabled: recipientMessagesPaused }}
                  style={[
                    floatingActionCircle,
                    {
                      backgroundColor: 'rgba(10,10,10,0.62)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.14)',
                    },
                    recipientMessagesPaused && { opacity: 0.55 },
                  ]}
                >
                  <Ionicons
                    name={recipientMessagesPaused ? 'lock-closed-outline' : 'chatbubble-ellipses-outline'}
                    size={26}
                    color={recipientMessagesPaused ? 'rgba(255,255,255,0.48)' : '#FFF'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>

      <MatchModal
        visible={!!matchUser}
        matchedUser={matchUser}
        onClose={() => setMatchUser(null)}
      />

      <Modal
        visible={reportPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setReportPromptVisible(false);
          setReportValidationVisible(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.34)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
              Reason reporting {profile.full_name}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
              Select one reason before submitting your report.
            </Text>
            <View style={{ marginTop: 18, gap: 10 }}>
              {REPORT_REASONS.map((reason) => {
                const selected = selectedReportReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedReportReason(reason);
                      setReportValidationVisible(false);
                    }}
                    style={{
                      minHeight: 50,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      backgroundColor: selected ? '#FFF5F1' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: selected ? COLORS.primary : '#E7E1DC',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>{reason}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {reportValidationVisible ? (
              <View style={{ marginTop: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF7E8' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#A06A00' }}>Select a reason</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setReportPromptVisible(false);
                  setReportValidationVisible(false);
                }}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E7E1DC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void submitReport()}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#111111',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={blockPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockPromptVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.34)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
              Block user
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
              Block {profile.full_name}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setBlockPromptVisible(false)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E7E1DC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void confirmBlockUser()}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#111111',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const pr = StyleSheet.create({
  identityCard: {
    marginTop: -28,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    ...SHADOWS.md,
  },
  displayName: { fontSize: FONT.xxl, fontWeight: FONT.extrabold, color: COLORS.textStrong, flex: 1, flexWrap: 'wrap' },
  displayAge: { fontWeight: FONT.bold, color: COLORS.textSecondary },
  locationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { fontSize: FONT.md, color: COLORS.text, fontWeight: FONT.semibold },
  chipLooking: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}28`,
  },
  chipLookingText: { fontSize: FONT.sm, color: COLORS.primaryDark, fontWeight: FONT.bold },
  chipHobby: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.savanna,
    borderWidth: 1,
    borderColor: `${COLORS.earth}35`,
  },
  chipHobbyText: { fontSize: FONT.sm, color: COLORS.earth, fontWeight: FONT.semibold },
  aboutBlock: { flexDirection: 'row', marginTop: 18, alignItems: 'flex-start' },
  aboutAccent: {
    width: 4,
    marginTop: 4,
    minHeight: 52,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 14,
  },
  aboutLabel: {
    fontSize: FONT.sm,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
    marginBottom: 8,
  },
  aboutBody: {
    fontSize: FONT.md,
    color: COLORS.text,
    lineHeight: 24,
    fontWeight: FONT.medium,
  },
  compatibilityCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    ...SHADOWS.sm,
  },
  compatibilityRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.success}14`,
    borderWidth: 2,
    borderColor: `${COLORS.success}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compatibilityPercent: { fontSize: FONT.lg, fontWeight: FONT.extrabold, color: COLORS.success },
  compatibilityKicker: {
    fontSize: FONT.xs,
    fontWeight: FONT.extrabold,
    color: COLORS.success,
    marginBottom: 4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  compatibilityTitle: { fontSize: FONT.xl, fontWeight: FONT.extrabold, color: COLORS.textStrong },
  compatibilitySub: { marginTop: 4, fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 20 },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: FONT.extrabold,
    color: COLORS.earth,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${COLORS.border}CC`,
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: `${COLORS.primary}0D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIconEmpty: { backgroundColor: COLORS.savanna },
  fieldLabel: { fontSize: FONT.xs, color: COLORS.textSecondary, fontWeight: FONT.semibold, marginBottom: 2 },
  fieldValue: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.semibold },
  fieldValueEmpty: { fontSize: FONT.md, color: COLORS.textMuted, fontWeight: FONT.regular, fontStyle: 'italic' },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Pressable,
  PanResponder,
  FlatList,
  useWindowDimensions,
  StatusBar,
  InteractionManager,
  Share,
  RefreshControl,
} from 'react-native';
import {
  GestureHandlerRootView,
  ScrollView,
  PanGestureHandler,
  State as GestureState,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import haptics from '@/lib/haptics';
import { User } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, DEFAULT_AVATAR, FONT, INTERESTED_IN_OPTIONS, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, LOOKING_FOR_OPTIONS, WANT_CHILDREN_YES_NO, OCCUPATION_OPTIONS, PHYSICAL_CONDITION_OPTIONS, RADIUS, SHADOWS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { MatchModal } from '@/components/ui/MatchModal';
import {
  getProfileStrength,
  isProfileCompleteForDiscover,
  onboardingHrefFromSession,
} from '@/lib/profile-completion';
import { ProfileCompletionNudgeBanner } from '@/components/profile/ProfileCompletionNudgeBanner';
import { useDialog } from '@/components/ui/DialogProvider';
import { ReportUserModal } from '@/components/ui/ReportUserModal';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { SkeletonProfile } from '@/components/ui/Skeleton';
import { track, EVENTS } from '@/lib/analytics';
import { hasExistingReport } from '@/lib/social-actions';
import { recordProfileShareEvent, SHARE_REWARD_TOAST } from '@/lib/share-reward';
import { getProfileSeed } from '@/lib/profile-seed-cache';
import { isUserEffectivelyOnline, formatLastSeen } from '@/lib/utils';
import { SPRING, SNAP_IN } from '@/lib/motion';

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female' };
const profileGalleryCache = new Map<string, string[]>();
const prefetchedPhotoUris = new Set<string>();
/** Profiles we've already fired a view notification for this app session — prevents spam on repeated visits. */
const notifiedProfileViews = new Set<string>();

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
        const list =
          p.length > 0
            ? p
            : data.avatar_url
              ? [data.avatar_url]
              : [`${DEFAULT_AVATAR}${encodeURIComponent((data.full_name ?? '?').charAt(0))}`];
        profileGalleryCache.set(userId, list);
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
  const listRef = useRef<FlatList<string>>(null);
  const scrollSyncedRef = useRef<{ userId: string; index: number } | null>(null);
  const clampedIndex = Math.min(activePhotoIndex, Math.max(photos.length - 1, 0));

  useEffect(() => {
    if (loading) return;
    if (clampedIndex !== activePhotoIndex) {
      onHorizontalIndexChange(clampedIndex);
    }
  }, [activePhotoIndex, clampedIndex, loading, onHorizontalIndexChange]);

  useEffect(() => {
    if (loading || photos.length === 0) return;
    const idx = Math.min(activePhotoIndex, photos.length - 1);
    const s = scrollSyncedRef.current;
    if (s?.userId === userId && s.index === idx) return;
    scrollSyncedRef.current = { userId, index: idx };
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  }, [loading, photos.length, userId, activePhotoIndex]);

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
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialScrollIndex={Math.min(activePhotoIndex, photos.length - 1)}
        getItemLayout={(_, index) => ({
          length: winWidth,
          offset: winWidth * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / winWidth);
          const next = Math.max(0, Math.min(i, photos.length - 1));
          scrollSyncedRef.current = { userId, index: next };
          if (next !== activePhotoIndex) {
            onHorizontalIndexChange(next);
          }
        }}
        onScrollToIndexFailed={(info) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
        renderItem={({ item: uri }) => (
          <View style={{ width: winWidth, height: winHeight }}>
            <Image
              source={{ uri }}
              style={{ width: winWidth, height: winHeight }}
              contentFit="contain"
              transition={180}
            />
          </View>
        )}
      />
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
  if (!value) return null;
  return (
    <View style={[pr.fieldRow, isLast && pr.fieldRowLast]}>
      <View style={pr.fieldIcon}>
        <Ionicons name={icon} size={16} color={COLORS.textStrong} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={pr.fieldLabel}>{label}</Text>
        <Text style={pr.fieldValue}>{value}</Text>
      </View>
    </View>
  );
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
  const { user: currentUser, session } = useAuthStore();
  const profileScrollRef = useRef<ScrollView>(null);
  const pullPanRef = useRef(null);
  const [strengthBannerDismissed, setStrengthBannerDismissed] = useState(false);

  // Scroll-driven action button animation
  const btnScaleAnim   = useRef(new Animated.Value(1)).current;
  const btnOpacityAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY    = useRef(0);
  // Drives the Telegram-style collapsed header: big hero photo shrinks to a
  // circular avatar + name row pinned to the top as you scroll up.
  const scrollY = useRef(new Animated.Value(0)).current;
  const collapseStartRef = useRef(0);
  const [collapsedHeaderActive, setCollapsedHeaderActive] = useState(false);
  const pullUpTriggeredRef = useRef(false);
  // True while the scroll view is at (or very near) its bottom edge. A swipe
  // up released while this is true advances to the next profile.
  const scrollAtBottomRef = useRef(false);
  // True while the scroll view is at (or very near) its top edge. A swipe
  // down released while this is true dismisses the profile.
  const scrollAtTopRef = useRef(true);
  // Fling thresholds — either distance OR velocity needs to cross these for
  // the swipe to commit. Keep them generous so a deliberate flick works
  // reliably but a slow nudge doesn't fire by accident.
  const SWIPE_DIST_PX = 60;
  const SWIPE_VELOCITY = 700;

  const handleProfileScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y    = contentOffset.y;
    const prev = lastScrollY.current;
    lastScrollY.current = y;
    scrollY.setValue(y);

    // Flip the collapsed-header state once we've scrolled past the hero.
    // Small hysteresis window (10px) keeps the fade from flickering.
    const threshold = collapseStartRef.current;
    setCollapsedHeaderActive((prevActive) => {
      if (!prevActive && y > threshold + 10) return true;
      if (prevActive && y < threshold - 10) return false;
      return prevActive;
    });

    const springCfg = { useNativeDriver: true, tension: 90, friction: 10 };

    if (y < 30) {
      Animated.spring(btnScaleAnim,   { toValue: 1,    ...springCfg }).start();
      Animated.spring(btnOpacityAnim, { toValue: 1,    ...springCfg }).start();
    } else if (y > prev + 5) {
      Animated.spring(btnScaleAnim,   { toValue: 0.72, ...springCfg }).start();
      Animated.spring(btnOpacityAnim, { toValue: 0.75, ...springCfg }).start();
    } else if (y < prev - 5) {
      Animated.spring(btnScaleAnim,   { toValue: 1,    ...springCfg }).start();
      Animated.spring(btnOpacityAnim, { toValue: 1,    ...springCfg }).start();
    }

    // Track whether the scroll view is at its top or bottom edge. The pan
    // gesture below only commits a swipe when we're pinned against the
    // matching edge, so mid-profile vertical pans never trigger navigation.
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    scrollAtBottomRef.current = distanceFromBottom < 1;
    scrollAtTopRef.current = contentOffset.y <= 1;
  }, [btnScaleAnim, btnOpacityAnim, scrollY]);

  const { getOrCreateConversation } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();
  const { showDialog, showToast } = useDialog();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const heroHeight = winWidth * 1.1;
  const collapseStart = Math.max(heroHeight - 140, 80);
  const collapseEnd = Math.max(heroHeight - 70, 120);
  useEffect(() => {
    collapseStartRef.current = collapseStart;
  }, [collapseStart]);
  const collapsedOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseStart, collapseEnd],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [collapseStart, collapseEnd, scrollY],
  );
  const collapsedTranslateY = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseStart, collapseEnd],
      outputRange: [-10, 0],
      extrapolate: 'clamp',
    }),
    [collapseStart, collapseEnd, scrollY],
  );
  const heroTopChromeOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [Math.max(collapseStart - 60, 40), collapseStart],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    [collapseStart, scrollY],
  );

  const heroPhotoListRef = useRef<FlatList<string>>(null);
  const prevProfileIdInPhotoViewerRef = useRef<string | null>(null);
  const photoViewerSwipeX = useRef(new Animated.Value(0)).current;
  const photoViewerSwipeY = useRef(new Animated.Value(0)).current;
  // Double-tap to like — track last tap timestamp and the delayed single-tap
  // so we don't fire both "open viewer" and "like" on the same gesture.
  const lastHeroTapRef = useRef<{ t: number; i: number } | null>(null);
  const singleHeroTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartBurstScale = useRef(new Animated.Value(0)).current;
  const heartBurstOpacity = useRef(new Animated.Value(0)).current;

  const orderedUserIds = useProfileBrowseStore((s) => s.orderedUserIds);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(routeWantsPhotoViewer);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState(routePhotoIndex);
  /**
   * The photo viewer is a `<Modal>`, which on iOS/Android renders in a separate
   * native window. The DialogProvider's toast lives in the underlying tree, so
   * `showToast` calls fire but the bubble is hidden behind the modal. We render
   * a parallel toast _inside_ the modal so feedback (Liked!, Added to favourites,
   * etc.) is actually visible while photos are open.
   */
  const [viewerToast, setViewerToast] = useState<{ icon: keyof typeof Ionicons.glyphMap; message: string } | null>(null);
  const viewerToastAnim = useRef(new Animated.Value(0)).current;
  const viewerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showViewerToast = useCallback((cfg: { icon: keyof typeof Ionicons.glyphMap; message: string }) => {
    if (viewerToastTimerRef.current) clearTimeout(viewerToastTimerRef.current);
    viewerToastAnim.setValue(0);
    setViewerToast(cfg);
    Animated.spring(viewerToastAnim, { toValue: 1, ...SPRING }).start();
    viewerToastTimerRef.current = setTimeout(() => {
      Animated.timing(viewerToastAnim, { toValue: 0, ...SNAP_IN }).start(() => {
        setViewerToast(null);
      });
    }, 1800);
  }, [viewerToastAnim]);
  useEffect(() => {
    return () => {
      if (viewerToastTimerRef.current) clearTimeout(viewerToastTimerRef.current);
    };
  }, []);

  // Seed from the in-memory cache the caller just wrote (discover / likes / etc.)
  // so the profile paints instantly. A background fetch replaces this with fresh
  // DB data a moment later.
  const [profile, setProfile] = useState<User | null>(() => getProfileSeed(id));
  const [isLoading, setIsLoading] = useState(() => !getProfileSeed(id));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const likeInFlightRef = useRef(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileHeroMenuVisible, setProfileHeroMenuVisible] = useState(false);

  useEffect(() => {
    setDetailsExpanded(false);
    setIsFavourite(false);
    setReportPromptVisible(false);
    setStrengthBannerDismissed(false);
    setPhotoIndex(0);
    setLoadError(null);
    setProfileHeroMenuVisible(false);
    // Re-seed from the cache when navigating between profiles so the screen
    // paints instantly instead of flashing a spinner between rows.
    const seed = getProfileSeed(id);
    if (seed) {
      setProfile(seed);
      setIsLoading(false);
    }
    requestAnimationFrame(() => {
      heroPhotoListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [id]);

  useEffect(() => {
    setPhotoViewerVisible(routeWantsPhotoViewer);
    if (routeWantsPhotoViewer) {
      setViewerPhotoIndex(routePhotoIndex);
    }
  }, [routePhotoIndex, routeWantsPhotoViewer, id]);

  const fetchProfile = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!id) return;
      const bg = opts?.background === true;
      // If we already have any profile data for this id (from the seed cache or
      // a previous fetch), treat the fetch as a silent refresh — don't blank the
      // screen back to a spinner just to replace `data` with a slightly newer
      // copy of the same row.
      const hasExistingData = !!getProfileSeed(id);
      const silent = bg || hasExistingData;

      if (!silent) {
        setLoadError(null);
        setIsLoading(true);
        setProfile(null);
      } else {
        if (bg) setRefreshing(true);
        setLoadError(null);
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();

      if (!silent) setIsLoading(false);
      setRefreshing(false);

      if (error) {
        console.error('[ProfileView] load profile:', error.message);
        setLoadError(error.message);
        if (!silent) setProfile(null);
        return;
      }

      setLoadError(null);
      if (data) {
        const today = new Date();
        const bday = data.birthdate ? new Date(data.birthdate) : null;
        const age = bday
          ? today.getFullYear() - bday.getFullYear()
            - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
          : undefined;
        const pphotos = data.profile_photos ?? [];
        const galleryList =
          pphotos.length > 0 ? pphotos : buildFallbackPhotoList(data.full_name, data.avatar_url);
        profileGalleryCache.set(id, galleryList);
        setProfile({
          ...data,
          age,
          profile_photos: pphotos,
          languages: data.languages ?? [],
          looking_for: data.looking_for ?? [],
          hobbies: data.hobbies ?? [],
        });
      } else {
        setProfile(null);
      }
    },
    [id],
  );

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  // Record view + notify once we know both profile and viewer (session can resolve after first paint)
  useEffect(() => {
    if (!profile || !currentUser?.id || currentUser.id === profile.id) return;

    // ignoreDuplicates:true → ON CONFLICT DO NOTHING (no UPDATE policy needed on the table)
    void supabase.from('profile_views').upsert(
      { viewer_id: currentUser.id, viewed_id: profile.id, viewed_at: new Date().toISOString() },
      { onConflict: 'viewer_id,viewed_id', ignoreDuplicates: true },
    );
    track(EVENTS.PROFILE_VIEWED);
    // Only notify once per app session — the DB upsert deduplicates the row but not the push
    if (!notifiedProfileViews.has(profile.id)) {
      notifiedProfileViews.add(profile.id);
      notifyUser({
        type: 'view',
        recipientId: profile.id,
        senderId: currentUser.id,
        senderName: currentUser.full_name ?? 'Someone',
        extra: { userId: currentUser.id },
      });
    }
  }, [profile?.id, currentUser?.id]);

  // Hydrate likes once if Discover (or elsewhere) has not already loaded them.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (useDiscoverStore.getState().likedUserIds.size > 0) return;
    void fetchLikedUserIds(currentUser.id);
  }, [currentUser?.id, fetchLikedUserIds]);

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

  // Force light status bar icons while this screen is mounted — dark photos
  // sit under the translucent status bar and light-content stays legible on
  // both dark and the savanna placeholder.
  useEffect(() => {
    const prev = StatusBar.pushStackEntry({ barStyle: 'light-content', animated: true });
    return () => {
      StatusBar.popStackEntry(prev);
    };
  }, []);

  // Clear any pending single-tap timer on unmount so a delayed openPhotoViewer
  // doesn't fire after the user has navigated away.
  useEffect(() => {
    return () => {
      if (singleHeroTapTimerRef.current) {
        clearTimeout(singleHeroTapTimerRef.current);
        singleHeroTapTimerRef.current = null;
      }
    };
  }, []);

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
    const handle = InteractionManager.runAfterInteractions(() => {
      void Promise.allSettled(idsToWarm.map((uid) => loadProfilePhotoList(uid)));
    });
    return () => handle.cancel();
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

  // Pull-up gesture: jump to next profile in the browse queue without
  // opening the fullscreen gallery. Used by the "Up next" footer on the
  // main profile scroll view.
  const goNextProfile = useCallback(() => {
    const pid = profile?.id;
    if (!pid) return;
    const ids = useProfileBrowseStore.getState().orderedUserIds;
    const i = ids.indexOf(pid);
    if (i < 0 || i >= ids.length - 1) return;
    replaceProfileRoute(ids[i + 1]!);
  }, [profile?.id, replaceProfileRoute]);

  // Pan handler that lives _alongside_ the ScrollView. It's a pure swipe
  // detector — no rubber-band, no armed state, no content translation. On
  // release we decide whether the gesture was a committed flick:
  //   • Swipe up while pinned at the bottom → jump to next profile
  //   • Swipe down while pinned at the top  → close this profile
  // Anywhere in the middle of the scroll the ScrollView owns the gesture,
  // so these fire only when the scroll has nowhere to go anyway.
  const onPullPanEvent = useCallback((_e: PanGestureHandlerGestureEvent) => {
    // Intentionally empty — we only commit on gesture END. Keeps the content
    // rock-steady under the finger (no rubber-band "throttle" feel).
  }, []);

  const onPullPanStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const s = e.nativeEvent.state;
    if (s !== GestureState.END) return;

    const { translationY, velocityY } = e.nativeEvent;

    const swipedUp =
      translationY < -SWIPE_DIST_PX || velocityY < -SWIPE_VELOCITY;
    const swipedDown =
      translationY > SWIPE_DIST_PX || velocityY > SWIPE_VELOCITY;

    // Swipe up at the bottom → next profile.
    if (swipedUp && scrollAtBottomRef.current && !pullUpTriggeredRef.current) {
      const pid = profile?.id;
      const ids = pid ? useProfileBrowseStore.getState().orderedUserIds : [];
      const i = pid ? ids.indexOf(pid) : -1;
      const hasNext = i >= 0 && i < ids.length - 1;
      if (hasNext) {
        pullUpTriggeredRef.current = true;
        goNextProfile();
        setTimeout(() => {
          pullUpTriggeredRef.current = false;
        }, 400);
      }
      return;
    }

    // Swipe down at the top → close the profile (matches the bottom-sheet
    // feel set by the slide_from_bottom stack animation).
    if (swipedDown && scrollAtTopRef.current) {
      router.back();
    }
  }, [profile?.id, goNextProfile]);

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
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
      Math.abs(gestureState.dy) > 14,
    onPanResponderGrant: () => {
      photoViewerSwipeX.stopAnimation();
      photoViewerSwipeY.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      const clampedY = Math.max(-120, Math.min(120, gestureState.dy * 0.38));
      photoViewerSwipeY.setValue(clampedY);
      photoViewerSwipeX.setValue(0);
    },
    onPanResponderRelease: (_, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      if (horizontal) {
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
    photoViewerSwipeX,
    photoViewerSwipeY,
    photoViewerVisible,
    resetPhotoViewerSwipe,
  ]);

  const handleShareProfile = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const url = Linking.createURL(`/(profile)/${profile.id}`);
      const result = await Share.share({
        message: `${profile.full_name} on Africana — open in the app:\n${url}`,
      });
      if (result?.action === Share.sharedAction && currentUser?.id) {
        const { ok } = await recordProfileShareEvent(currentUser.id, profile.id);
        if (ok) showToast({ icon: 'leaf-outline', message: SHARE_REWARD_TOAST });
      }
    } catch {
      /* dismissed */
    }
  }, [profile, currentUser?.id]);

  const triggerHeartBurst = useCallback(() => {
    heartBurstScale.setValue(0.3);
    heartBurstOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heartBurstScale, {
          toValue: 1.1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(heartBurstOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(320),
      Animated.parallel([
        Animated.timing(heartBurstScale, {
          toValue: 1.3,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(heartBurstOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heartBurstOpacity, heartBurstScale]);

  // Double-tap likes, single-tap opens full-screen viewer (after a short
  // grace window so we don't fire both on a real double-tap). Hook must live
  // ABOVE the `isLoading` / `!profile` early returns below, or React will see
  // a different hook count between the loading render and the ready render.
  // `handleLike` / `openPhotoViewer` are resolved from lexical closure at tap
  // time; we leave them out of deps (their own closures are covered by our
  // `profile` / `currentUser` / `likedUserIds` deps).
  const handleHeroPhotoTap = useCallback(
    (index: number) => {
      if (!profile || !currentUser) return;
      const isOwn = currentUser.id === profile.id;
      const alreadyLiked = likedUserIds.has(profile.id);
      const now = Date.now();
      const last = lastHeroTapRef.current;
      if (last && last.i === index && now - last.t < 280) {
        if (singleHeroTapTimerRef.current) {
          clearTimeout(singleHeroTapTimerRef.current);
          singleHeroTapTimerRef.current = null;
        }
        lastHeroTapRef.current = null;
        if (!isOwn && !alreadyLiked) {
          haptics.tapLight();
          triggerHeartBurst();
          void handleLike();
        } else if (alreadyLiked) {
          triggerHeartBurst();
        }
        return;
      }
      lastHeroTapRef.current = { t: now, i: index };
      if (singleHeroTapTimerRef.current) clearTimeout(singleHeroTapTimerRef.current);
      singleHeroTapTimerRef.current = setTimeout(() => {
        openPhotoViewer(index);
        lastHeroTapRef.current = null;
        singleHeroTapTimerRef.current = null;
      }, 240);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, currentUser, likedUserIds, triggerHeartBurst],
  );

  if (isLoading) {
    return <SkeletonProfile />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {loadError ? (
          <>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textMuted} />
            <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '800', color: COLORS.textStrong, textAlign: 'center' }}>
              Could not load profile
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}>{loadError}</Text>
            <Button title="Try again" onPress={() => void fetchProfile()} style={{ marginTop: 20 }} />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>Profile not found</Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}>
              This profile may have been removed or the link is invalid.
            </Text>
          </>
        )}
        <Button title="Go back" onPress={() => router.back()} variant="ghost" style={{ marginTop: 16 }} />
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
    INTERESTED_IN_OPTIONS.find((o) => o.value === profile.interested_in)?.label ?? profile.interested_in ?? null;

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const heritageLine = [profile.origin_city, profile.origin_state, profile.origin_country].filter(Boolean).join(', ');
  const showHeritage =
    heritageLine.length > 0 &&
    heritageLine.trim().toLowerCase() !== (location || '').trim().toLowerCase();
  const isVerified = profile.verified === true || profile.verification_status === 'approved';
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;
  const displayOnlineStatus: 'online' | 'offline' =
    !isOwnProfile && profile.online_visible === false
      ? 'offline'
      : isUserEffectivelyOnline(profile.online_status, profile.last_seen)
        ? 'online'
        : 'offline';

  const recipientMessagesPaused = !isOwnProfile && profile.accepts_messages === false;

  /** Single activity treatment: online badge, or last-active time when available, else offline. */
  const isActiveOnline = displayOnlineStatus === 'online';
  const useLastActiveLabel =
    !isActiveOnline &&
    !isOwnProfile &&
    profile.online_visible !== false &&
    !!profile.last_seen;
  const activityLabel = isActiveOnline
    ? 'Online'
    : useLastActiveLabel
      ? (formatLastSeen(profile.last_seen) ?? 'Offline')
      : 'Offline';

  const photoModalDotBottom =
    !isOwnProfile && currentUser
      ? Math.max(insets.bottom + FLOAT_ACTION_SIZE + 28, 94)
      : Math.max(insets.bottom + 16, 24);

  const normalizeText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
  const viewerLanguages = new Set((currentUser?.languages ?? []).map((lang) => normalizeText(lang)).filter(Boolean));
  const viewerHobbies = new Set((currentUser?.hobbies ?? []).map((h) => normalizeText(h)).filter(Boolean));
  const commonHobbies = !isOwnProfile
    ? (profile.hobbies ?? []).filter((h) => viewerHobbies.has(normalizeText(h)))
    : [];
  const commonLanguages = !isOwnProfile
    ? (profile.languages ?? []).filter((l) => viewerLanguages.has(normalizeText(l)))
    : [];
  const profileFirstName = profile.full_name?.trim().split(/\s+/)[0] ?? 'Their';

  const viewerStrength = getProfileStrength(currentUser);
  const showStrengthNudge =
    !isOwnProfile &&
    !!currentUser &&
    isProfileCompleteForDiscover(currentUser) &&
    viewerStrength.percent < 100 &&
    !strengthBannerDismissed;

  const needsDiscoverGate =
    !isOwnProfile && !!currentUser && !!session && !isProfileCompleteForDiscover(currentUser);

  const handleLike = async () => {
    if (!currentUser || likeInFlightRef.current) return;
    likeInFlightRef.current = true;
    try {
      const wasLiked = likedUserIds.has(profile.id);
      if (!wasLiked) haptics.tapLight();
      const isMatch = await toggleLike(currentUser.id, profile.id);
      if (isMatch && !wasLiked) {
        haptics.success();
        setMatchUser(profile);
      } else {
        const toastCfg = {
          icon: (wasLiked ? 'heart-outline' : 'heart') as keyof typeof Ionicons.glyphMap,
          message: wasLiked ? 'Unliked' : 'Liked!',
        };
        if (photoViewerVisible) showViewerToast(toastCfg);
        else showToast(toastCfg);
      }
    } finally {
      likeInFlightRef.current = false;
    }
  };

  const handleMessage = async () => {
    if (!currentUser || recipientMessagesPaused) return;
    const wasInViewer = photoViewerVisible;
    if (wasInViewer) {
      // Use closePhotoViewer (not raw setState) so the viewer/photo route
      // params get reset — otherwise navigating back to the profile from the
      // chat reopens the photo viewer.
      closePhotoViewer();
    }
    let convId: string | null = null;
    try {
      convId = await getOrCreateConversation(currentUser.id, profile.id);
    } catch {
      // fall through to null check below
    }
    if (!convId) {
      showToast({ icon: 'alert-circle-outline', message: 'Could not open conversation. Please try again.' });
      return;
    }
    const peerId = profile.id;
    const navigate = () => {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: peerId } });
    };
    if (wasInViewer) {
      // Wait for the modal-close animation to actually run before pushing the
      // chat route. Pushing while the modal is still on screen makes the new
      // screen render behind it on iOS and feels like nothing happened.
      setTimeout(() => InteractionManager.runAfterInteractions(navigate), 220);
      return;
    }
    InteractionManager.runAfterInteractions(navigate);
  };

  const handleFavourite = async () => {
    if (!currentUser) return;
    if (isFavourite) {
      setIsFavourite(false);
      const { error } = await supabase
        .from('favourites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('favourited_id', profile.id);
      if (error) {
        setIsFavourite(true);
        showToast({ icon: 'alert-circle-outline', message: 'Could not update favourites. Please try again.' });
        return;
      }
      const toastCfg = { icon: 'star-outline' as keyof typeof Ionicons.glyphMap, message: 'Removed from favourites' };
      if (photoViewerVisible) showViewerToast(toastCfg);
      else showToast(toastCfg);
    } else {
      setIsFavourite(true);
      const { error } = await supabase
        .from('favourites')
        .insert({ user_id: currentUser.id, favourited_id: profile.id });
      if (error) {
        setIsFavourite(false);
        showToast({ icon: 'alert-circle-outline', message: 'Could not update favourites. Please try again.' });
        return;
      }
      const toastCfg = { icon: 'star' as keyof typeof Ionicons.glyphMap, message: 'Added to favourites' };
      if (photoViewerVisible) showViewerToast(toastCfg);
      else showToast(toastCfg);
      track(EVENTS.FAVOURITE_ADDED);
      void notifyUser({
        type: 'favourite',
        recipientId: profile.id,
        senderId: currentUser.id,
        senderName: currentUser.full_name ?? 'Someone',
        extra: { userId: currentUser.id },
      });
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
      if (winWidth > 0) {
        heroPhotoListRef.current?.scrollToOffset({
          offset: viewerPhotoIndex * winWidth,
          animated: false,
        });
      }
    });
    setPhotoViewerVisible(false);
    router.setParams({ viewer: undefined, photo: undefined });
  };

  const handleBlock = () => {
    if (!profile) return;
    showDialog({
      title: 'Block user',
      message: `Block ${profile.full_name}? They won't be able to see your profile or send you messages.`,
      icon: 'ban-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        { label: 'Block', style: 'destructive', onPress: () => void confirmBlockUser() },
      ],
    });
  };

  const handleReport = async () => {
    if (!currentUser || !profile) return;
    try {
      if (await hasExistingReport(currentUser.id, profile.id)) {
        showToast({ message: 'You\u2019ve already reported this user.', icon: 'information-circle-outline' });
        return;
      }
    } catch {
      showToast({ message: 'Could not check report status. Please try again.', icon: 'alert-circle-outline' });
      return;
    }
    setReportPromptVisible(true);
  };

  const confirmBlockUser = async () => {
    if (!currentUser || !profile) return;
    const { error } = await supabase.from('blocks').insert({
      blocker_id: currentUser.id,
      blocked_id: profile.id,
    });
    if (error) {
      showToast({ icon: 'alert-circle-outline', message: 'Could not block user. Please try again.' });
      return;
    }
    showToast({ icon: 'ban-outline', message: `${profile.full_name ?? 'User'} blocked` });
    setTimeout(() => router.back(), 1300);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Telegram-style collapsed header: appears pinned to the top once the
          user has scrolled past the hero. Fades in as the big photo scrolls
          off-screen and shows a circular mini-avatar + name + activity. */}
      <Animated.View
        pointerEvents={collapsedHeaderActive ? 'box-none' : 'none'}
        style={[
          pr.collapsedHeader,
          {
            paddingTop: insets.top,
            opacity: collapsedOpacity,
            transform: [{ translateY: collapsedTranslateY }],
          },
        ]}
      >
        <View style={pr.collapsedHeaderInner}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            activeOpacity={0.7}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            style={pr.collapsedBackBtn}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.textStrong} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openPhotoViewer(0)}
            accessibilityLabel="View photo"
            activeOpacity={0.85}
            style={pr.collapsedAvatarWrap}
          >
            {photos[0] ? (
              <Image
                source={{ uri: photos[0] }}
                style={pr.collapsedAvatar}
                contentFit="cover"
                contentPosition="top"
                cachePolicy="memory-disk"
                recyclingKey={photos[0]}
              />
            ) : (
              <View style={[pr.collapsedAvatar, { backgroundColor: COLORS.savanna }]} />
            )}
            {isActiveOnline ? <View style={pr.collapsedOnlineDot} /> : null}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => profileScrollRef.current?.scrollTo({ y: 0, animated: true })}
            style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text numberOfLines={1} style={[pr.collapsedName, { flexShrink: 1 }]}>
                {profile.full_name}
                {profile.age ? <Text style={pr.collapsedAge}>, {profile.age}</Text> : null}
              </Text>
              {isVerified ? <VerifiedBadge size={14} /> : null}
            </View>
            <Text numberOfLines={1} style={[
              pr.collapsedStatus,
              { color: isActiveOnline ? COLORS.online : COLORS.textMuted },
            ]}>
              {activityLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setProfileHeroMenuVisible(true)}
            accessibilityLabel="More actions"
            activeOpacity={0.7}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            style={pr.collapsedMenuBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.textStrong} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <PanGestureHandler
        ref={pullPanRef}
        simultaneousHandlers={profileScrollRef}
        activeOffsetY={[-15, 15]}
        failOffsetX={[-25, 25]}
        onGestureEvent={onPullPanEvent}
        onHandlerStateChange={onPullPanStateChange}
      >
      <Animated.View style={{ flex: 1 }}>
      <ScrollView
        ref={profileScrollRef}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        bounces
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        simultaneousHandlers={pullPanRef}
        scrollEventThrottle={16}
        onScroll={handleProfileScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchProfile({ background: true })}
            tintColor={COLORS.textStrong}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: COLORS.surface,
          paddingBottom:
            !isOwnProfile && currentUser
              ? Math.max(insets.bottom + FLOAT_ACTION_SIZE + 36, 108)
              : Math.max(insets.bottom + 24, 32),
        }}
      >
        {/* Photo Carousel — rounded bottom for handoff into identity card.
            Uses a windowed FlatList so we only decode the visible photo plus
            its neighbor, not all N at once. Warm placeholder color kills the
            "dark flash" before the image decodes. */}
        <View style={{ position: 'relative', backgroundColor: COLORS.savanna, overflow: 'hidden', borderBottomLeftRadius: RADIUS.xxl, borderBottomRightRadius: RADIUS.xxl }}>
          <FlatList
            ref={heroPhotoListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            keyExtractor={(photo, i) => `${photo}-${i}`}
            getItemLayout={(_, index) => ({
              length: winWidth,
              offset: winWidth * index,
              index,
            })}
            style={{ width: winWidth, height: winWidth * 1.1 }}
            onMomentumScrollEnd={(e) => {
              if (winWidth <= 0) return;
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / winWidth));
            }}
            renderItem={({ item: photo, index: i }) => (
              <Pressable
                onPress={() => handleHeroPhotoTap(i)}
                android_disableSound
                style={{ width: winWidth, height: winWidth * 1.1, backgroundColor: COLORS.savanna }}
              >
                <Image
                  source={{ uri: photo }}
                  style={{ width: winWidth, height: winWidth * 1.1, backgroundColor: COLORS.savanna }}
                  contentFit="cover"
                  contentPosition="top"
                  transition={220}
                  cachePolicy="memory-disk"
                  recyclingKey={photo}
                />
              </Pressable>
            )}
          />
          {/* Subtle bottom shade — only enough to keep photo dots & status icons readable */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.28)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%' }}
          />
          {/* Soft top shade so the back/menu buttons stay legible on light photos */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0.32)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96 }}
          />

          {/* Heart-burst overlay for the double-tap-to-like gesture */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: heartBurstOpacity,
              transform: [{ scale: heartBurstScale }],
            }}
          >
            <Ionicons name="heart" size={110} color="#FFFFFF" style={{
              textShadowColor: 'rgba(0,0,0,0.35)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 12,
            }} />
          </Animated.View>

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

          {/* Back + overflow menu (share / report / block) — keeps hero uncluttered.
              Fades out as the collapsed header takes over so we never double-stack
              back buttons on top of each other. */}
          <SafeAreaView
            pointerEvents={collapsedHeaderActive ? 'none' : 'box-none'}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            <Animated.View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                opacity: heroTopChromeOpacity,
              }}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                accessibilityLabel="Go back"
                activeOpacity={0.85}
                style={pr.frostedCircle}
              >
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {photos.length > 2 ? (
                <View style={pr.photoCounterPill}>
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <Text style={pr.photoCounterText}>
                    {Math.min(photoIndex + 1, photos.length)} / {photos.length}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => setProfileHeroMenuVisible(true)}
                accessibilityLabel="More actions"
                accessibilityHint={isOwnProfile ? 'Share profile' : 'Share, report, or block'}
                activeOpacity={0.85}
                style={pr.frostedCircle}
              >
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>

        </View>

        {/* Identity — overlaps hero */}
        <View>
        <View style={pr.identityCard}>
          {/* Online status — own row, pushed to the right edge */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
            <View style={[pr.onlineBadge, { backgroundColor: isActiveOnline ? `${COLORS.online}16` : COLORS.savanna }]}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isActiveOnline ? COLORS.online : COLORS.textMuted }} />
              <Text
                style={{ fontSize: 12, fontWeight: '600', color: isActiveOnline ? COLORS.online : COLORS.textSecondary }}
                numberOfLines={1}
              >
                {activityLabel}
              </Text>
            </View>
          </View>

          {/* Name + age + verified badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={pr.displayName}>
              {profile.full_name}
              {profile.age ? <Text style={pr.displayAge}>, {profile.age}</Text> : null}
            </Text>
            {isVerified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.successSurface }}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.success }}>Verified</Text>
              </View>
            ) : null}
          </View>

          {/* Quick Facts — dense at-a-glance summary, lives inside the identity card */}
          {(() => {
            type QuickFact = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null };
            const rows: QuickFact[] = [
              { icon: 'location-outline',    label: 'Location',    value: location || null },
              {
                icon: 'sparkles-outline',
                label: 'Looking for',
                value: (profile.looking_for ?? []).length > 0
                  ? (profile.looking_for ?? [])
                      .map((lf) => LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf.replace('_', ' '))
                      .join(' · ')
                  : null,
              },
              {
                icon: 'chatbubbles-outline',
                label: 'Speaks',
                value: (profile.languages ?? []).length > 0 ? (profile.languages ?? []).join(', ') : null,
              },
              { icon: 'briefcase-outline',   label: 'Works as',    value: occupationLabel || null },
              { icon: 'globe-outline',       label: 'Ethnicity',   value: profile.ethnicity || null },
            ];
            const quickFacts = rows.filter((row): row is QuickFact & { value: string } => !!row.value);

            if (quickFacts.length === 0) return null;
            return (
              <View style={pr.quickFactsBlock}>
                {quickFacts.map((row, i) => (
                  <View
                    key={row.label}
                    style={[
                      pr.quickFactRow,
                      i < quickFacts.length - 1 && pr.quickFactRowDivider,
                    ]}
                  >
                    <View style={pr.quickFactIcon}>
                      <Ionicons name={row.icon} size={16} color={COLORS.textStrong} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={pr.quickFactLabel}>{row.label}</Text>
                      <Text style={pr.quickFactValue} numberOfLines={2}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Shared interests — chips surfacing overlaps between viewer and profile */}
          {(commonHobbies.length > 0 || commonLanguages.length > 0) ? (
            <View style={pr.sharedBlock}>
              <View style={pr.sharedHeader}>
                <Ionicons name="sparkles" size={14} color={COLORS.primary} />
                <Text style={pr.sharedHeaderText}>You have in common</Text>
              </View>
              <View style={pr.sharedChipRow}>
                {commonHobbies.slice(0, 4).map((h) => (
                  <View key={`h-${h}`} style={pr.sharedChip}>
                    <Text style={pr.sharedChipText}>{h}</Text>
                  </View>
                ))}
                {commonLanguages.slice(0, 3).map((l) => (
                  <View key={`l-${l}`} style={[pr.sharedChip, pr.sharedChipLang]}>
                    <Ionicons name="chatbubbles-outline" size={12} color={COLORS.earth} />
                    <Text style={pr.sharedChipText}>{l}</Text>
                  </View>
                ))}
                {commonHobbies.length + commonLanguages.length > 7 ? (
                  <View style={pr.sharedChip}>
                    <Text style={pr.sharedChipText}>+{commonHobbies.length + commonLanguages.length - 7}</Text>
                  </View>
                ) : null}
              </View>
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
          ) : isOwnProfile ? (
            <View style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: `${COLORS.savanna}88`, borderRadius: RADIUS.md }}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 21 }}>
                {"You haven't added a bio yet — edit your profile from Me to tell your story."}
              </Text>
            </View>
          ) : null}
        </View>
        </View>

        {/* Strength nudge — shown to the viewer after they've seen the profile, not over the photo */}
        {showStrengthNudge ? (
          <ProfileCompletionNudgeBanner
            percent={viewerStrength.percent}
            nextLabel={viewerStrength.nextMissing?.label ?? null}
            onCompletePress={() => router.push('/(tabs)/me')}
            onDismiss={() => setStrengthBannerDismissed(true)}
          />
        ) : null}

        {/* Collapse-toggle: deep-dive sections stay hidden by default so the
            quick view drives the decision; tap to reveal the full profile. */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setDetailsExpanded((p) => !p)}
          style={pr.detailsToggle}
        >
          <Text style={pr.detailsToggleLabel}>
            {detailsExpanded ? 'Close' : `Discover more about ${profileFirstName}`}
          </Text>
          <Ionicons
            name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textStrong}
          />
        </TouchableOpacity>

        {detailsExpanded ? (
        <>
        {/* Personal — identity basics. ReadOnlyRow auto-hides null fields.
            Location / Languages / Ethnicity / Occupation / Looking-for live in
            Quick Facts above, so they're not duplicated here. */}
        <View>
        <View style={pr.sectionCard}>
          <Text style={pr.sectionTitle}>Personal</Text>
          <ReadOnlyRow icon="person-outline"   label="Gender"        value={GENDER_LABEL[profile.gender] ?? profile.gender} />
          <ReadOnlyRow icon="calendar-outline" label="Age"           value={profile.age ? `${profile.age} years old` : null} />
          <ReadOnlyRow icon="search-outline"   label="Interested in" value={interestedInLabel} />
          {showHeritage ? (
            <ReadOnlyRow icon="flag-outline"   label="Origin"        value={heritageLine} />
          ) : null}
          <ReadOnlyRow icon="sunny-outline"    label="Religion"      value={religionLabel} isLast />
        </View>
        </View>

        {/* Physical — hidden when nothing is filled */}
        {(!!profile.height_cm || !!profile.body_type || profile.weight_kg != null) && (() => {
          const hasH = !!profile.height_cm;
          const hasB = !!bodyTypeLabel;
          const hasW = profile.weight_kg != null;
          return (
          <View>
          <View style={pr.sectionCard}>
            <Text style={pr.sectionTitle}>Physical</Text>
            <ReadOnlyRow
              icon="resize-outline"
              label="Height"
              value={profile.height_cm ? `${(profile.height_cm / 100).toFixed(2)} m` : null}
              isLast={hasH && !hasB && !hasW}
            />
            <ReadOnlyRow icon="body-outline" label="Body type" value={bodyTypeLabel} isLast={hasB && !hasW} />
            <ReadOnlyRow
              icon="barbell-outline"
              label="Weight"
              value={profile.weight_kg != null ? `${profile.weight_kg} kg` : null}
              isLast={hasW}
            />
          </View>
          </View>
          );
        })()}

        {/* Family — life stage & future. Marital status now lives with the rest
            of the family signals instead of being split off into Personal. */}
        {(!!maritalLabel || profile.has_children != null || !!profile.want_children) && (() => {
          const hasM = !!maritalLabel;
          const hasHasK = profile.has_children != null;
          const hasWantK = !!wantChildLabel;
          return (
          <View>
          <View style={pr.sectionCard}>
            <Text style={pr.sectionTitle}>Family</Text>
            <ReadOnlyRow
              icon="heart-outline"
              label="Marital status"
              value={maritalLabel}
              isLast={hasM && !hasHasK && !hasWantK}
            />
            <ReadOnlyRow
              icon="people-outline"
              label="Has children"
              value={profile.has_children == null ? null : profile.has_children ? 'Yes' : 'No'}
              isLast={hasHasK && !hasWantK}
            />
            <ReadOnlyRow
              icon="happy-outline"
              label="Wants children"
              value={wantChildLabel}
              isLast={hasWantK}
            />
          </View>
          </View>
          );
        })()}

        {/* Education — occupation already lives in Quick Facts as "Works as" */}
        {!!educationLabel && (
          <View>
          <View style={pr.sectionCard}>
            <Text style={pr.sectionTitle}>Education</Text>
            <ReadOnlyRow icon="school-outline" label="Education" value={educationLabel} isLast />
          </View>
          </View>
        )}

        {/* Hobbies */}
        {(profile.hobbies ?? []).length > 0 && (
          <View>
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
          </View>
        )}
        </>
        ) : null}

        {/* Swipe-up hint — a flick upward at the bottom jumps to the next
            profile (handled by the wrapping PanGestureHandler). Static, no
            armed state — we commit purely on swipe velocity on release. */}
        {!isOwnProfile && galleryHasNextProfile ? (
          <View style={pr.upNextFooter}>
            <View style={pr.upNextHandle} />
            <Ionicons
              name="chevron-up"
              size={22}
              color={COLORS.textMuted}
              accessibilityLabel="Swipe up for next profile"
            />
          </View>
        ) : null}
      </ScrollView>
      </Animated.View>
      </PanGestureHandler>

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
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              backgroundColor: 'transparent',
              transform: [{ scale: btnScaleAnim }],
              opacity: btnOpacityAnim,
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
                size={24}
                color={isFavourite ? COLORS.gold : COLORS.text}
              />
            </TouchableOpacity>
            {/* Like — larger control */}
            <TouchableOpacity
              onPress={handleLike}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
              style={[
                floatingActionCircle,
                {
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  backgroundColor: COLORS.white,
                  ...SHADOWS.lg,
                },
              ]}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={32}
                color={isLiked ? COLORS.textStrong : COLORS.text}
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
                color={recipientMessagesPaused ? COLORS.textMuted : COLORS.textStrong}
              />
            </TouchableOpacity>
          </Animated.View>
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
            {photoViewerVisible && profile ? (
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
            ) : null}
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
                  backgroundColor: COLORS.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...SHADOWS.md,
                }}
              >
                <Ionicons name="close" size={26} color={COLORS.text} />
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
                <TouchableOpacity
                  onPress={handleFavourite}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                  style={floatingActionCircle}
                >
                  <Ionicons
                    name={isFavourite ? 'star' : 'star-outline'}
                    size={24}
                    color={isFavourite ? COLORS.gold : COLORS.text}
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
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: COLORS.white,
                      ...SHADOWS.lg,
                    },
                  ]}
                >
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={32}
                    color={isLiked ? COLORS.textStrong : COLORS.text}
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
                    color={recipientMessagesPaused ? COLORS.textMuted : COLORS.textStrong}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {viewerToast ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: Math.max(insets.bottom + 110, 130),
                alignItems: 'center',
                opacity: viewerToastAnim,
                transform: [{ scale: viewerToastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(17,17,17,0.92)',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                }}
              >
                <Ionicons name={viewerToast.icon} size={14} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: '600' }}>
                  {viewerToast.message}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={profileHeroMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileHeroMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setProfileHeroMenuVisible(false)}
        >
          <View
            style={{
              backgroundColor: COLORS.white,
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              paddingBottom: Math.max(insets.bottom + 12, 20),
              paddingTop: 8,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: 8 }} />
            <TouchableOpacity
              onPress={() => {
                setProfileHeroMenuVisible(false);
                void handleShareProfile();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 20,
              }}
            >
              <Ionicons name="share-outline" size={22} color={COLORS.text} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>Share profile</Text>
            </TouchableOpacity>
            {!isOwnProfile ? (
              <>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 20 }} />
                <TouchableOpacity
                  onPress={() => {
                    setProfileHeroMenuVisible(false);
                    void handleReport();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                  }}
                >
                  <Ionicons name="flag-outline" size={22} color={COLORS.text} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>Report</Text>
                </TouchableOpacity>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 20 }} />
                <TouchableOpacity
                  onPress={() => {
                    setProfileHeroMenuVisible(false);
                    handleBlock();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                  }}
                >
                  <Ionicons name="ban-outline" size={22} color={COLORS.error} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.error }}>Block</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => setProfileHeroMenuVisible(false)}
              style={{ marginTop: 8, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <MatchModal
        visible={!!matchUser}
        matchedUser={matchUser}
        onClose={() => setMatchUser(null)}
      />

      {currentUser && profile ? (
        <ReportUserModal
          visible={reportPromptVisible}
          onClose={() => setReportPromptVisible(false)}
          reporterId={currentUser.id}
          reportedUserId={profile.id}
          reportedUserName={profile.full_name ?? 'User'}
        />
      ) : null}

      <Modal visible={needsDiscoverGate} transparent animationType="fade"
        onRequestClose={() => router.back()}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
              Finish your profile
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
              Add your basics (name, birthday, gender, and country) before browsing others. Who you see is based on your gender.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.back()}
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Go back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (session) router.replace(onboardingHrefFromSession(session));
                }}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.primary,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Continue setup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

const pr = StyleSheet.create({
  identityCard: {
    marginTop: -12,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    ...SHADOWS.md,
  },
  displayName: { fontSize: FONT.xxl + 4, fontWeight: FONT.extrabold, color: COLORS.textStrong, letterSpacing: 0.2 },
  displayAge: { fontSize: FONT.xl, fontWeight: FONT.normal, color: COLORS.textSecondary },
  locationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { fontSize: FONT.md, color: COLORS.text, fontWeight: FONT.semibold },
  chipHobby: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.savanna,
    borderWidth: 1,
    borderColor: `${COLORS.earth}35`,
  },
  chipHobbyText: { fontSize: FONT.sm, color: COLORS.earth, fontWeight: FONT.semibold },
  frostedCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  photoCounterPill: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  photoCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  collapsedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  collapsedHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 56,
  },
  collapsedBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'visible',
    marginLeft: 2,
  },
  collapsedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.savanna,
  },
  collapsedOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  collapsedName: {
    fontSize: 15,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
    letterSpacing: 0.1,
  },
  collapsedAge: {
    fontWeight: FONT.bold,
    color: COLORS.textSecondary,
  },
  collapsedStatus: {
    fontSize: 12,
    fontWeight: FONT.semibold,
    marginTop: 1,
  },
  collapsedMenuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  sharedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sharedHeaderText: {
    fontSize: 11,
    fontWeight: FONT.extrabold,
    color: COLORS.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sharedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sharedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.primary}12`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  sharedChipLang: {
    backgroundColor: COLORS.savanna,
    borderColor: `${COLORS.earth}30`,
  },
  sharedChipText: {
    fontSize: 12,
    color: COLORS.earth,
    fontWeight: FONT.semibold,
  },
  aboutBlock: { flexDirection: 'row', marginTop: 18, alignItems: 'flex-start' },
  aboutAccent: {
    width: 4,
    marginTop: 4,
    minHeight: 52,
    borderRadius: 2,
    backgroundColor: COLORS.textStrong,
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
  quickFactsBlock: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: 4,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  detailsToggleLabel: {
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
    letterSpacing: 0.2,
  },
  upNextFooter: {
    paddingTop: 28,
    paddingBottom: 56,
    alignItems: 'center',
    gap: 10,
  },
  upNextHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
  },
  quickFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  quickFactRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  quickFactIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFactLabel: {
    fontSize: 11,
    fontWeight: FONT.extrabold,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  quickFactValue: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textStrong,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: FONT.extrabold,
    color: COLORS.earth,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
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
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIconEmpty: {
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderColor: COLORS.emptyFieldBorder,
  },
  fieldLabel: { fontSize: FONT.xs, color: COLORS.textSecondary, fontWeight: FONT.semibold, marginBottom: 2 },
  fieldValue: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.semibold },
  fieldValueEmpty: {
    fontSize: FONT.md,
    color: COLORS.emptyField,
    fontWeight: FONT.semibold,
    fontStyle: 'italic',
  },
});

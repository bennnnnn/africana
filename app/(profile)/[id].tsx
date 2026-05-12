import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
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
  Platform,
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
import {
  COLORS,
  DEFAULT_AVATAR,
  INTERESTED_IN_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  LOOKING_FOR_OPTIONS,
  WANT_CHILDREN_YES_NO,
  OCCUPATION_OPTIONS,
  PHYSICAL_CONDITION_OPTIONS,
  RADIUS,
  SHADOWS,
} from '@/constants';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import { likesPathSegmentForNotifyType } from '@/constants/likes-routes';
import { UI_LABELS, UI_TOAST } from '@/constants/copy';
import { Button } from '@/components/ui/Button';
import { MatchModal } from '@/components/ui/MatchModal';
import {
  getProfileStrength,
  isProfileCompleteForDiscover,
  postAuthHref,
} from '@/lib/profile-completion';
import { ProfileCompletionNudgeBanner } from '@/components/profile/ProfileCompletionNudgeBanner';
import { useDialog } from '@/components/ui/DialogProvider';
import { ReportUserModal } from '@/components/ui/ReportUserModal';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { SkeletonProfile } from '@/components/ui/Skeleton';
import { track, EVENTS } from '@/lib/analytics';
import { addFavourite, blockUser, isBlockedRelationship } from '@/lib/social-actions';
import { recordProfileShareEvent, SHARE_REWARD_TOAST } from '@/lib/share-reward';
import { getProfileShareUrl } from '@/lib/share-profile-url';
import { getProfileSeed } from '@/lib/profile-seed-cache';
import { normalizeRouteParam } from '@/lib/chat-route-utils';
import {
  profileGalleryCache,
  buildFallbackPhotoList,
  warmPhotoUris,
  loadProfilePhotoList,
} from '@/lib/profile-gallery-cache';
import { ProfilePhotoGalleryPage } from '@/components/profile/ProfilePhotoGalleryPage';
import { ProfileReadOnlyFieldRow } from '@/components/profile/ProfileReadOnlyFieldRow';
import { ProfileDiscoverGateModal } from '@/components/profile/ProfileDiscoverGateModal';
import { pr } from '@/components/profile/profile-view-styles';
import {
  GENDER_LABEL,
  FLOAT_ACTION_SIZE,
  floatingActionCircle,
} from '@/components/profile/profile-view-constants';
import { getEffectivePresence, isUserEffectivelyOnline, isUuidString } from '@/lib/utils';
import { usePresenceStore } from '@/store/presence.store';
import { SPRING, SNAP_IN } from '@/lib/motion';

/** Relative "Seen … ago" label for profile activity row (not worth memoizing; depends on `Date.now()`). */
function formatShortLastSeenLabel(
  lastSeen: string | null | undefined,
  useLastActiveLabel: boolean,
): string | null {
  if (!useLastActiveLabel || !lastSeen) return null;
  const seenAt = new Date(lastSeen).getTime();
  if (Number.isNaN(seenAt)) return null;
  const diffMs = Date.now() - seenAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Seen just now';
  if (diffMin < 60) return `Seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Seen 1 day ago';
  if (diffDay < 7) return `Seen ${diffDay} days ago`;
  return 'Seen a while ago';
}

export default function ProfileViewScreen() {
  const {
    id: rawId,
    viewer: rawViewer,
    photo: rawPhoto,
  } = useLocalSearchParams<{
    id: string | string[];
    viewer?: string | string[];
    photo?: string | string[];
  }>();
  const idCandidate = normalizeRouteParam(rawId);
  const id = idCandidate && isUuidString(idCandidate) ? idCandidate : undefined;
  const viewerParam = normalizeRouteParam(rawViewer);
  const photoParam = normalizeRouteParam(rawPhoto);
  const routeWantsPhotoViewer = viewerParam === '1';
  const routePhotoIndex = Math.max(0, Number.parseInt(photoParam ?? '0', 10) || 0);
  const { user: currentUser, session } = useAuthStore(
    useShallow((s) => ({ user: s.user, session: s.session })),
  );
  const peerOnlineIds = usePresenceStore((s) => s.peerOnlineIds);
  const profileScrollRef = useRef<ScrollView>(null);
  const pullPanRef = useRef(null);
  const [strengthBannerDismissed, setStrengthBannerDismissed] = useState(false);

  // Scroll-driven action button animation
  const btnScaleAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
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

  const handleProfileScroll = useCallback(
    (e: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
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
        Animated.spring(btnScaleAnim, { toValue: 1, ...springCfg }).start();
      } else if (y > prev + 5) {
        Animated.spring(btnScaleAnim, { toValue: 0.72, ...springCfg }).start();
      } else if (y < prev - 5) {
        Animated.spring(btnScaleAnim, { toValue: 1, ...springCfg }).start();
      }

      // Track whether the scroll view is at its top or bottom edge. The pan
      // gesture below only commits a swipe when we're pinned against the
      // matching edge, so mid-profile vertical pans never trigger navigation.
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      scrollAtBottomRef.current = distanceFromBottom < 1;
      scrollAtTopRef.current = contentOffset.y <= 1;
    },
    [btnScaleAnim, scrollY],
  );

  const getOrCreateConversation = useChatStore((s) => s.getOrCreateConversation);
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore(
    useShallow((s) => ({
      likedUserIds: s.likedUserIds,
      toggleLike: s.toggleLike,
      fetchLikedUserIds: s.fetchLikedUserIds,
    })),
  );
  const { showDialog, showToast } = useDialog();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  // Keep the in-profile hero as a smaller preview so more of the profile fits
  // on screen. The fullscreen viewer remains the place for an immersive view.
  // We also cap the height against the viewport so tall photos don't dominate
  // the whole screen on smaller devices.
  const heroHeight = Math.min(winWidth * 1.18, winHeight * 0.56);
  const collapseStart = Math.max(heroHeight - 140, 80);
  const collapseEnd = Math.max(heroHeight - 70, 120);
  useEffect(() => {
    collapseStartRef.current = collapseStart;
  }, [collapseStart]);
  const collapsedOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [collapseStart, collapseEnd],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [collapseStart, collapseEnd, scrollY],
  );
  const collapsedTranslateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [collapseStart, collapseEnd],
        outputRange: [-10, 0],
        extrapolate: 'clamp',
      }),
    [collapseStart, collapseEnd, scrollY],
  );
  const heroTopChromeOpacity = useMemo(
    () =>
      scrollY.interpolate({
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
  const [viewerToast, setViewerToast] = useState<{
    icon: keyof typeof Ionicons.glyphMap;
    message: string;
  } | null>(null);
  const viewerToastAnim = useRef(new Animated.Value(0)).current;
  const viewerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showViewerToast = useCallback(
    (cfg: { icon: keyof typeof Ionicons.glyphMap; message: string }) => {
      if (viewerToastTimerRef.current) clearTimeout(viewerToastTimerRef.current);
      viewerToastAnim.setValue(0);
      setViewerToast(cfg);
      Animated.spring(viewerToastAnim, { toValue: 1, ...SPRING }).start();
      viewerToastTimerRef.current = setTimeout(() => {
        Animated.timing(viewerToastAnim, { toValue: 0, ...SNAP_IN }).start(() => {
          setViewerToast(null);
        });
      }, 1800);
    },
    [viewerToastAnim],
  );
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
  /** Symmetric block with the profile being viewed (for actions other than messaging). */
  const [relationshipBlocked, setRelationshipBlocked] = useState(false);
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
    if (!currentUser || !id || currentUser.id === id) {
      setRelationshipBlocked(false);
      return;
    }
    let cancelled = false;
    void isBlockedRelationship(currentUser.id, id).then((blocked) => {
      if (!cancelled) setRelationshipBlocked(blocked);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, id]);

  useEffect(() => {
    setPhotoViewerVisible(routeWantsPhotoViewer);
    if (routeWantsPhotoViewer) {
      setViewerPhotoIndex(routePhotoIndex);
    }
  }, [routePhotoIndex, routeWantsPhotoViewer, id]);

  const fetchProfile = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!id) {
        setIsLoading(false);
        setRefreshing(false);
        setLoadError(null);
        setProfile(null);
        return;
      }
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

      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_LIST_SELECT as '*')
        .eq('id', id)
        .maybeSingle();

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
          ? today.getFullYear() -
            bday.getFullYear() -
            (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
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

    // Pro-only: when the viewer has incognito on, skip the profile_views upsert
    // entirely so they browse silently. No row → no notification → no Views-tab entry.
    const incognito = useAuthStore.getState().settings?.incognito === true;
    if (incognito) {
      track(EVENTS.PROFILE_VIEWED);
      return;
    }

    // ignoreDuplicates:true → ON CONFLICT DO NOTHING. The .select() returns the
    // inserted row only on a true new insert — empty on conflict. This means we
    // notify exactly once per unique (viewer, viewed) pair, surviving app restarts
    // and clearing the need for the module-scoped Set entirely.
    void supabase
      .from('profile_views')
      .upsert(
        { viewer_id: currentUser.id, viewed_id: profile.id, viewed_at: new Date().toISOString() },
        { onConflict: 'viewer_id,viewed_id', ignoreDuplicates: true },
      )
      .select('id')
      .then(({ data }) => {
        if (data && data.length > 0) {
          notifyUser({
            type: 'view',
            recipientId: profile.id,
            senderId: currentUser.id,
            senderName: currentUser.full_name ?? 'Someone',
            extra: { userId: currentUser.id, likesSegment: likesPathSegmentForNotifyType('view') },
          });
        }
      });
    track(EVENTS.PROFILE_VIEWED);
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
    if (Platform.OS === 'web') return undefined;
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
    if (Platform.OS === 'web') return undefined;
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
    if (
      prevProfileIdInPhotoViewerRef.current &&
      prevProfileIdInPhotoViewerRef.current !== profile.id
    ) {
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
    const photosToWarm =
      safePhotos.length > 0
        ? safePhotos
        : [
            profile.avatar_url ||
              `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`,
          ];
    void warmPhotoUris(photosToWarm.slice(0, 4));
  }, [profile]);

  const safePhotos = profile?.profile_photos ?? [];
  const photos = profile
    ? safePhotos.length > 0
      ? safePhotos
      : [
          profile.avatar_url ||
            `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`,
        ]
    : [];

  const scrollToHeroPhoto = useCallback(
    (index: number, animated = true) => {
      if (winWidth <= 0 || photos.length === 0) return;
      const nextIndex = Math.max(0, Math.min(index, photos.length - 1));
      setPhotoIndex(nextIndex);
      heroPhotoListRef.current?.scrollToOffset({
        offset: nextIndex * winWidth,
        animated,
      });
    },
    [photos.length, winWidth],
  );

  const replaceProfileRoute = useCallback(
    (nextUserId: string, options?: { openPhotoViewer?: boolean; photoIndex?: number }) => {
      router.replace({
        pathname: '/(profile)/[id]',
        params: options?.openPhotoViewer
          ? { id: nextUserId, viewer: '1', photo: String(options.photoIndex ?? 0) }
          : { id: nextUserId },
      });
    },
    [],
  );

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

  const onPullPanStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const s = e.nativeEvent.state;
      if (s !== GestureState.END) return;

      const { translationY, velocityY } = e.nativeEvent;

      const swipedUp = translationY < -SWIPE_DIST_PX || velocityY < -SWIPE_VELOCITY;
      const swipedDown = translationY > SWIPE_DIST_PX || velocityY > SWIPE_VELOCITY;

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
    },
    [profile?.id, goNextProfile],
  );

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

  const photoViewerPanResponder = useMemo(
    () =>
      PanResponder.create({
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
      }),
    [
      galleryHasNextProfile,
      galleryHasPrevProfile,
      goNextProfileInGallery,
      goPrevProfileInGallery,
      photoViewerSwipeX,
      photoViewerSwipeY,
      photoViewerVisible,
      resetPhotoViewerSwipe,
    ],
  );

  const handleShareProfile = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const url = getProfileShareUrl(profile.id);
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

  if (!id) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: COLORS.white,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
        <Text
          style={{
            marginTop: 16,
            fontSize: 18,
            fontWeight: '800',
            color: COLORS.textStrong,
            textAlign: 'center',
          }}
        >
          Invalid profile link
        </Text>
        <Text
          style={{ marginTop: 8, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}
        >
          This link is missing a valid profile id (for example a bad notification or share URL).
        </Text>
        <Button
          title="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/discover'))}
          style={{ marginTop: 24 }}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <SkeletonProfile />;
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: COLORS.white,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {loadError ? (
          <>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textMuted} />
            <Text
              style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: '800',
                color: COLORS.textStrong,
                textAlign: 'center',
              }}
            >
              Could not load profile
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: COLORS.textSecondary,
                textAlign: 'center',
              }}
            >
              {loadError}
            </Text>
            <Button
              title="Try again"
              onPress={() => void fetchProfile()}
              style={{ marginTop: 20 }}
            />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>
              Profile not found
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: COLORS.textSecondary,
                textAlign: 'center',
              }}
            >
              This profile may have been removed or the link is invalid.
            </Text>
          </>
        )}
        <Button
          title="Go back"
          onPress={() => router.back()}
          variant="ghost"
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  const religionLabel = profile.religion
    ? (RELIGION_OPTIONS.find((r) => r.value === profile.religion)?.label ?? profile.religion)
    : null;
  const educationLabel = profile.education
    ? (EDUCATION_OPTIONS.find((e) => e.value === profile.education)?.label ?? profile.education)
    : null;
  const maritalLabel = profile.marital_status
    ? (MARITAL_STATUS_OPTIONS.find((m) => m.value === profile.marital_status)?.label ??
      profile.marital_status)
    : null;
  const wantChildLabel = profile.want_children
    ? (WANT_CHILDREN_YES_NO.find((o) => o.value === profile.want_children)?.label ??
      profile.want_children)
    : null;
  const bodyTypeLabel = profile.body_type
    ? (PHYSICAL_CONDITION_OPTIONS.find((o) => o.value === profile.body_type)?.label ??
      profile.body_type)
    : null;
  const occupationLabel = profile.occupation
    ? (OCCUPATION_OPTIONS.find((o) => o.value === profile.occupation)?.label ?? profile.occupation)
    : null;
  const interestedInLabel =
    INTERESTED_IN_OPTIONS.find((o) => o.value === profile.interested_in)?.label ??
    profile.interested_in ??
    null;

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const heritageLine = [profile.origin_city, profile.origin_state, profile.origin_country]
    .filter(Boolean)
    .join(', ');
  const showHeritage =
    heritageLine.length > 0 &&
    heritageLine.trim().toLowerCase() !== (location || '').trim().toLowerCase();
  const isVerified = profile.verified === true || profile.verification_status === 'approved';
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;
  /** Viewers respect `online_visible`; your own card uses freshness only (matches previous behavior). */
  const displayOnlineStatus: 'online' | 'offline' = isOwnProfile
    ? isUserEffectivelyOnline(profile.online_status, profile.last_seen)
      ? 'online'
      : 'offline'
    : getEffectivePresence(
        {
          id: profile.id,
          online_visible: profile.online_visible,
          online_status: profile.online_status,
          last_seen: profile.last_seen ?? '',
        },
        peerOnlineIds,
      );

  const recipientMessagesPaused = !isOwnProfile && profile.accepts_messages === false;

  /** Single activity treatment: online badge, or last-active time when available, else offline. */
  const isActiveOnline = displayOnlineStatus === 'online';
  const useLastActiveLabel =
    !isActiveOnline && !isOwnProfile && profile.online_visible !== false && !!profile.last_seen;
  const shortLastSeenLabel = formatShortLastSeenLabel(profile.last_seen, useLastActiveLabel);
  const activityLabel = isActiveOnline ? 'Online' : (shortLastSeenLabel ?? 'Offline');

  const photoModalDotBottom =
    !isOwnProfile && currentUser
      ? Math.max(insets.bottom + FLOAT_ACTION_SIZE + 28, 94)
      : Math.max(insets.bottom + 16, 24);

  const normalizeText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
  const viewerLanguages = new Set(
    (currentUser?.languages ?? []).map((lang) => normalizeText(lang)).filter(Boolean),
  );
  const viewerHobbies = new Set(
    (currentUser?.hobbies ?? []).map((h) => normalizeText(h)).filter(Boolean),
  );
  const commonHobbies = !isOwnProfile
    ? (profile.hobbies ?? []).filter((h) => viewerHobbies.has(normalizeText(h)))
    : [];
  const commonLanguages = !isOwnProfile
    ? (profile.languages ?? []).filter((l) => viewerLanguages.has(normalizeText(l)))
    : [];

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
      if (!wasLiked && relationshipBlocked) {
        showToast({ message: UI_TOAST.interactionBlocked, icon: 'ban-outline' });
        return;
      }
      if (!wasLiked) haptics.tapLight();
      const isMatch = await toggleLike(currentUser.id, profile.id);
      if (isMatch && !wasLiked) {
        haptics.success();
        setMatchUser(profile);
      } else {
        const toastCfg = {
          icon: (wasLiked ? 'heart-outline' : 'heart') as keyof typeof Ionicons.glyphMap,
          message: wasLiked ? UI_TOAST.likeRemoved : UI_TOAST.liked,
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
    if (relationshipBlocked) {
      showToast({ icon: 'ban-outline', message: UI_TOAST.openChatBlocked });
      return;
    }
    const wasInViewer = photoViewerVisible;
    if (wasInViewer) {
      // Use closePhotoViewer (not raw setState) so the viewer/photo route
      // params get reset — otherwise navigating back to the profile from the
      // chat reopens the photo viewer.
      closePhotoViewer();
    }
    let convResult: Awaited<ReturnType<typeof getOrCreateConversation>> | null = null;
    try {
      convResult = await getOrCreateConversation(currentUser.id, profile.id);
    } catch {
      // fall through to error handling below
    }
    if (!convResult?.ok) {
      showToast({
        icon: 'alert-circle-outline',
        message:
          convResult?.reason === 'blocked' ? UI_TOAST.openChatBlocked : UI_TOAST.openChatFailed,
      });
      return;
    }
    const convId = convResult.conversationId;
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
        showToast({ icon: 'alert-circle-outline', message: UI_TOAST.favouritesUpdateFailed });
        return;
      }
      const toastCfg = {
        icon: 'star-outline' as keyof typeof Ionicons.glyphMap,
        message: UI_TOAST.favouriteRemoved,
      };
      if (photoViewerVisible) showViewerToast(toastCfg);
      else showToast(toastCfg);
    } else {
      setIsFavourite(true);
      try {
        const result = await addFavourite(currentUser.id, profile.id);
        if (result === 'blocked') {
          setIsFavourite(false);
          showToast({ icon: 'ban-outline', message: UI_TOAST.interactionBlocked });
          return;
        }
      } catch {
        setIsFavourite(false);
        showToast({ icon: 'alert-circle-outline', message: UI_TOAST.favouritesUpdateFailed });
        return;
      }
      const toastCfg = {
        icon: 'star' as keyof typeof Ionicons.glyphMap,
        message: UI_TOAST.favouriteAdded,
      };
      if (photoViewerVisible) showViewerToast(toastCfg);
      else showToast(toastCfg);
      track(EVENTS.FAVOURITE_ADDED);
      void notifyUser({
        type: 'favourite',
        recipientId: profile.id,
        senderId: currentUser.id,
        senderName: currentUser.full_name ?? 'Someone',
        extra: { userId: currentUser.id, likesSegment: likesPathSegmentForNotifyType('favourite') },
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
      title: `Block ${profile.full_name}?`,
      message: "They won't see your profile or message you.",
      icon: 'ban-outline',
      actions: [
        { label: UI_LABELS.cancel, style: 'cancel' },
        { label: UI_LABELS.block, style: 'destructive', onPress: () => void confirmBlockUser() },
      ],
    });
  };

  const handleReport = () => {
    if (!currentUser || !profile) return;
    setReportPromptVisible(true);
  };

  const confirmBlockUser = async () => {
    if (!currentUser || !profile) return;
    try {
      await blockUser(currentUser.id, profile.id);
      showToast({ icon: 'ban-outline', message: UI_TOAST.blocked });
      setTimeout(() => router.back(), 1300);
    } catch {
      showToast({ icon: 'alert-circle-outline', message: UI_TOAST.blockFailed });
    }
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
            <Text
              numberOfLines={1}
              style={[
                pr.collapsedStatus,
                { color: isActiveOnline ? COLORS.online : COLORS.textMuted },
              ]}
            >
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
            <View
              style={{
                position: 'relative',
                backgroundColor: COLORS.savanna,
                overflow: 'hidden',
                borderBottomLeftRadius: RADIUS.xxl,
                borderBottomRightRadius: RADIUS.xxl,
              }}
            >
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
                style={{ width: winWidth, height: heroHeight }}
                onMomentumScrollEnd={(e) => {
                  if (winWidth <= 0) return;
                  setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / winWidth));
                }}
                renderItem={({ item: photo, index: i }) => (
                  <Pressable
                    onPress={() => handleHeroPhotoTap(i)}
                    android_disableSound
                    style={{ width: winWidth, height: heroHeight, backgroundColor: COLORS.savanna }}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={{
                        width: winWidth,
                        height: heroHeight,
                        backgroundColor: COLORS.savanna,
                      }}
                      contentFit="cover"
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
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: heartBurstOpacity,
                  transform: [{ scale: heartBurstScale }],
                }}
              >
                <Ionicons
                  name="heart"
                  size={110}
                  color="#FFFFFF"
                  style={{
                    textShadowColor: 'rgba(0,0,0,0.35)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 12,
                  }}
                />
              </Animated.View>

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

              {photos.length > 1 ? (
                <View style={pr.heroDotsRow}>
                  {photos.map((_, index) => {
                    const active = index === photoIndex;
                    return (
                      <TouchableOpacity
                        key={`hero-dot-${index}`}
                        onPress={() => scrollToHeroPhoto(index)}
                        accessibilityLabel={`View photo ${index + 1}`}
                        activeOpacity={0.85}
                        style={[pr.heroDot, active && pr.heroDotActive]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* Identity — overlaps hero */}
            <View>
              <View style={pr.identityCard}>
                <View style={pr.identityHeaderBlock}>
                  <View style={pr.identityTitleRow}>
                    <View style={pr.identityNameWrap}>
                      <Text style={pr.displayName} numberOfLines={1}>
                        {profile.full_name}
                        {profile.age ? <Text style={pr.displayAge}>, {profile.age}</Text> : null}
                      </Text>
                    </View>
                    {activityLabel ? (
                      <View style={pr.identityStatusInline}>
                        <View
                          style={[
                            pr.onlineBadgeDot,
                            { backgroundColor: isActiveOnline ? COLORS.online : COLORS.textMuted },
                          ]}
                        />
                        <Text
                          style={[
                            pr.onlineBadgeText,
                            { color: isActiveOnline ? COLORS.online : COLORS.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {activityLabel}
                        </Text>
                      </View>
                    ) : null}
                    {isVerified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={COLORS.success}
                        style={pr.verifiedInlineIcon}
                      />
                    ) : null}
                  </View>

                  {location ? (
                    <View style={pr.identitySubRow}>
                      <View style={pr.identityLocationRow}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={pr.identityLocationText} numberOfLines={1}>
                          {location}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Quick Facts — dense at-a-glance summary, lives inside the identity card */}
                {(() => {
                  type QuickFact = {
                    icon: keyof typeof Ionicons.glyphMap;
                    label: string;
                    value: string | null;
                  };
                  const rows: QuickFact[] = [
                    {
                      icon: 'sparkles-outline',
                      label: 'Looking for',
                      value:
                        (profile.looking_for ?? []).length > 0
                          ? (profile.looking_for ?? [])
                              .map(
                                (lf) =>
                                  LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ??
                                  lf.replace('_', ' '),
                              )
                              .join(' · ')
                          : null,
                    },
                    {
                      icon: 'chatbubbles-outline',
                      label: 'Speaks',
                      value:
                        (profile.languages ?? []).length > 0
                          ? (profile.languages ?? []).join(', ')
                          : null,
                    },
                    {
                      icon: 'briefcase-outline',
                      label: 'Works as',
                      value: occupationLabel || null,
                    },
                    { icon: 'globe-outline', label: 'Ethnicity', value: profile.ethnicity || null },
                  ];
                  const quickFacts = rows.filter(
                    (row): row is QuickFact & { value: string } => !!row.value,
                  );

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
                {commonHobbies.length > 0 || commonLanguages.length > 0 ? (
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
                          <Text style={pr.sharedChipText}>
                            +{commonHobbies.length + commonLanguages.length - 7}
                          </Text>
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
                  <View
                    style={{
                      marginTop: 14,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: `${COLORS.savanna}88`,
                      borderRadius: RADIUS.md,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: COLORS.textSecondary,
                        fontStyle: 'italic',
                        lineHeight: 21,
                      }}
                    >
                      {
                        "You haven't added a bio yet — edit your profile from Me to tell your story."
                      }
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
                {detailsExpanded ? 'Show less' : 'More details'}
              </Text>
              <Ionicons
                name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={COLORS.textStrong}
              />
            </TouchableOpacity>

            {detailsExpanded ? (
              <>
                {/* Personal — identity basics. ProfileReadOnlyFieldRow auto-hides null fields.
            Location / Languages / Ethnicity / Occupation / Looking-for live in
            Quick Facts above, so they're not duplicated here. */}
                <View>
                  <View style={pr.sectionCard}>
                    <Text style={pr.sectionTitle}>Personal</Text>
                    <ProfileReadOnlyFieldRow
                      icon="person-outline"
                      label="Gender"
                      value={GENDER_LABEL[profile.gender] ?? profile.gender}
                    />
                    <ProfileReadOnlyFieldRow
                      icon="calendar-outline"
                      label="Age"
                      value={profile.age ? `${profile.age} years old` : null}
                    />
                    <ProfileReadOnlyFieldRow
                      icon="search-outline"
                      label="Interested in"
                      value={interestedInLabel}
                    />
                    {showHeritage ? (
                      <ProfileReadOnlyFieldRow
                        icon="flag-outline"
                        label="Origin"
                        value={heritageLine}
                      />
                    ) : null}
                    <ProfileReadOnlyFieldRow
                      icon="sunny-outline"
                      label="Religion"
                      value={religionLabel}
                      isLast
                    />
                  </View>
                </View>

                {/* Physical — hidden when nothing is filled */}
                {(!!profile.height_cm || !!profile.body_type || profile.weight_kg != null) &&
                  (() => {
                    const hasH = !!profile.height_cm;
                    const hasB = !!bodyTypeLabel;
                    const hasW = profile.weight_kg != null;
                    return (
                      <View>
                        <View style={pr.sectionCard}>
                          <Text style={pr.sectionTitle}>Physical</Text>
                          <ProfileReadOnlyFieldRow
                            icon="resize-outline"
                            label="Height"
                            value={
                              profile.height_cm ? `${(profile.height_cm / 100).toFixed(2)} m` : null
                            }
                            isLast={hasH && !hasB && !hasW}
                          />
                          <ProfileReadOnlyFieldRow
                            icon="body-outline"
                            label="Body type"
                            value={bodyTypeLabel}
                            isLast={hasB && !hasW}
                          />
                          <ProfileReadOnlyFieldRow
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
                {(!!maritalLabel || profile.has_children != null || !!profile.want_children) &&
                  (() => {
                    const hasM = !!maritalLabel;
                    const hasHasK = profile.has_children != null;
                    const hasWantK = !!wantChildLabel;
                    return (
                      <View>
                        <View style={pr.sectionCard}>
                          <Text style={pr.sectionTitle}>Family</Text>
                          <ProfileReadOnlyFieldRow
                            icon="heart-outline"
                            label="Marital status"
                            value={maritalLabel}
                            isLast={hasM && !hasHasK && !hasWantK}
                          />
                          <ProfileReadOnlyFieldRow
                            icon="people-outline"
                            label="Has children"
                            value={
                              profile.has_children == null
                                ? null
                                : profile.has_children
                                  ? 'Yes'
                                  : 'No'
                            }
                            isLast={hasHasK && !hasWantK}
                          />
                          <ProfileReadOnlyFieldRow
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
                      <ProfileReadOnlyFieldRow
                        icon="school-outline"
                        label="Education"
                        value={educationLabel}
                        isLast
                      />
                    </View>
                  </View>
                )}

                {/* Hobbies */}
                {(profile.hobbies ?? []).length > 0 && (
                  <View>
                    <View style={pr.sectionCard}>
                      <Text style={pr.sectionTitle}>Hobbies & Interests</Text>
                      <View
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}
                      >
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
          {recipientMessagesPaused ? (
            <View style={pr.messagePausedNote}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.textSecondary} />
              <Text style={pr.messagePausedNoteText}>
                {"This person isn't accepting messages right now."}
              </Text>
            </View>
          ) : null}
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              backgroundColor: 'transparent',
              transform: [{ scale: btnScaleAnim }],
            }}
          >
            <TouchableOpacity
              onPress={handleFavourite}
              disabled={relationshipBlocked && !isFavourite}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              accessibilityState={{ disabled: relationshipBlocked && !isFavourite }}
              style={[
                floatingActionCircle,
                relationshipBlocked && !isFavourite && { opacity: 0.55 },
              ]}
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
              disabled={relationshipBlocked && !isLiked}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
              accessibilityState={{ disabled: relationshipBlocked && !isLiked }}
              style={[
                floatingActionCircle,
                {
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  backgroundColor: COLORS.white,
                  ...SHADOWS.lg,
                },
                relationshipBlocked && !isLiked && { opacity: 0.55 },
              ]}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={32}
                color={isLiked ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMessage}
              disabled={recipientMessagesPaused || relationshipBlocked}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                relationshipBlocked
                  ? 'Messaging blocked'
                  : recipientMessagesPaused
                    ? 'Messages paused'
                    : 'Message'
              }
              accessibilityState={{ disabled: recipientMessagesPaused || relationshipBlocked }}
              style={[
                floatingActionCircle,
                (recipientMessagesPaused || relationshipBlocked) && { opacity: 0.55 },
              ]}
            >
              <Ionicons
                name={
                  relationshipBlocked
                    ? 'ban-outline'
                    : recipientMessagesPaused
                      ? 'lock-closed-outline'
                      : 'chatbubble-ellipses-outline'
                }
                size={26}
                color={
                  relationshipBlocked || recipientMessagesPaused
                    ? COLORS.textMuted
                    : COLORS.textStrong
                }
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
              transform: [{ translateX: photoViewerSwipeX }, { translateY: photoViewerSwipeY }],
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
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'transparent',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingTop: 4,
                gap: 10,
              }}
            >
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
                  disabled={relationshipBlocked && !isFavourite}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                  accessibilityState={{ disabled: relationshipBlocked && !isFavourite }}
                  style={[
                    floatingActionCircle,
                    relationshipBlocked && !isFavourite && { opacity: 0.55 },
                  ]}
                >
                  <Ionicons
                    name={isFavourite ? 'star' : 'star-outline'}
                    size={24}
                    color={isFavourite ? COLORS.gold : COLORS.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLike}
                  disabled={relationshipBlocked && !isLiked}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
                  accessibilityState={{ disabled: relationshipBlocked && !isLiked }}
                  style={[
                    floatingActionCircle,
                    {
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: COLORS.white,
                      ...SHADOWS.lg,
                    },
                    relationshipBlocked && !isLiked && { opacity: 0.55 },
                  ]}
                >
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={32}
                    color={isLiked ? COLORS.primary : COLORS.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleMessage}
                  disabled={recipientMessagesPaused || relationshipBlocked}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    relationshipBlocked
                      ? 'Messaging blocked'
                      : recipientMessagesPaused
                        ? 'Messages paused'
                        : 'Message'
                  }
                  accessibilityState={{ disabled: recipientMessagesPaused || relationshipBlocked }}
                  style={[
                    floatingActionCircle,
                    (recipientMessagesPaused || relationshipBlocked) && { opacity: 0.55 },
                  ]}
                >
                  <Ionicons
                    name={
                      relationshipBlocked
                        ? 'ban-outline'
                        : recipientMessagesPaused
                          ? 'lock-closed-outline'
                          : 'chatbubble-ellipses-outline'
                    }
                    size={26}
                    color={
                      relationshipBlocked || recipientMessagesPaused
                        ? COLORS.textMuted
                        : COLORS.textStrong
                    }
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
                transform: [
                  {
                    scale: viewerToastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
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
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: COLORS.border,
                marginBottom: 8,
              }}
            />
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
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>
                Share profile
              </Text>
            </TouchableOpacity>
            {!isOwnProfile ? (
              <>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: COLORS.border,
                    marginLeft: 20,
                  }}
                />
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
                  <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textStrong }}>
                    Report
                  </Text>
                </TouchableOpacity>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: COLORS.border,
                    marginLeft: 20,
                  }}
                />
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
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.error }}>
                    Block
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => setProfileHeroMenuVisible(false)}
              style={{ marginTop: 8, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textSecondary }}>
                Cancel
              </Text>
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

      <ProfileDiscoverGateModal
        visible={needsDiscoverGate}
        onContinueSetup={() => {
          if (session && currentUser) router.replace(postAuthHref(currentUser, session));
        }}
      />
    </View>
  );
}

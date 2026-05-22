import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Share } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore, invalidateDiscoverCache } from '@/store/discover.store';
import { usePresenceStore } from '@/store/presence.store';
import haptics from '@/lib/haptics';
import { showLikeToggleFailure } from '@/lib/discover-like-result';
import { buildProfileDisplayModel, type ProfileDisplayModel } from '@/lib/profile-view-display';
import { addFavourite, blockUser, isBlockedRelationship } from '@/lib/social-actions';
import { recordProfileShareEvent, SHARE_REWARD_TOAST } from '@/lib/share-reward';
import { getProfileShareUrl } from '@/lib/share-profile-url';
import { getProfileSeed } from '@/lib/profile-seed-cache';
import {
  profileGalleryCache,
  buildFallbackPhotoList,
  warmPhotoUris,
} from '@/lib/profile-gallery-cache';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import { likesPathSegmentForNotifyType } from '@/constants/likes-routes';
import { UI_LABELS, UI_TOAST } from '@/constants/copy';
import { DEFAULT_AVATAR } from '@/constants';
import { track, EVENTS } from '@/lib/analytics';
import type { User } from '@/types';

export type ProfileViewToastConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
};

export type ProfileViewControllerUi = {
  showToast: (cfg: ProfileViewToastConfig) => void;
  showViewerToast: (cfg: ProfileViewToastConfig) => void;
  showDialog: (cfg: {
    title: string;
    message: string;
    icon: keyof typeof Ionicons.glyphMap;
    actions: Array<{
      label: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }>;
  }) => void;
  photoViewerVisible: boolean;
  closePhotoViewer: () => void;
};

export function useProfileViewController(
  profileId: string | undefined,
  ui: ProfileViewControllerUi,
) {
  const { user: currentUser } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const peerOnlineIds = usePresenceStore((s) => s.peerOnlineIds);
  const getOrCreateConversation = useChatStore((s) => s.getOrCreateConversation);
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore(
    useShallow((s) => ({
      likedUserIds: s.likedUserIds,
      toggleLike: s.toggleLike,
      fetchLikedUserIds: s.fetchLikedUserIds,
    })),
  );

  const [profile, setProfile] = useState<User | null>(() => getProfileSeed(profileId));
  const [isLoading, setIsLoading] = useState(() => !getProfileSeed(profileId));
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [relationshipBlocked, setRelationshipBlocked] = useState(false);
  const likeInFlightRef = useRef(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { showToast, showViewerToast, showDialog, photoViewerVisible, closePhotoViewer } = ui;

  const routeToast = useCallback(
    (cfg: ProfileViewToastConfig) => {
      if (photoViewerVisible) showViewerToast(cfg);
      else showToast(cfg);
    },
    [photoViewerVisible, showToast, showViewerToast],
  );

  useEffect(() => {
    setIsFavourite(false);
    setReportPromptVisible(false);
    setLoadError(null);
    const seed = getProfileSeed(profileId);
    if (seed) {
      setProfile(seed);
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (!currentUser || !profileId || currentUser.id === profileId) {
      setRelationshipBlocked(false);
      return;
    }
    let cancelled = false;
    void isBlockedRelationship(currentUser.id, profileId).then((blocked) => {
      if (!cancelled) setRelationshipBlocked(blocked);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, profileId]);

  const fetchProfile = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!profileId) {
        setIsLoading(false);
        setRefreshing(false);
        setLoadError(null);
        setProfile(null);
        return;
      }
      const bg = opts?.background === true;
      const hasExistingData = !!getProfileSeed(profileId);
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
        .eq('id', profileId)
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
        profileGalleryCache.set(profileId, galleryList);
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
    [profileId],
  );

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile || !currentUser?.id || currentUser.id === profile.id) return;

    const incognito = useAuthStore.getState().settings?.incognito === true;
    if (incognito) {
      track(EVENTS.PROFILE_VIEWED);
      return;
    }

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
    if (!profile) return;
    const safePhotos = profile.profile_photos ?? [];
    const photosToWarm =
      safePhotos.length > 0
        ? safePhotos
        : [
            profile.avatar_url ||
              `${DEFAULT_AVATAR}${encodeURIComponent((profile.full_name ?? '?').charAt(0))}`,
          ];
    void warmPhotoUris(photosToWarm.slice(0, 4));
  }, [profile]);

  const safePhotos = profile?.profile_photos ?? [];
  const photos = profile
    ? safePhotos.length > 0
      ? safePhotos
      : [
          profile.avatar_url ||
            `${DEFAULT_AVATAR}${encodeURIComponent((profile.full_name ?? '?').charAt(0))}`,
        ]
    : [];

  const display: ProfileDisplayModel | null = useMemo(
    () =>
      profile
        ? buildProfileDisplayModel({
            profile,
            currentUser,
            likedUserIds,
            peerOnlineIds,
          })
        : null,
    [profile, currentUser, likedUserIds, peerOnlineIds],
  );

  const handleLike = useCallback(async () => {
    if (!currentUser || !profile || likeInFlightRef.current) return;
    likeInFlightRef.current = true;
    try {
      const wasLiked = likedUserIds.has(profile.id);
      if (!wasLiked && relationshipBlocked) {
        showToast({ message: UI_TOAST.interactionBlocked, icon: 'ban-outline' });
        return;
      }
      if (!wasLiked) haptics.tapLight();
      const result = await toggleLike(currentUser.id, profile.id);
      if (!result.ok) {
        showLikeToggleFailure(result);
        return;
      }
      const isMatch = result.matched;
      if (isMatch && !wasLiked) {
        haptics.success();
        setMatchUser(profile);
      } else {
        routeToast({
          icon: wasLiked ? 'heart-outline' : 'heart',
          message: wasLiked ? UI_TOAST.likeRemoved : UI_TOAST.liked,
        });
      }
    } finally {
      likeInFlightRef.current = false;
    }
  }, [
    currentUser,
    profile,
    likedUserIds,
    relationshipBlocked,
    toggleLike,
    showToast,
    routeToast,
  ]);

  const handleMessage = useCallback(async () => {
    if (!currentUser || !profile || display?.recipientMessagesPaused) return;
    if (relationshipBlocked) {
      showToast({ icon: 'ban-outline', message: UI_TOAST.openChatBlocked });
      return;
    }
    const wasInViewer = photoViewerVisible;
    if (wasInViewer) closePhotoViewer();

    let convResult: Awaited<ReturnType<typeof getOrCreateConversation>> | null = null;
    try {
      convResult = await getOrCreateConversation(currentUser.id, profile.id);
    } catch {
      // fall through
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
      setTimeout(() => InteractionManager.runAfterInteractions(navigate), 220);
      return;
    }
    InteractionManager.runAfterInteractions(navigate);
  }, [
    currentUser,
    profile,
    display?.recipientMessagesPaused,
    relationshipBlocked,
    photoViewerVisible,
    closePhotoViewer,
    getOrCreateConversation,
    showToast,
  ]);

  const handleFavourite = useCallback(async () => {
    if (!currentUser || !profile) return;
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
      routeToast({ icon: 'star-outline', message: UI_TOAST.favouriteRemoved });
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
      routeToast({ icon: 'star', message: UI_TOAST.favouriteAdded });
      track(EVENTS.FAVOURITE_ADDED);
      void notifyUser({
        type: 'favourite',
        recipientId: profile.id,
        senderId: currentUser.id,
        senderName: currentUser.full_name ?? 'Someone',
        extra: { userId: currentUser.id, likesSegment: likesPathSegmentForNotifyType('favourite') },
      });
    }
  }, [currentUser, profile, isFavourite, routeToast, showToast]);

  const confirmBlockUser = useCallback(async () => {
    if (!currentUser || !profile) return;
    try {
      await blockUser(currentUser.id, profile.id);
      invalidateDiscoverCache();
      showToast({ icon: 'ban-outline', message: UI_TOAST.blocked });
      setTimeout(() => router.back(), 1300);
    } catch {
      showToast({ icon: 'alert-circle-outline', message: UI_TOAST.blockFailed });
    }
  }, [currentUser, profile, showToast]);

  const handleBlock = useCallback(() => {
    if (!profile) return;
    showDialog({
      title: `Block ${profile.full_name}?`,
      message: "They won't be able to message you. You won't see each other in Discover.",
      icon: 'ban-outline',
      actions: [
        { label: UI_LABELS.cancel, style: 'cancel' },
        { label: UI_LABELS.block, style: 'destructive', onPress: () => void confirmBlockUser() },
      ],
    });
  }, [profile, showDialog, confirmBlockUser]);

  const handleReport = useCallback(() => {
    if (!currentUser || !profile) return;
    setReportPromptVisible(true);
  }, [currentUser, profile]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable toast + profile id
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
  }, [profile, currentUser?.id, showToast]);

  const refreshProfile = useCallback(() => void fetchProfile({ background: true }), [fetchProfile]);

  return {
    profile,
    isLoading,
    loadError,
    refreshing,
    fetchProfile,
    refreshProfile,
    matchUser,
    setMatchUser,
    isFavourite,
    relationshipBlocked,
    reportPromptVisible,
    setReportPromptVisible,
    photos,
    display,
    likedUserIds,
    currentUser,
    handleLike,
    handleMessage,
    handleFavourite,
    handleBlock,
    handleReport,
    handleShareProfile,
    confirmBlockUser,
  };
}

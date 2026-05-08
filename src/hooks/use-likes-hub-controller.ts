import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { useChatStore } from '@/store/chat.store';
import { useActivityStore } from '@/store/activity.store';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import haptics from '@/lib/haptics';
import { User } from '@/types';
import { isUuidString } from '@/lib/utils';
import { fetchSymmetricBlockedPeerIds } from '@/lib/block-queries';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import {
  LIKES_TAB_ORDER,
  LIKES_LIST_STALE_MS,
  LIKES_SEEN_AT_COLUMN,
  type LikesTab,
} from '@/constants/likes-screen';
import { likesParamForTab, likesTabFromPathSegment } from '@/constants/likes-routes';
import {
  _likesTabOffsets,
  _likesTabHasMore,
  resetLikesTabPagination,
} from '@/lib/likes-tab-pagination';
import type { LikesHubListItem } from '@/lib/likes-fetch-users';
import { fetchUsersForLikesTab, prefetchLikesUserImages } from '@/lib/likes-fetch-users';
import { useDialog } from '@/components/ui/DialogProvider';
import { UI_TOAST } from '@/constants/copy';
import { useLikesLiveChannel } from '@/hooks/use-likes-live-channel';

export type LikesHubContextValue = {
  activeTab: LikesTab;
  activeList: LikesHubListItem[];
  activeError: string | null;
  activeLoadingMore: boolean;
  activeHasMore: boolean;
  showMessageButton: boolean;
  matchIds: Set<string>;
  counts: Record<LikesTab, number>;
  /** Per-tab *_seen_at markers; null until first load from `user_settings`. */
  activitySeenAt: Record<LikesTab, string | null> | null;
  refreshing: boolean;
  loadedTabs: Set<LikesTab>;
  handleTabPress: (t: LikesTab) => void;
  handleRefresh: () => Promise<void>;
  handleLoadMore: () => void;
  handleRetry: () => void;
  handleRowPress: (u: User) => void;
  handleMessageStable: (toUserId: string) => void;
};

export function useLikesHubController(): LikesHubContextValue {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string | string[] }>();
  const pathSeg = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const activeTab = likesTabFromPathSegment(typeof pathSeg === 'string' ? pathSeg : undefined);

  const user = useAuthStore((s) => s.user);
  const { showToast } = useDialog();
  const getOrCreateConversation = useChatStore((state) => state.getOrCreateConversation);

  const activeTabRef = useRef<LikesTab>(activeTab);
  activeTabRef.current = activeTab;

  const [lists, setLists] = useState<Record<LikesTab, LikesHubListItem[]>>({
    matches: [],
    received: [],
    viewers: [],
    favourites: [],
  });
  const [activitySeenAt, setActivitySeenAt] = useState<Record<LikesTab, string | null> | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState<Record<LikesTab, boolean>>({
    matches: false,
    received: false,
    viewers: false,
    favourites: false,
  });
  const [tabErrors, setTabErrors] = useState<Record<LikesTab, string | null>>({
    matches: null,
    received: null,
    viewers: null,
    favourites: null,
  });

  const counts = useActivityStore((state) => state.counts);
  const setStoreCounts = useActivityStore((state) => state.setCounts);
  const clearStoreTab = useActivityStore((state) => state.clearTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<LikesTab>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const blockedIdsRef = useRef<Set<string> | null>(null);
  const tabFetchedAtRef = useRef<Record<LikesTab, number>>({
    matches: 0,
    received: 0,
    viewers: 0,
    favourites: 0,
  });
  const tabInFlightRef = useRef<Record<LikesTab, Promise<void> | null>>({
    matches: null,
    received: null,
    viewers: null,
    favourites: null,
  });
  const fetchActivityCountsRef = useRef<() => Promise<Record<LikesTab, number> | null>>(
    async () => null,
  );

  const fetchBlockedSet = useCallback(
    async (force = false) => {
      if (!user) return new Set<string>();
      if (!force && blockedIdsRef.current) return blockedIdsRef.current;
      const ids = await fetchSymmetricBlockedPeerIds(user.id);
      const blockedIds = new Set(ids);
      blockedIdsRef.current = blockedIds;
      return blockedIds;
    },
    [user],
  );

  const loadTab = useCallback(
    async (t: LikesTab, force: boolean, isLoadMore = false) => {
      if (!user) return;
      const existing = tabInFlightRef.current[t];
      if (existing) {
        await existing;
        return;
      }
      const lastAt = tabFetchedAtRef.current[t] ?? 0;
      if (!force && !isLoadMore && Date.now() - lastAt < LIKES_LIST_STALE_MS) return;

      if (isLoadMore && !_likesTabHasMore[t]) return;

      if (isLoadMore) {
        setLoadingMore((prev) => ({ ...prev, [t]: true }));
      }
      setTabErrors((prev) => ({ ...prev, [t]: null }));

      const p = (async () => {
        try {
          const blockedSet = await fetchBlockedSet(force);
          const offset = isLoadMore ? _likesTabOffsets[t] : 0;
          const { items, hasMore } = await fetchUsersForLikesTab(
            t,
            user.id,
            blockedSet,
            PROFILE_LIST_SELECT,
            offset,
          );

          prefetchLikesUserImages(items);

          setLists((prev) => {
            const existingIds = new Set((prev[t] ?? []).map((it) => it.user.id));
            const newItems = items.filter((it) => !existingIds.has(it.user.id));
            return {
              ...prev,
              [t]: isLoadMore ? [...prev[t], ...newItems] : items,
            };
          });

          _likesTabOffsets[t] = offset + items.length;
          _likesTabHasMore[t] = hasMore;

          setLoadedTabs((prev) => {
            if (prev.has(t)) return prev;
            const next = new Set(prev);
            next.add(t);
            return next;
          });
          tabFetchedAtRef.current[t] = Date.now();
        } catch (err) {
          setTabErrors((prev) => ({
            ...prev,
            [t]: err instanceof Error ? err.message : 'Failed to load',
          }));
        } finally {
          if (isLoadMore) {
            setLoadingMore((prev) => ({ ...prev, [t]: false }));
          }
        }
      })();

      tabInFlightRef.current[t] = p;
      try {
        await p;
      } finally {
        if (tabInFlightRef.current[t] === p) tabInFlightRef.current[t] = null;
      }
    },
    [user, fetchBlockedSet],
  );

  const loadTabRef = useRef(loadTab);
  loadTabRef.current = loadTab;

  const fetchActivityCounts = useCallback(async (): Promise<Record<LikesTab, number> | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('activity_unseen_counts');
    if (error || data == null) return null;
    const d = data as Record<string, unknown>;
    const next: Record<LikesTab, number> = {
      matches: Number(d.matches) || 0,
      received: Number(d.received) || 0,
      viewers: Number(d.viewers) || 0,
      favourites: Number(d.favourites) || 0,
    };
    setStoreCounts(next);
    return next;
  }, [user, setStoreCounts]);

  fetchActivityCountsRef.current = fetchActivityCounts;

  const markTabSeen = useCallback(
    async (t: LikesTab) => {
      if (!user) return;
      const now = new Date().toISOString();
      const col = LIKES_SEEN_AT_COLUMN[t];
      clearStoreTab(t);
      setActivitySeenAt((prev) => {
        const base = prev ?? {
          matches: null,
          received: null,
          viewers: null,
          favourites: null,
        };
        return { ...base, [t]: now };
      });
      await supabase
        .from('user_settings')
        .update({ [col]: now })
        .eq('user_id', user.id);
    },
    [user, clearStoreTab],
  );

  useEffect(() => {
    if (!user) return;
    blockedIdsRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tabAtOpen = activeTab;

    void (async () => {
      // Run counts + primary list in parallel — awaiting RPC before loadTab
      // made the first match feel noticeably late.
      const [settingsRes] = await Promise.all([
        supabase
          .from('user_settings')
          .select('likes_seen_at, views_seen_at, favourites_seen_at, matches_seen_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        fetchActivityCountsRef.current(),
        loadTabRef.current(tabAtOpen, true),
      ]);
      if (!cancelled) {
        if (settingsRes.data) {
          const d = settingsRes.data;
          setActivitySeenAt({
            received: d.likes_seen_at ?? null,
            viewers: d.views_seen_at ?? null,
            favourites: d.favourites_seen_at ?? null,
            matches: d.matches_seen_at ?? null,
          });
        } else {
          setActivitySeenAt({
            received: null,
            viewers: null,
            favourites: null,
            matches: null,
          });
        }
      }
      if (cancelled) return;
      void markTabSeen(tabAtOpen);
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        for (const t of LIKES_TAB_ORDER) {
          if (t === tabAtOpen) continue;
          void loadTabRef.current(t, false);
        }
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, markTabSeen]);

  useLikesLiveChannel(user?.id, loadTabRef, fetchActivityCountsRef, tabFetchedAtRef, activeTabRef);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void fetchActivityCountsRef.current();
      void loadTabRef.current(activeTabRef.current, false);
    }, [user?.id]),
  );

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    resetLikesTabPagination(activeTab);
    await Promise.all([loadTab(activeTab, true), fetchActivityCounts()]);
    setRefreshing(false);
  }, [user, activeTab, loadTab, fetchActivityCounts]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore[activeTab]) return;
    void loadTab(activeTab, false, true);
  }, [activeTab, loadTab, loadingMore]);

  const handleRetry = useCallback(() => {
    setTabErrors((prev) => ({ ...prev, [activeTab]: null }));
    void loadTab(activeTab, true);
  }, [activeTab, loadTab]);

  const handleMessage = useCallback(
    async (toUserId: string) => {
      if (!user) return;
      const result = await getOrCreateConversation(user.id, toUserId);
      if (!result.ok) {
        showToast({
          icon: 'alert-circle-outline',
          message: result.reason === 'blocked' ? UI_TOAST.openChatBlocked : UI_TOAST.openChatFailed,
        });
        return;
      }
      router.push({
        pathname: '/(chat)/[id]',
        params: { id: result.conversationId, otherUserId: toUserId },
      });
    },
    [user, getOrCreateConversation, showToast],
  );

  const handleTabPress = useCallback(
    (t: LikesTab) => {
      if (t === activeTabRef.current) return;
      haptics.tapLight();
      router.setParams({ tab: likesParamForTab(t) });
      const c = useActivityStore.getState().counts[t] ?? 0;
      if (c > 0) {
        void markTabSeen(t);
      }
      void loadTabRef.current(t, false);
    },
    [markTabSeen],
  );

  const listsRef = useRef(lists);
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  const handleRowPress = useCallback(
    (u: User) => {
      if (!isUuidString(u?.id)) {
        showToast({ icon: 'alert-circle-outline', message: "Couldn't open profile. Try again." });
        return;
      }
      setProfileSeed(u);
      const list = listsRef.current[activeTabRef.current] ?? [];
      useProfileBrowseStore
        .getState()
        .setOrderedUserIds(
          list.map((x) => x.user.id).filter((id): id is string => isUuidString(id)),
        );
      router.push(`/(profile)/${u.id}`);
    },
    [showToast],
  );

  const handleMessageStable = useCallback(
    (toUserId: string) => {
      void handleMessage(toUserId);
    },
    [handleMessage],
  );

  const matchIds = useMemo(
    () => new Set((lists.matches ?? []).map((item) => item.user.id)),
    [lists.matches],
  );

  const activeList = lists[activeTab] ?? [];
  const activeError = tabErrors[activeTab];
  const activeLoadingMore = loadingMore[activeTab];
  const activeHasMore = _likesTabHasMore[activeTab];
  const showMessageButton = activeTab === 'matches';

  return {
    activeTab,
    activeList,
    activeError,
    activeLoadingMore,
    activeHasMore,
    showMessageButton,
    matchIds,
    counts,
    activitySeenAt,
    refreshing,
    loadedTabs,
    handleTabPress,
    handleRefresh,
    handleLoadMore,
    handleRetry,
    handleRowPress,
    handleMessageStable,
  };
}

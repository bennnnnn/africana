import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { useChatStore } from '@/store/chat.store';
import { useActivityStore } from '@/store/activity.store';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import { User } from '@/types';
import { COLORS, FONT, DEFAULT_AVATAR } from '@/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SkeletonRow } from '@/components/ui/Skeleton';

type Tab = 'matches' | 'received' | 'viewers' | 'favourites';

const PAGE_SIZE = 20;
const LIST_STALE_MS = 15_000;

const TAB_ORDER: Tab[] = ['matches', 'received', 'viewers', 'favourites'];

const TAB_META: Record<Tab, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}> = {
  matches:    { label: 'Matches', icon: 'flame', title: 'Your matches',  subtitle: 'People who liked you back.' },
  received:   { label: 'Likes',   icon: 'heart', title: 'Likes for you', subtitle: 'Members who liked your profile.' },
  viewers:    { label: 'Views',   icon: 'eye',   title: 'Profile views', subtitle: 'People who checked out your profile.' },
  favourites: { label: 'Stars',   icon: 'star',  title: 'Starred you',   subtitle: 'Members who starred your profile.' },
};

async function fetchUsersForTab(
  targetTab: Tab,
  userId: string,
  blockedSet: Set<string>,
  profileSelect: string,
): Promise<User[]> {
  const from = 0;
  const to = from + PAGE_SIZE - 1;
  let nextList: User[] = [];

  if (targetTab === 'received') {
    const { data } = await supabase
      .from('likes')
      .select(`from_user:profiles!from_user_id(${profileSelect})`)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    nextList = (data ?? []).map((row: any) => row.from_user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
  } else if (targetTab === 'viewers') {
    const { data } = await supabase
      .from('profile_views')
      .select(`viewer:profiles!viewer_id(${profileSelect})`)
      .eq('viewed_id', userId)
      .order('viewed_at', { ascending: false })
      .range(from, to);
    nextList = (data ?? []).map((row: any) => row.viewer as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
  } else if (targetTab === 'favourites') {
    const { data } = await supabase
      .from('favourites')
      .select(`user:profiles!user_id(${profileSelect})`)
      .eq('favourited_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    nextList = (data ?? []).map((row: any) => row.user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
  } else {
    // Server-side mutual-likes lookup — see migration get_matches_fn.sql.
    // Returns the 50 most recent matched profiles in a single round trip.
    const { data } = await supabase.rpc('get_matches', { p_limit: 50 });
    nextList = (data ?? [])
      .map((row: any) => row as User)
      .filter(Boolean)
      .filter((u) => !blockedSet.has(u.id));
  }

  return nextList;
}

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();

  const [activeTab, setActiveTab] = useState<Tab>('matches');
  // Mirror ref so realtime subscription callbacks always see the latest tab
  // without re-subscribing on every tab switch.
  const activeTabRef = useRef<Tab>('matches');
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [lists, setLists] = useState<Record<Tab, User[]>>({
    matches: [],
    received: [],
    viewers: [],
    favourites: [],
  });
  // Counts live in the shared activity store so the tab-bar badge
  // (`app/(tabs)/_layout.tsx`) and this screen stay in sync.
  const counts = useActivityStore((s) => s.counts);
  const setStoreCounts = useActivityStore((s) => s.setCounts);
  const clearStoreTab = useActivityStore((s) => s.clearTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const blockedIdsRef = useRef<Set<string> | null>(null);
  const tabFetchedAtRef = useRef<Record<Tab, number>>({
    matches: 0,
    received: 0,
    viewers: 0,
    favourites: 0,
  });
  const tabInFlightRef = useRef<Record<Tab, Promise<void> | null>>({
    matches: null,
    received: null,
    viewers: null,
    favourites: null,
  });
  const fetchActivityCountsRef = useRef<() => Promise<Record<Tab, number> | null>>(async () => null);

  const profileSelect = 'id, full_name, birthdate, city, country, avatar_url, profile_photos, online_status';

  const fetchBlockedSet = useCallback(async (force = false) => {
    if (!user) return new Set<string>();
    if (!force && blockedIdsRef.current) return blockedIdsRef.current;
    const { data: blocksData } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    const blockedIds = new Set<string>(
      (blocksData ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)),
    );
    blockedIdsRef.current = blockedIds;
    return blockedIds;
  }, [user]);

  /**
   * Lazy per-tab loader. Only fetches the requested tab. De-dupes concurrent
   * requests and respects a staleness window so rapid tab switching doesn't
   * re-hit the network on every tap.
   */
  const loadTab = useCallback(
    async (t: Tab, force: boolean) => {
      if (!user) return;
      const existing = tabInFlightRef.current[t];
      if (existing) {
        await existing;
        return;
      }
      const lastAt = tabFetchedAtRef.current[t] ?? 0;
      if (!force && Date.now() - lastAt < LIST_STALE_MS) return;

      const p = (async () => {
        const blockedSet = await fetchBlockedSet(force);
        const users = await fetchUsersForTab(t, user.id, blockedSet, profileSelect);
        setLists((prev) => ({ ...prev, [t]: users }));
        setLoadedTabs((prev) => {
          if (prev.has(t)) return prev;
          const next = new Set(prev);
          next.add(t);
          return next;
        });
        tabFetchedAtRef.current[t] = Date.now();
      })();
      tabInFlightRef.current[t] = p;
      try {
        await p;
      } finally {
        if (tabInFlightRef.current[t] === p) tabInFlightRef.current[t] = null;
      }
    },
    [user, fetchBlockedSet, profileSelect],
  );

  const loadTabRef = useRef(loadTab);
  loadTabRef.current = loadTab;

  const fetchActivityCounts = useCallback(async (): Promise<Record<Tab, number> | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('activity_unseen_counts');
    if (error || data == null) return null;
    const d = data as Record<string, unknown>;
    const next: Record<Tab, number> = {
      matches: Number(d.matches) || 0,
      received: Number(d.received) || 0,
      viewers: Number(d.viewers) || 0,
      favourites: Number(d.favourites) || 0,
    };
    setStoreCounts(next);
    return next;
  }, [user, setStoreCounts]);

  fetchActivityCountsRef.current = fetchActivityCounts;

  const markTabSeen = useCallback(async (t: Tab) => {
    if (!user) return;
    const now = new Date().toISOString();
    const colMap: Record<Tab, string> = {
      matches: 'matches_seen_at',
      received: 'likes_seen_at',
      viewers: 'views_seen_at',
      favourites: 'favourites_seen_at',
    };
    const col = colMap[t];
    clearStoreTab(t);
    await supabase.from('user_settings').update({ [col]: now }).eq('user_id', user.id);
  }, [user, clearStoreTab]);

  useEffect(() => {
    if (!user) return;
    blockedIdsRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const next = await fetchActivityCountsRef.current();
      if (cancelled) return;
      if (next) {
        await Promise.all(
          TAB_ORDER.filter((t) => (next[t] ?? 0) > 0).map((t) => markTabSeen(t)),
        );
      }
      if (cancelled) return;
      // Only load the tab the user actually sees. Other tabs load lazily
      // when they're tapped — huge win when the user only checks one.
      await loadTabRef.current(activeTab, true);
    })();

    return () => {
      cancelled = true;
    };
    // activeTab intentionally excluded — mount effect is keyed to user
    // identity only; tab switches trigger their own lazy load below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, markTabSeen]);

  useEffect(() => {
    if (!user) return;

    let countDebounce: ReturnType<typeof setTimeout> | null = null;
    let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleReloadAll = () => {
      if (countDebounce) clearTimeout(countDebounce);
      countDebounce = setTimeout(() => {
        void fetchActivityCountsRef.current();
      }, 280);
      if (reloadDebounce) clearTimeout(reloadDebounce);
      reloadDebounce = setTimeout(() => {
        // Only refresh the list the user is currently looking at. Other tabs
        // will refetch lazily (or after LIST_STALE_MS expires).
        void loadTabRef.current(activeTabRef.current, true);
      }, 200);
    };

    const channel = supabase
      .channel(`likes-live:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const row = payload.new as { from_user_id?: string; to_user_id?: string };
        if (!row.from_user_id || !row.to_user_id) return;
        // Only react to likes directed AT us — outgoing likes don't need a
        // UI refresh here since we no longer show a "sent" tab.
        if (row.to_user_id === user.id) {
          scheduleReloadAll();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, (payload) => {
        const row = payload.new as { viewed_id?: string };
        if (row.viewed_id !== user.id) return;
        scheduleReloadAll();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, (payload) => {
        const row = payload.new as { favourited_id?: string };
        if (row.favourited_id !== user.id) return;
        scheduleReloadAll();
      })
      .subscribe();

    return () => {
      if (reloadDebounce) clearTimeout(reloadDebounce);
      if (countDebounce) clearTimeout(countDebounce);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void fetchActivityCountsRef.current();
      // Refresh the active tab if it's stale. Other tabs stay lazy.
      void loadTabRef.current(activeTabRef.current, false);
    }, [user?.id]),
  );

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    // Refresh just the active tab (matches user expectation of "pull to
    // refresh this list") + the unseen counts for badges.
    await Promise.all([
      loadTab(activeTab, true),
      fetchActivityCounts(),
    ]);
    setRefreshing(false);
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: toUserId } });
    }
  };

  const handleTabPress = (t: Tab) => {
    setActiveTab(t);
    if ((counts[t] ?? 0) > 0) {
      void markTabSeen(t);
    }
    // Fetch on first visit (or if stale). No-op when cached and fresh.
    void loadTabRef.current(t, false);
  };

  const matchIds = useMemo(() => new Set((lists.matches ?? []).map((item) => item.id)), [lists.matches]);

  const activeList = lists[activeTab] ?? [];

  const emptyMap: Record<Tab, { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }> = {
    matches: {
      icon: 'flame-outline',
      title: 'No matches yet',
      desc: 'Like someone who already liked you to spark a match.',
    },
    received: {
      icon: 'heart-outline',
      title: 'No likes yet',
      desc: 'Complete your profile and add photos to attract more attention.',
    },
    viewers: {
      icon: 'eye-outline',
      title: 'No profile views yet',
      desc: 'A complete profile with a photo gets seen far more often.',
    },
    favourites: {
      icon: 'star-outline',
      title: 'No stars yet',
      desc: 'When someone stars your profile, they appear here.',
    },
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View style={s.header}>
        <ScreenTitle>{TAB_META[activeTab].title}</ScreenTitle>
        <Text style={s.subtitle}>{TAB_META[activeTab].subtitle}</Text>
      </View>

      <View style={s.tabsWrap}>
        {TAB_ORDER.map((t) => {
          const isActive = activeTab === t;
          const meta = TAB_META[t];
          const c = counts[t] ?? 0;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => handleTabPress(t)}
              activeOpacity={0.75}
              style={s.tabItem}
            >
              <View style={[s.tabIconCircle, isActive && s.tabIconCircleActive]}>
                <Ionicons
                  name={meta.icon}
                  size={18}
                  color={isActive ? COLORS.white : COLORS.textSecondary}
                />
                {c > 0 ? (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeTxt}>{c > 99 ? '99+' : c}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[s.tabLabel, isActive && s.tabLabelActive]}
                numberOfLines={1}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={activeList}
        keyExtractor={(u) => `${activeTab}-${u.id}`}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          !loadedTabs.has(activeTab) && !refreshing ? (
            <View style={{ paddingTop: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={emptyMap[activeTab].icon}
              title={emptyMap[activeTab].title}
              description={emptyMap[activeTab].desc}
            />
          )
        }
        renderItem={({ item: u }) => {
          const isMutual = activeTab !== 'matches' && matchIds.has(u.id);
          const avatar =
            u.avatar_url ||
            (u.profile_photos ?? [])[0] ||
            `${DEFAULT_AVATAR}${encodeURIComponent((u.full_name ?? '?').charAt(0))}`;
          const today = new Date();
          const bday = u.birthdate ? new Date(u.birthdate) : null;
          const age = bday
            ? today.getFullYear() -
              bday.getFullYear() -
              (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : null;
          const location = [u.city, u.country].filter(Boolean).join(', ');
          const isOnline = u.online_status === 'online';
          return (
            <TouchableOpacity
              onPress={() => {
                setProfileSeed(u);
                useProfileBrowseStore.getState().setOrderedUserIds(activeList.map((x) => x.id));
                router.push(`/(profile)/${u.id}`);
              }}
              style={s.row}
              activeOpacity={0.82}
            >
              <View style={s.avatarWrap}>
                <Image source={{ uri: avatar }} style={s.avatar} contentFit="cover" />
                <View style={[s.onlineDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.rowName} numberOfLines={1}>
                    {u.full_name}
                    {age ? `, ${age}` : ''}
                  </Text>
                  {isMutual ? <Text style={{ fontSize: 12 }}>🔥</Text> : null}
                </View>
                {location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={s.rowLoc} numberOfLines={1}>
                      {location}
                    </Text>
                  </View>
                ) : null}
              </View>
              {activeTab === 'matches' ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleMessage(u.id);
                  }}
                  style={s.msgBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
  },
  subtitle: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  tabsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
    gap: 4,
  },
  tabIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconCircleActive: {
    backgroundColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: FONT.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: FONT.extrabold,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  tabBadgeTxt: {
    fontSize: 10,
    fontWeight: FONT.extrabold,
    color: COLORS.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 76,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  rowName: { fontSize: FONT.md, fontWeight: FONT.bold, color: COLORS.text },
  rowLoc: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  msgBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet, InteractionManager,
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
import { User } from '@/types';
import { COLORS, FONT, DEFAULT_AVATAR } from '@/constants';
import { MOCK_USERS } from '@/lib/mock-data';
import { EmptyState } from '@/components/ui/EmptyState';

type Tab = 'matches' | 'received' | 'sent' | 'viewers' | 'favourites';

const PAGE_SIZE = 20;
/** Refetch list on focus only if older than this (industry standard: avoid work on every tab switch). */
const LIST_STALE_MS = 90_000;

const TABS: { key: Tab; icon: string; activeIcon: string }[] = [
  { key: 'matches',    icon: 'flame-outline',       activeIcon: 'flame'        },
  { key: 'received',   icon: 'heart-outline',        activeIcon: 'heart'        },
  { key: 'sent',       icon: 'paper-plane-outline',  activeIcon: 'paper-plane'  },
  { key: 'viewers',    icon: 'eye-outline',           activeIcon: 'eye'          },
  { key: 'favourites', icon: 'star-outline',          activeIcon: 'star'         },
];

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const [tab, setTab] = useState<Tab>('received');
  const [lists, setLists] = useState<Record<Tab, User[]>>({
    matches: [],
    received: [],
    sent: [],
    viewers: [],
    favourites: [],
  });
  const [loadedTabs, setLoadedTabs] = useState<Record<Tab, boolean>>({
    matches: false,
    received: false,
    sent: false,
    viewers: false,
    favourites: false,
  });
  const [counts, setCounts] = useState<Record<Tab, number>>({
    matches: 0,
    received: 0,
    sent: 0,
    viewers: 0,
    favourites: 0,
  });
  const [loadingTabs, setLoadingTabs] = useState<Record<Tab, boolean>>({
    matches: false,
    received: false,
    sent: false,
    viewers: false,
    favourites: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [pages, setPages] = useState<Record<Tab, number>>({
    matches: 0, received: 0, sent: 0, viewers: 0, favourites: 0,
  });
  const [hasMoreByTab, setHasMoreByTab] = useState<Record<Tab, boolean>>({
    matches: true, received: true, sent: true, viewers: true, favourites: true,
  });
  const blockedIdsRef = useRef<Set<string> | null>(null);
  const lastListFetchAtRef = useRef<Partial<Record<Tab, number>>>({});
  const loadedTabsRef = useRef(loadedTabs);
  const pagesRef = useRef(pages);
  loadedTabsRef.current = loadedTabs;
  pagesRef.current = pages;

  const profileSelect = 'id, full_name, birthdate, city, country, avatar_url, profile_photos, online_status';

  const fetchBlockedSet = useCallback(async (force = false) => {
    if (!user) return new Set<string>();
    if (!force && blockedIdsRef.current) return blockedIdsRef.current;
    const { data: blocksData } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    const blockedIds = new Set<string>(
      (blocksData ?? []).map((b) => b.blocker_id === user.id ? b.blocked_id : b.blocker_id)
    );
    blockedIdsRef.current = blockedIds;
    return blockedIds;
  }, [user]);

  const loadTab = useCallback(async (targetTab: Tab, force = false, loadMore = false) => {
    if (!user || (!force && !loadMore && loadedTabsRef.current[targetTab])) return;

    setLoadingTabs((state) => ({ ...state, [targetTab]: true }));

    try {
      const blockedSetPromise = fetchBlockedSet(force);
      let nextList: User[] = [];
      const currentPage = force ? 0 : (loadMore ? pagesRef.current[targetTab] : 0);
      const from = currentPage * PAGE_SIZE;
      const to   = from + PAGE_SIZE - 1;

      if (targetTab === 'received') {
        const { data } = await supabase
          .from('likes')
          .select(`from_user:profiles!from_user_id(${profileSelect})`)
          .eq('to_user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);
        const blockedSet = await blockedSetPromise;
        nextList = (data ?? []).map((row: any) => row.from_user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        setHasMoreByTab((s) => ({ ...s, [targetTab]: (data ?? []).length === PAGE_SIZE }));
      } else if (targetTab === 'sent') {
        const { data } = await supabase
          .from('likes')
          .select(`to_user:profiles!to_user_id(${profileSelect})`)
          .eq('from_user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);
        const blockedSet = await blockedSetPromise;
        nextList = (data ?? []).map((row: any) => row.to_user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        setHasMoreByTab((s) => ({ ...s, [targetTab]: (data ?? []).length === PAGE_SIZE }));
      } else if (targetTab === 'viewers') {
        const { data } = await supabase
          .from('profile_views')
          .select(`viewer:profiles!viewer_id(${profileSelect})`)
          .eq('viewed_id', user.id)
          .order('viewed_at', { ascending: false })
          .range(from, to);
        const blockedSet = await blockedSetPromise;
        nextList = (data ?? []).map((row: any) => row.viewer as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        setHasMoreByTab((s) => ({ ...s, [targetTab]: (data ?? []).length === PAGE_SIZE }));
      } else if (targetTab === 'favourites') {
        const { data } = await supabase
          .from('favourites')
          .select(`user:profiles!user_id(${profileSelect})`)
          .eq('favourited_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);
        const blockedSet = await blockedSetPromise;
        nextList = (data ?? []).map((row: any) => row.user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        setHasMoreByTab((s) => ({ ...s, [targetTab]: (data ?? []).length === PAGE_SIZE }));
      } else {
        // matches tab: cross-reference received+sent (cap at 100 each for performance)
        const [{ data: received }, { data: sent }] = await Promise.all([
          supabase
            .from('likes')
            .select(`from_user:profiles!from_user_id(${profileSelect})`)
            .eq('to_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('likes')
            .select(`to_user:profiles!to_user_id(${profileSelect})`)
            .eq('from_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        const blockedSet = await blockedSetPromise;
        const receivedList = (received ?? []).map((row: any) => row.from_user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        const sentList = (sent ?? []).map((row: any) => row.to_user as User).filter(Boolean).filter((u) => !blockedSet.has(u.id));
        const sentIds = new Set(sentList.map((u) => u.id));
        nextList = receivedList.filter((u) => sentIds.has(u.id));
        setHasMoreByTab((s) => ({ ...s, matches: false }));
      }

      const fallback =
        __DEV__ && nextList.length === 0 && currentPage === 0
          ? targetTab === 'matches'
            ? MOCK_USERS.slice(0, 3)
            : targetTab === 'received'
              ? MOCK_USERS.slice(0, 5)
              : targetTab === 'sent'
                ? MOCK_USERS.slice(4, 7)
                : targetTab === 'viewers'
                  ? MOCK_USERS.slice(1, 4)
                  : MOCK_USERS.slice(0, 2)
          : [];

      const resolved = nextList.length > 0 ? nextList : fallback;
      setLists((state) => ({
        ...state,
        [targetTab]: loadMore && currentPage > 0
          ? [...(state[targetTab] ?? []), ...resolved]
          : resolved,
      }));
      setLoadedTabs((state) => ({ ...state, [targetTab]: true }));
      if (loadMore || force) {
        setPages((s) => ({ ...s, [targetTab]: currentPage + 1 }));
      }
      lastListFetchAtRef.current[targetTab] = Date.now();
    } finally {
      setLoadingTabs((state) => ({ ...state, [targetTab]: false }));
    }
  }, [fetchBlockedSet, profileSelect, user]);

  const fetchActivityCounts = useCallback(async (): Promise<Record<Tab, number> | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('activity_unseen_counts');
    if (error || data == null) return null;
    const d = data as Record<string, unknown>;
    const next: Record<Tab, number> = {
      matches: Number(d.matches) || 0,
      received: Number(d.received) || 0,
      sent: Number(d.sent) || 0,
      viewers: Number(d.viewers) || 0,
      favourites: Number(d.favourites) || 0,
    };
    setCounts(next);
    return next;
  }, [user]);

  const fetchActivityCountsRef = useRef(fetchActivityCounts);
  fetchActivityCountsRef.current = fetchActivityCounts;

  // Mark the current tab as seen — resets its badge to 0 and persists *_seen_at (server counts use these).
  const markTabSeen = useCallback(async (t: Tab) => {
    if (!user) return;
    const now = new Date().toISOString();
    const colMap: Record<Tab, string> = {
      matches: 'matches_seen_at',
      received: 'likes_seen_at',
      sent: 'sent_seen_at',
      viewers: 'views_seen_at',
      favourites: 'favourites_seen_at',
    };
    const col = colMap[t];
    setCounts((s) => ({ ...s, [t]: 0 }));
    await supabase.from('user_settings').update({ [col]: now }).eq('user_id', user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    blockedIdsRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let interactionHandle: { cancel: () => void } | undefined;
    const openedTab = tab;

    void (async () => {
      const next = await fetchActivityCounts();
      if (cancelled) return;
      if (next && (next[openedTab] ?? 0) > 0 && !cancelled) {
        await markTabSeen(openedTab);
      }
      if (cancelled) return;
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) loadTab(openedTab);
      });
    })();

    return () => {
      cancelled = true;
      interactionHandle?.cancel();
    };
  }, [tab, user?.id, loadTab, markTabSeen, fetchActivityCounts]);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  const sentIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    sentIdsRef.current = new Set((lists.sent ?? []).map((u) => u.id));
  }, [lists.sent]);

  const loadTabRef = useRef(loadTab);
  loadTabRef.current = loadTab;

  useEffect(() => {
    if (!user) return;

    const debouncers: Partial<Record<Tab, ReturnType<typeof setTimeout>>> = {};
    let countDebounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = (t: Tab) => {
      const prev = debouncers[t];
      if (prev) clearTimeout(prev);
      debouncers[t] = setTimeout(() => {
        loadTabRef.current(t, true);
      }, 200);
    };

    const scheduleCountRefresh = () => {
      if (countDebounce) clearTimeout(countDebounce);
      countDebounce = setTimeout(() => {
        void fetchActivityCountsRef.current();
      }, 280);
    };

    const channel = supabase
      .channel(`likes-live:${user.id}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const row = payload.new as { from_user_id?: string; to_user_id?: string };
        if (!row.from_user_id || !row.to_user_id) return;

        if (row.to_user_id === user.id) {
          scheduleCountRefresh();
          scheduleReload('received');
          scheduleReload('matches');
        }
        if (row.from_user_id === user.id) {
          scheduleCountRefresh();
          sentIdsRef.current.add(row.to_user_id);
          scheduleReload('sent');
          scheduleReload('matches');
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_views' }, (payload) => {
        const row = payload.new as { viewed_id?: string };
        if (row.viewed_id !== user.id) return;
        scheduleCountRefresh();
        scheduleReload('viewers');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favourites' }, (payload) => {
        const row = payload.new as { favourited_id?: string };
        if (row.favourited_id !== user.id) return;
        scheduleCountRefresh();
        scheduleReload('favourites');
      })
      .subscribe();

    return () => {
      Object.values(debouncers).forEach((id) => id && clearTimeout(id));
      if (countDebounce) clearTimeout(countDebounce);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void fetchActivityCountsRef.current();
      const last = lastListFetchAtRef.current[tab] ?? 0;
      if (Date.now() - last > LIST_STALE_MS) {
        void loadTab(tab, true);
      }
    }, [loadTab, tab, user?.id]),
  );

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    setPages((s) => ({ ...s, [tab]: 0 }));
    await loadTab(tab, true);
    await fetchActivityCounts();
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (!user || !hasMoreByTab[tab] || loadingTabs[tab]) return;
    loadTab(tab, false, true);
  }, [user, hasMoreByTab, tab, loadingTabs, loadTab]);

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: toUserId } });
    }
  };

  const list: User[] = useMemo(() => lists[tab] ?? [], [lists, tab]);
  const matchIds = useMemo(() => new Set((lists.matches ?? []).map((item) => item.id)), [lists.matches]);
  const isCurrentTabLoading = loadingTabs[tab] && list.length === 0;

  const emptyMap: Record<Tab, { icon: string; title: string; desc: string }> = {
    matches:    { icon: 'flame-outline',     title: 'No matches yet',            desc: 'Like someone who already liked you to get a match.'      },
    received:   { icon: 'heart-outline',     title: 'No likes yet',              desc: 'Complete your profile to attract more attention.'        },
    sent:       { icon: 'heart-outline',     title: "You haven't liked anyone",  desc: 'Browse Discover to find someone you like.'              },
    viewers:    { icon: 'eye-outline',       title: 'No profile views yet',      desc: 'A complete profile with a photo gets more views.'        },
    favourites: { icon: 'star-outline',      title: 'No favourites yet',         desc: 'When someone stars your profile, they appear here.'      },
  };

  const e = emptyMap[tab];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{{
          matches:    'Matches',
          received:   'Received',
          sent:       'Sent',
          viewers:    'Viewers',
          favourites: 'Favourites',
        }[tab]}</Text>
        <View style={s.tabBar}>
          {TABS.map(({ key, icon, activeIcon }) => {
            const active = tab === key;
            return (
              <TouchableOpacity key={key} onPress={() => setTab(key)} style={[s.tabBtn, active && s.tabBtnOn]}>
                <Ionicons name={(active ? activeIcon : icon) as any} size={22} color={active ? COLORS.primary : COLORS.textSecondary} />
                {counts[key] > 0 && (
                  <View style={[s.badge, active && s.badgeOn]}>
                    <Text style={[s.badgeTxt, active && s.badgeTxtOn]}>
                      {counts[key] > 99 ? '99+' : counts[key]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: tabBarHeight + 16 }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={
            isCurrentTabLoading ? (
              <View style={s.inlineLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <EmptyState icon={e.icon as any} title={e.title} description={e.desc} />
            )
          }
          ListFooterComponent={
            hasMoreByTab[tab] && list.length > 0 && loadingTabs[tab] ? (
              <View style={s.footerLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isMutual = tab !== 'matches' && matchIds.has(item.id);
            const avatar = item.avatar_url || (item.profile_photos ?? [])[0]
              || `${DEFAULT_AVATAR}${encodeURIComponent((item.full_name ?? '?').charAt(0))}`;
            const today = new Date();
            const bday  = item.birthdate ? new Date(item.birthdate) : null;
            const age   = bday ? today.getFullYear() - bday.getFullYear()
              - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0) : null;
            const location = [item.city, item.country].filter(Boolean).join(', ');
            const isOnline = item.online_status === 'online';
            return (
              <TouchableOpacity
                onPress={() => {
                  useProfileBrowseStore.getState().setOrderedUserIds(list.map((u) => u.id));
                  router.push(`/(profile)/${item.id}`);
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
                    <Text style={s.rowName} numberOfLines={1}>{item.full_name}{age ? `, ${age}` : ''}</Text>
                    {isMutual && <Text style={{ fontSize: 12 }}>🔥</Text>}
                  </View>
                  {location ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                      <Text style={s.rowLoc} numberOfLines={1}>{location}</Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:   { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 0, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title:    { fontSize: FONT.xxl, fontWeight: FONT.extrabold, color: COLORS.text, marginBottom: 10 },
  tabBar:   { flexDirection: 'row' },
  tabBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabBtnOn: { borderBottomColor: COLORS.primary },
  badge:    { position: 'absolute', top: 4, right: '20%', minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeOn:  { backgroundColor: COLORS.primary },
  badgeTxt:    { fontSize: 9, fontWeight: FONT.extrabold, color: COLORS.textSecondary },
  badgeTxtOn:  { color: COLORS.white },
  // List rows
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, gap: 12 },
  sep:      { height: 1, backgroundColor: COLORS.border, marginLeft: 76 },
  avatarWrap:{ position: 'relative' },
  avatar:   { width: 48, height: 48, borderRadius: 24 },
  onlineDot:{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: COLORS.white },
  rowName:  { fontSize: FONT.md, fontWeight: FONT.bold, color: COLORS.text },
  rowLoc:   { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  inlineLoading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  footerLoading: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
});

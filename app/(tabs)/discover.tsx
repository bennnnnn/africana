import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useChatStore } from '@/store/chat.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { MatchModal } from '@/components/ui/MatchModal';
import { COLORS, RADIUS, FONT, SHADOWS } from '@/constants';
import { User } from '@/types';

const HEADER_HEIGHT = 64; // height of the header content row (excludes status bar)

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { users, isLoading, hasMore, filters, fetchUsers, fetchLikedUserIds, toggleLike, likedUserIds, setFilters, resetFilters, subscribeToOnlineStatus, unsubscribeFromOnlineStatus } =
    useDiscoverStore();
  const { getOrCreateConversation } = useChatStore();
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [matchUser, setMatchUser]     = useState<User | null>(null);
  const [localBlocked, setLocalBlocked] = useState<Set<string>>(new Set());

  // ── Toast ────────────────────────────────────────────────────────────────────
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

  // ── Collapsing header ────────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerTranslateY = clampedScroll.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (user) {
      fetchUsers(user.id, user.interested_in, true);
      fetchLikedUserIds(user.id);
      subscribeToOnlineStatus();
    }
    return () => { unsubscribeFromOnlineStatus(); };
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchUsers(user.id, user.interested_in, true);
    setRefreshing(false);
  }, [user]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore && user) fetchUsers(user.id, user.interested_in);
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'min_age') return v !== 18;
    if (k === 'max_age') return v !== 100;
    if (k === 'online_only') return v === true;
    return v !== null;
  }).length;

  const totalHeaderHeight = insets.top + HEADER_HEIGHT;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>

      {/* ── Full-screen scrollable grid ── */}
      <Animated.FlatList
        data={users}
        keyExtractor={(item) => item.id}
        numColumns={2}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: totalHeaderHeight + 8,
          paddingHorizontal: 16,
          paddingBottom: tabBarHeight + 16,
        }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        overScrollMode="always"
        decelerationRate="normal"
        scrollEventThrottle={1}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            progressViewOffset={totalHeaderHeight}
          />
        }
        renderItem={({ item }) => (
          localBlocked.has(item.id) ? null : (
            <UserCard
              user={item}
              isLiked={likedUserIds.has(item.id)}
              onLike={async (id) => {
                if (!user) return;
                const wasLiked = likedUserIds.has(id);
                const isMatch = await toggleLike(user.id, id);
                if (isMatch && !wasLiked) {
                  setMatchUser(users.find((u) => u.id === id) ?? null);
                  showToast('🔥', "It's a match!");
                } else {
                  showToast(wasLiked ? '💔' : '❤️', wasLiked ? 'Unliked' : 'Liked!');
                }
              }}
              onMessage={handleMessage}
            />
          )
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 }}>
              <Text style={{ fontSize: 48 }}>🌍</Text>
              <Text style={{ fontSize: FONT.xl, fontWeight: FONT.extrabold, color: COLORS.text, textAlign: 'center' }}>
                No members found
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                Try widening your filters and more Africana members will appear.
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  onPress={() => { resetFilters(); if (user) fetchUsers(user.id, user.interested_in, true); }}
                  style={{ marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.xxl }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: FONT.bold, fontSize: 14 }}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
      />

      {/* ── Collapsing header (absolutely positioned) ── */}
      <Animated.View
        style={[s.header, {
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
        }]}
      >
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Discover</Text>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          >
            <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth} />
            <Text style={[s.filterTxt, activeFilterCount > 0 && { color: COLORS.primary }]}>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => {
          setFilters(f);
          if (user) fetchUsers(user.id, user.interested_in, true);
        }}
        onReset={() => {
          resetFilters();
          if (user) fetchUsers(user.id, user.interested_in, true);
        }}
      />

      <MatchModal visible={!!matchUser} matchedUser={matchUser} onClose={() => setMatchUser(null)} />

      {/* ── Toast ── */}
      {toast && (
        <Animated.View pointerEvents="none" style={[
          s.toast,
          { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
        ]}>
          <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
          <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: FONT.semibold }}>{toast.msg}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: FONT.xxl,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.savanna,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  filterBtnActive: {
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  filterTxt: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.earth,
  },
  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.toastBg,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
  },
});

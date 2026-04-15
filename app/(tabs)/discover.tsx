import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { MatchModal } from '@/components/ui/MatchModal';
import { PostOnboardingProfileBanner } from '@/components/profile/PostOnboardingProfileBanner';
import { COLORS, RADIUS, FONT } from '@/constants';
import { User } from '@/types';
import {
  loadOnboardingSkippedHints,
  clearOnboardingSkippedHints,
  type SkippedOnboardingHints,
} from '@/lib/post-onboarding-nudges';
import { useDialog } from '@/components/ui/DialogProvider';

const HEADER_HEIGHT = 64; // height of the header content row (excludes status bar)

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { users, isLoading, hasMore, filters, fetchUsers, fetchLikedUserIds, toggleLike, likedUserIds, setFilters, resetFilters, subscribeToOnlineStatus, unsubscribeFromOnlineStatus } =
    useDiscoverStore();
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [matchUser, setMatchUser]     = useState<User | null>(null);
  const [localBlocked, setLocalBlocked] = useState<Set<string>>(new Set());
  const [postOnboardHints, setPostOnboardHints] = useState<SkippedOnboardingHints | null>(null);
  const { showToast } = useDialog();

  // ── Scroll-driven header animations ─────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;

  // On overscroll (pull down, scrollY goes negative) header gently stretches down — elastic feel
  const headerTranslateY = scrollY.interpolate({
    inputRange: [-80, 0],
    outputRange: [28, 0],
    extrapolate: 'clamp',
  });

  // Shadow fades in as soon as content scrolls under the header — gives depth
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const agePref = user?.min_age_pref && user?.max_age_pref
    ? { min: user.min_age_pref, max: user.max_age_pref }
    : undefined;

  useEffect(() => {
    if (user) {
      fetchUsers(user.id, user.interested_in, true, agePref);
      fetchLikedUserIds(user.id);
      subscribeToOnlineStatus();
    }
    return () => { unsubscribeFromOnlineStatus(); };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchLikedUserIds(user.id);
      loadOnboardingSkippedHints().then(setPostOnboardHints);
    }, [fetchLikedUserIds, user?.id]),
  );

  const postOnboardReminders = useMemo(() => {
    if (!postOnboardHints || !user) return [];
    const r: string[] = [];
    if (postOnboardHints.bio && !user.bio?.trim()) r.push('a short bio');
    if (postOnboardHints.photo && !user.avatar_url && !(user.profile_photos?.length)) r.push('a profile photo');
    if (postOnboardHints.goals && !(user.looking_for?.length)) r.push('what you’re looking for');
    if (postOnboardHints.work && !user.education && !user.occupation?.trim()) r.push('work and education');
    if (
      postOnboardHints.moreDetails &&
      (user.religion == null || user.has_children === null || user.want_children == null)
    ) {
      r.push('a bit more background (religion, family plans, etc.)');
    }
    return r;
  }, [postOnboardHints, user]);

  useEffect(() => {
    if (!postOnboardHints) return;
    if (postOnboardReminders.length === 0) {
      clearOnboardingSkippedHints().then(() => setPostOnboardHints(null));
    }
  }, [postOnboardHints, postOnboardReminders]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchUsers(user.id, user.interested_in, true, agePref);
    setRefreshing(false);
  }, [user]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore && user) fetchUsers(user.id, user.interested_in, false, agePref);
  };

  const browseOrderIds = useMemo(
    () => users.filter((u) => !localBlocked.has(u.id)).map((u) => u.id),
    [users, localBlocked],
  );
  const setProfileBrowseOrder = useProfileBrowseStore((s) => s.setOrderedUserIds);

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
          flexGrow: 1,
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
        ListHeaderComponent={
          postOnboardReminders.length > 0 ? (
            <PostOnboardingProfileBanner
              reminders={postOnboardReminders}
              onProfilePress={() => router.push('/(tabs)/me')}
              onDismiss={async () => {
                await clearOnboardingSkippedHints();
                setPostOnboardHints(null);
              }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          localBlocked.has(item.id) ? null : (
            <UserCard
              user={item}
              beforeNavigate={() => setProfileBrowseOrder(browseOrderIds)}
              isLiked={likedUserIds.has(item.id)}
              onLike={async (id) => {
                if (!user) return;
                const wasLiked = likedUserIds.has(id);
                const isMatch = await toggleLike(user.id, id);
                if (isMatch && !wasLiked) {
                  setMatchUser(users.find((u) => u.id === id) ?? null);
                  showToast({ message: "It's a match!", icon: 'flame' });
                } else {
                  showToast({
                    message: wasLiked ? 'Unliked' : 'Liked!',
                    icon: wasLiked ? 'heart-dislike-outline' : 'heart',
                  });
                }
              }}
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
                  onPress={() => { resetFilters(); if (user) fetchUsers(user.id, user.interested_in, true, agePref); }}
                  style={{ marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.xxl }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: FONT.bold, fontSize: 14 }}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          users.length === 0 ? null : isLoading && hasMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : !hasMore ? (
            <View style={{ paddingVertical: 28, alignItems: 'center', paddingHorizontal: 16 }}>
              <Text style={{ fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.textSecondary }}>
                All caught up
              </Text>
            </View>
          ) : null
        }
      />

      {/* ── Fixed header with elastic overscroll + depth shadow ── */}
      <Animated.View
        style={[s.header, {
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
          shadowOpacity: headerShadowOpacity,
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
          if (user) fetchUsers(user.id, user.interested_in, true, agePref);
        }}
        onReset={() => {
          resetFilters();
          if (user) fetchUsers(user.id, user.interested_in, true, agePref);
        }}
      />

      <MatchModal visible={!!matchUser} matchedUser={matchUser} onClose={() => setMatchUser(null)} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
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
});

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  View, Text, TouchableOpacity, Dimensions, Platform,
  ActivityIndicator, RefreshControl, Animated, StyleSheet, ScrollView,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { QuickPreviewModal } from '@/components/discover/QuickPreviewModal';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Image } from 'expo-image';
import haptics from '@/lib/haptics';
import { profileImageUrlForList } from '@/lib/storage-image-url';
import { PostOnboardingProfileBanner } from '@/components/profile/PostOnboardingProfileBanner';
import { COLORS, RADIUS, FONT, RELIGION_OPTIONS } from '@/constants';
import { FilterOptions, User } from '@/types';
import {
  loadOnboardingSkippedHints,
  clearOnboardingSkippedHints,
  type SkippedOnboardingHints,
} from '@/lib/post-onboarding-nudges';

/** Discover title row — expanded vs compact (excludes status bar + filter chips). */
const HEADER_EXPANDED = 64;
const HEADER_COMPACT = 48;
/** Scroll distance (px) over which the header eases from expanded → compact. */
const COLLAPSE_SCROLL_RANGE = 56;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const {
    users,
    isLoading,
    hasMore,
    filters,
    fetchError,
    fetchUsers,
    fetchLikedUserIds,
    clearFetchError,
    setFilters,
    resetFilters,
    subscribeToOnlineStatus,
    unsubscribeFromOnlineStatus,
  } = useDiscoverStore(
    useShallow((s) => ({
      users: s.users,
      isLoading: s.isLoading,
      hasMore: s.hasMore,
      filters: s.filters,
      fetchError: s.fetchError,
      fetchUsers: s.fetchUsers,
      fetchLikedUserIds: s.fetchLikedUserIds,
      clearFetchError: s.clearFetchError,
      setFilters: s.setFilters,
      resetFilters: s.resetFilters,
      subscribeToOnlineStatus: s.subscribeToOnlineStatus,
      unsubscribeFromOnlineStatus: s.unsubscribeFromOnlineStatus,
    })),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [postOnboardHints, setPostOnboardHints] = useState<SkippedOnboardingHints | null>(null);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // ── Scroll-driven header animations ─────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollValueRef = useRef(0);

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

  // Manual scroll handler for FlashList (doesn't support Animated.event natively)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollValueRef.current = y;
    scrollY.setValue(y);
  }, [scrollY]);

  const agePref = useMemo(
    () =>
      user?.min_age_pref != null && user?.max_age_pref != null
        ? { min: user.min_age_pref, max: user.max_age_pref }
        : undefined,
    [user?.min_age_pref, user?.max_age_pref],
  );

  useEffect(() => {
    if (!user) return;
    fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
    subscribeToOnlineStatus();
    return () => {
      unsubscribeFromOnlineStatus();
    };
  }, [user?.id, user?.interested_in, agePref, fetchUsers, subscribeToOnlineStatus, unsubscribeFromOnlineStatus]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchLikedUserIds(user.id);
      loadOnboardingSkippedHints().then(setPostOnboardHints);
    }, [fetchLikedUserIds, user?.id]),
  );

  // Prime the image cache for the first screenful as soon as the page lands
  // so the grid never shows the cross-fade-from-blank flash.
  useEffect(() => {
    if (users.length === 0) return;
    const urls = users
      .slice(0, 8)
      .map((u) => u.profile_photos?.[0] || u.avatar_url)
      .filter((url): url is string => !!url)
      .map((url) => profileImageUrlForList(url) ?? url);
    if (urls.length > 0) void Image.prefetch(urls);
  }, [users.length > 0 ? users[0]?.id : null]);

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
    try {
      await fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
    } finally {
      setRefreshing(false);
    }
  }, [user, fetchUsers, agePref]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && user) void fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: false, agePref });
  }, [isLoading, hasMore, user, fetchUsers, agePref]);

  const browseOrderIds = useMemo(() => users.map((u) => u.id), [users]);
  const setProfileBrowseOrder = useProfileBrowseStore((s) => s.setOrderedUserIds);

  const beforeProfileNavigate = useCallback(() => {
    setProfileBrowseOrder(browseOrderIds);
  }, [setProfileBrowseOrder, browseOrderIds]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.online_only) {
      chips.push({ key: 'online', label: 'Online now', clear: () => setFilters({ online_only: false }) });
    }
    if (filters.country) {
      const loc = [filters.city, filters.state, filters.country].filter(Boolean).join(', ');
      chips.push({ key: 'loc', label: loc, clear: () => setFilters({ country: null, state: null, city: null }) });
    }
    if (filters.religion) {
      const label = RELIGION_OPTIONS.find((o) => o.value === filters.religion)?.label ?? String(filters.religion);
      chips.push({ key: 'religion', label, clear: () => setFilters({ religion: null }) });
    }
    if (filters.min_age !== 18 || filters.max_age !== 100) {
      chips.push({ key: 'age', label: `Age ${filters.min_age}–${filters.max_age}`, clear: () => setFilters({ min_age: 18, max_age: 100 } as Partial<FilterOptions>) });
    }
    return chips;
  }, [filters, setFilters]);
  const activeFilterCount = activeFilterChips.length;

  const handleApplyFilters = useCallback((next: FilterOptions) => {
    haptics.tapLight();
    setFilters(next);
    if (user) fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
  }, [setFilters, fetchUsers, user, agePref]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    if (user) fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
  }, [resetFilters, fetchUsers, user, agePref]);

  const handleChipClear = useCallback(
    (clear: () => void) => {
      haptics.tapLight();
      clear();
      if (user) fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
    },
    [user, fetchUsers, agePref],
  );

  const handleLongPressUser = useCallback((selectedUser: User) => {
    const idx = users.findIndex((u) => u.id === selectedUser.id);
    setPreviewStartIndex(idx >= 0 ? idx : 0);
    setShowPreview(true);
  }, [users]);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // Warm the image cache for the next ~6 cards just out of view. By the time
  // the user scrolls them in, the photo is already decoded and renders with
  // no fade-in. `Image.prefetch` is idempotent so re-calling for already-
  // cached URIs is essentially free.
  const prefetchedRef = useRef<Set<string>>(new Set());
  const usersRef = useRef(users);
  usersRef.current = users;
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length === 0) return;
      const lastVisibleIdx = viewableItems[viewableItems.length - 1]?.index ?? 0;
      const lookahead = usersRef.current.slice(lastVisibleIdx + 1, lastVisibleIdx + 7);
      const urls = lookahead
        .map((u) => u.profile_photos?.[0] || u.avatar_url)
        .filter((url): url is string => !!url && !prefetchedRef.current.has(url))
        .map((url) => {
          const transformed = profileImageUrlForList(url) ?? url;
          prefetchedRef.current.add(url);
          return transformed;
        });
      if (urls.length === 0) return;
      void Image.prefetch(urls);
    },
  ).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30,
    minimumViewTime: 80,
  }).current;

  const filterChipsHeight = activeFilterCount > 0 ? 44 : 0;
  const totalHeaderExpanded = insets.top + HEADER_EXPANDED + filterChipsHeight;

  const listPaddingTopAnim = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, COLLAPSE_SCROLL_RANGE],
        outputRange: [
          insets.top + filterChipsHeight + 8 + HEADER_EXPANDED,
          insets.top + filterChipsHeight + 8 + HEADER_COMPACT,
        ],
        extrapolate: 'clamp',
      }),
    [scrollY, insets.top, filterChipsHeight],
  );

  // Note: keep native-animated styles limited to transform/opacity. Layout props
  // like padding/fontSize can trigger "not supported by native animated module"
  // warnings in some runtimes.
  const screenWidth = Dimensions.get('window').width;
  const GRID_PADDING = 16;  // padding on each side of the list
  const GRID_GUTTER  = 16;  // gap between the two columns
  const CARD_WIDTH   = Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GUTTER) / 2);
  const CARD_HEIGHT  = Math.round(CARD_WIDTH * 1.45);
  // Group users into pairs for manual 2-column rows
  const rowPairs = useMemo(() => {
    const pairs: [typeof users[number], typeof users[number] | null][] = [];
    for (let i = 0; i < users.length; i += 2) {
      pairs.push([users[i], users[i + 1] ?? null]);
    }
    return pairs;
  }, [users]);

  return (
    <View style={s.screen}>

      {/* ── Full-screen scrollable grid ── */}
      <View style={s.flex}>
        <AnimatedFlashList
          data={rowPairs}
          keyExtractor={(_, index) => String(index)}
          style={s.flex}
          contentContainerStyle={{
            paddingTop: listPaddingTopAnim,
            paddingHorizontal: GRID_PADDING,
            paddingBottom: tabBarHeight + 16,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              progressViewOffset={totalHeaderExpanded + 8}
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
          renderItem={({ item }) => {
            const pair = item as [User, User | null];
            return (
            <View style={s.gridRow}>
              <UserCard
                user={pair[0]}
                cardWidth={CARD_WIDTH}
                cardHeight={CARD_HEIGHT}
                beforeNavigate={beforeProfileNavigate}
                onLongPress={handleLongPressUser}
              />
              {pair[1] ? (
                <UserCard
                  user={pair[1]}
                  cardWidth={CARD_WIDTH}
                  cardHeight={CARD_HEIGHT}
                  beforeNavigate={beforeProfileNavigate}
                  onLongPress={handleLongPressUser}
                />
              ) : (
                <View style={[s.gridRowSpacer, { width: CARD_WIDTH }]} />
              )}
            </View>
            );
          }}
          ListEmptyComponent={
            isLoading && users.length === 0 ? (
              <View style={s.skeletonGrid}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} width={CARD_WIDTH} height={CARD_HEIGHT} radius={20} />
                ))}
              </View>
            ) : fetchError ? (
              <View style={s.emptyState}>
                <Ionicons name="cloud-offline-outline" size={44} color={COLORS.textMuted} />
                <Text style={s.emptyTitle}>
                  Could not load Discover
                </Text>
                <Text style={s.emptyBody}>
                  {fetchError}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    clearFetchError();
                    if (user) void fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
                  }}
                  style={s.primaryCta}
                >
                  <Text style={s.primaryCtaText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.emptyState, s.emptyStateTight]}>
                <Text style={s.emptyEmoji}>🌍</Text>
                <Text style={s.emptyTitle}>
                  No members found
                </Text>
                <Text style={s.emptyBody}>
                  Try widening your filters and more Africana members will appear.
                </Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      resetFilters();
                      if (user) void fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
                    }}
                    style={s.primaryCta}
                  >
                    <Text style={s.primaryCtaText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListFooterComponent={
            users.length === 0 ? null : (
              <View>
                {fetchError ? (
                  <View style={s.footerErrorCard}>
                    <Text style={s.footerErrorText}>{fetchError}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        clearFetchError();
                        if (user) void fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
                      }}
                      style={s.footerRetryBtn}
                    >
                      <Text style={s.footerRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {isLoading && hasMore ? (
                  <View style={s.footerSpinner}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : !hasMore ? (
                  <View style={s.footerEnd}>
                    <Text style={s.footerEndText}>
                      All caught up
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          }
        />
      </View>

      {/* ── Fixed header with elastic overscroll + depth shadow ── */}
      <Animated.View
        style={[s.header, {
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
        }]}
      >
        <Animated.View style={s.headerRow}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: FONT.displayFamily,
              fontSize: FONT.xxl + 4,
              color: COLORS.textStrong,
              letterSpacing: 0.2,
            }}
          >
            Discover
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Open filters'}
            onPress={() => setShowFilters(true)}
            style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          >
            <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth} />
            <Text style={[s.filterTxt, activeFilterCount > 0 && { color: COLORS.primary }]}>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </Animated.View>
        {activeFilterCount > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
          >
            {activeFilterChips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                onPress={() => handleChipClear(chip.clear)}
                style={s.chip}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={s.chipTxt} numberOfLines={1}>{chip.label}</Text>
                <Ionicons name="close" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </Animated.View>

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <QuickPreviewModal
        visible={showPreview}
        users={users}
        startIndex={previewStartIndex}
        onClose={handleClosePreview}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  flex: {
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridRowSpacer: {
    // width is provided dynamically based on card size
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyStateTight: {
    paddingTop: 60,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryCta: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.xxl,
  },
  primaryCtaText: {
    color: COLORS.white,
    fontWeight: FONT.bold,
    fontSize: 14,
  },
  footerErrorCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.xl,
    gap: 10,
  },
  footerErrorText: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
  },
  footerRetryBtn: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  footerRetryText: {
    color: COLORS.white,
    fontWeight: FONT.bold,
    fontSize: 13,
  },
  footerSpinner: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerEnd: {
    paddingVertical: 28,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  footerEndText: {
    fontSize: FONT.md,
    fontWeight: FONT.semibold,
    color: COLORS.textSecondary,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.white,
    shadowColor: '#3A2A1E',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.savanna,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  filterTxt: {
    fontSize: FONT.sm,
    fontWeight: FONT.semibold,
    color: COLORS.earth,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    maxWidth: 220,
  },
  chipTxt: {
    fontSize: FONT.xs + 1,
    fontWeight: FONT.semibold,
    color: COLORS.primary,
    flexShrink: 1,
  },
});

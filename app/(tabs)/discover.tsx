import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { FlashList, type FlashListProps } from '@shopify/flash-list';

/** One row = two Discover cards (manual 2-column layout). */
type DiscoverGridRow = [User, User | null];

type AnimatedDiscoverFlashListProps = FlashListProps<DiscoverGridRow> & {
  onScroll?: (...args: unknown[]) => void;
};

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as React.ComponentType<AnimatedDiscoverFlashListProps>;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { COLORS, RADIUS, FONT, RELIGION_OPTIONS } from '@/constants';
import { FilterOptions, User } from '@/types';

/** Discover title row height (excludes status bar + filter chips). */
const HEADER_ROW = 64;
/** Breathing room below the status bar / notch before the title row. */
const HEADER_BAR_TOP_PAD = 8;
/** Vertical scroll (px) over which the header eases to its max upward shift — longer = slower, gentler motion. */
const HEADER_PARALLAX_SCROLL_RANGE = 200;
/** Max upward translation (px) of the bar below the safe area — keep small so nothing feels clipped. */
const HEADER_PARALLAX_MAX_UP = 10;
/** Slight downward shift when pulling past the top (overscroll). */
const HEADER_OVERSCROLL_DOWN = 5;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const user = useAuthStore((s) => s.user);
  const {
    users,
    isLoading,
    hasMore,
    filters,
    fetchError,
    fetchUsers,
    clearFetchError,
    setFilters,
    resetFilters,
  } = useDiscoverStore(
    useShallow((s) => ({
      users: s.users,
      isLoading: s.isLoading,
      hasMore: s.hasMore,
      filters: s.filters,
      fetchError: s.fetchError,
      fetchUsers: s.fetchUsers,
      clearFetchError: s.clearFetchError,
      setFilters: s.setFilters,
      resetFilters: s.resetFilters,
    })),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const scrollY = useMemo(() => new Animated.Value(0), []);
  const headerTranslateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [-40, 0, HEADER_PARALLAX_SCROLL_RANGE],
        outputRange: [HEADER_OVERSCROLL_DOWN, 0, -HEADER_PARALLAX_MAX_UP],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );
  const headerShadowOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 36],
        outputRange: [0.12, 0.22],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );

  /** Must be referentially stable — a fresh `{ min, max }` every render re-ran `fetchUsers` in a loop. */
  const minAgePref = user?.min_age_pref;
  const maxAgePref = user?.max_age_pref;
  const agePref = useMemo(
    () =>
      minAgePref != null && maxAgePref != null ? { min: minAgePref, max: maxAgePref } : undefined,
    [minAgePref, maxAgePref],
  );

  useEffect(() => {
    if (!user) return;
    fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
  }, [
    user?.id,
    user?.interested_in,
    agePref,
    fetchUsers,
  ]);

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
    if (!isLoading && hasMore && user)
      void fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: false, agePref });
  }, [isLoading, hasMore, user, fetchUsers, agePref]);

  const browseOrderIds = useMemo(() => users.map((u) => u.id), [users]);
  const setProfileBrowseOrder = useProfileBrowseStore((s) => s.setOrderedUserIds);

  const beforeProfileNavigate = useCallback(() => {
    setProfileBrowseOrder(browseOrderIds);
  }, [setProfileBrowseOrder, browseOrderIds]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.online_only) {
      chips.push({
        key: 'online',
        label: 'Online now',
        clear: () => setFilters({ online_only: false }),
      });
    }
    if (filters.country) {
      const loc = [filters.city, filters.state, filters.country].filter(Boolean).join(', ');
      chips.push({
        key: 'loc',
        label: loc,
        clear: () => setFilters({ country: null, state: null, city: null }),
      });
    }
    if (filters.religion) {
      const label =
        RELIGION_OPTIONS.find((o) => o.value === filters.religion)?.label ??
        String(filters.religion);
      chips.push({ key: 'religion', label, clear: () => setFilters({ religion: null }) });
    }
    if (filters.min_age !== 18 || filters.max_age !== 100) {
      chips.push({
        key: 'age',
        label: `Age ${filters.min_age}–${filters.max_age}`,
        clear: () => setFilters({ min_age: 18, max_age: 100 }),
      });
    }
    if (filters.verified_only) {
      chips.push({
        key: 'verified',
        label: 'Verified',
        clear: () => setFilters({ verified_only: false }),
      });
    }
    return chips;
  }, [filters, setFilters]);
  const activeFilterCount = activeFilterChips.length;

  const handleApplyFilters = useCallback(
    (next: FilterOptions) => {
      haptics.tapLight();
      setFilters(next);
      if (user)
        fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
    },
    [setFilters, fetchUsers, user, agePref],
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
    if (user)
      fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
  }, [resetFilters, fetchUsers, user, agePref]);

  const handleChipClear = useCallback(
    (clear: () => void) => {
      haptics.tapLight();
      clear();
      if (user)
        fetchUsers({ userId: user.id, interestedIn: user.interested_in, reset: true, agePref });
    },
    [user, fetchUsers, agePref],
  );

  const handleLongPressUser = useCallback(
    (selectedUser: User) => {
      const idx = users.findIndex((u) => u.id === selectedUser.id);
      setPreviewStartIndex(idx >= 0 ? idx : 0);
      setShowPreview(true);
    },
    [users],
  );

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
      // viewableItems[].index is a row index into a 2-column grid; multiply by 2
      // to get the correct user index offset for lookahead prefetching.
      const lastVisibleRowIdx = viewableItems[viewableItems.length - 1]?.index ?? 0;
      const lastVisibleUserIdx = (lastVisibleRowIdx + 1) * 2;
      const lookahead = usersRef.current.slice(lastVisibleUserIdx, lastVisibleUserIdx + 6);
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
  const totalHeaderHeight = insets.top + HEADER_BAR_TOP_PAD + HEADER_ROW + filterChipsHeight;
  const listPaddingTop = insets.top + HEADER_BAR_TOP_PAD + filterChipsHeight + 10 + HEADER_ROW;

  const screenWidth = Dimensions.get('window').width;
  const GRID_PADDING = 16; // padding on each side of the list
  const GRID_GUTTER = 16; // gap between the two columns
  const CARD_WIDTH = Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GUTTER) / 2);
  const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.45);
  // Group users into pairs for manual 2-column rows
  const rowPairs = useMemo((): DiscoverGridRow[] => {
    const pairs: DiscoverGridRow[] = [];
    for (let i = 0; i < users.length; i += 2) {
      pairs.push([users[i], users[i + 1] ?? null]);
    }
    return pairs;
  }, [users]);

  const renderRow = useCallback(
    (pair: DiscoverGridRow) => (
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
    ),
    [CARD_HEIGHT, CARD_WIDTH, beforeProfileNavigate, handleLongPressUser],
  );

  const emptyContent =
    isLoading && users.length === 0 ? (
      <View style={s.skeletonGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} width={CARD_WIDTH} height={CARD_HEIGHT} radius={20} />
        ))}
      </View>
    ) : fetchError ? (
      <View style={s.emptyState}>
        <Ionicons name="cloud-offline-outline" size={44} color={COLORS.textMuted} />
        <Text style={s.emptyTitle}>Could not load Discover</Text>
        <Text style={s.emptyBody}>{fetchError}</Text>
        <TouchableOpacity
          onPress={() => {
            clearFetchError();
            if (user)
              void fetchUsers({
                userId: user.id,
                interestedIn: user.interested_in,
                reset: true,
                agePref,
              });
          }}
          style={s.primaryCta}
        >
          <Text style={s.primaryCtaText}>Try again</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={[s.emptyState, s.emptyStateTight]}>
        <Text style={s.emptyEmoji}>🌍</Text>
        <Text style={s.emptyTitle}>No members found</Text>
        <Text style={s.emptyBody}>
          Try widening your filters and more Africana members will appear.
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              resetFilters();
              if (user)
                void fetchUsers({
                  userId: user.id,
                  interestedIn: user.interested_in,
                  reset: true,
                  agePref,
                });
            }}
            style={s.attentionCta}
          >
            <Text style={s.attentionCtaText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );

  const footerContent =
    users.length === 0 ? null : (
      <View>
        {fetchError ? (
          <View style={s.footerErrorCard}>
            <Text style={s.footerErrorText}>{fetchError}</Text>
            <TouchableOpacity
              onPress={() => {
                clearFetchError();
                if (user)
                  void fetchUsers({
                    userId: user.id,
                    interestedIn: user.interested_in,
                    reset: true,
                    agePref,
                  });
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
            <Text style={s.footerEndText}>All caught up</Text>
          </View>
        ) : null}
      </View>
    );

  return (
    <View style={s.screen}>
      {/* ── Full-screen scrollable grid (stays under header in z-order) ── */}
      <View style={[s.flex, s.listUnderHeader]}>
        {Platform.OS === 'web' ? (
          <ScrollView
            style={s.flex}
            contentContainerStyle={{
              paddingTop: listPaddingTop,
              paddingHorizontal: GRID_PADDING,
              paddingBottom: tabBarHeight + 16,
            }}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            scrollEventThrottle={16}
          >
            {rowPairs.length > 0
              ? rowPairs.map((pair) => (
                  <React.Fragment key={`${pair[0].id}-${pair[1]?.id ?? 'none'}`}>
                    {renderRow(pair)}
                  </React.Fragment>
                ))
              : emptyContent}
            {footerContent}
          </ScrollView>
        ) : (
          <AnimatedFlashList
            data={rowPairs}
            keyExtractor={(pair) => `${pair[0].id}-${pair[1]?.id ?? 'none'}`}
            style={s.flex}
            contentContainerStyle={{
              paddingTop: listPaddingTop,
              paddingHorizontal: GRID_PADDING,
              paddingBottom: tabBarHeight + 16,
            }}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
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
                progressViewOffset={totalHeaderHeight + 8}
              />
            }
            renderItem={({ item }) => renderRow(item)}
            ListEmptyComponent={emptyContent}
            ListFooterComponent={footerContent}
          />
        )}
      </View>

      {/* Safe top inset stays fixed; only the title row + chips parallax so nothing hides under the notch. */}
      <View pointerEvents="box-none" style={s.headerWrap}>
        <View style={[s.headerSafeTop, { height: insets.top }]} />
        <Animated.View
          style={[
            s.headerBar,
            { paddingTop: HEADER_BAR_TOP_PAD },
            {
              transform: [{ translateY: headerTranslateY }],
              shadowOpacity: headerShadowOpacity,
            },
          ]}
        >
          <View style={s.headerRow}>
            <View style={s.headerTitleWrap}>
              <Text accessibilityRole="header" style={s.headerTitle} numberOfLines={1}>
                Discover
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Open filters'
              }
              onPress={() => setShowFilters(true)}
              style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth}
              />
              <Text style={[s.filterTxt, activeFilterCount > 0 && { color: COLORS.primary }]}>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
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
                  <Text style={s.chipTxt} numberOfLines={1}>
                    {chip.label}
                  </Text>
                  <Ionicons name="close" size={13} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </Animated.View>
      </View>

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
    overflow: 'visible',
  },
  listUnderHeader: {
    zIndex: 0,
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
  /** Soft "needs attention" button — same palette used for empty profile
   *  fields. Lighter than a primary action because clearing filters is a
   *  reset, not an affirmative go-action. */
  attentionCta: {
    marginTop: 4,
    backgroundColor: COLORS.emptyFieldSurface,
    borderColor: COLORS.emptyFieldBorder,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.xxl,
  },
  attentionCtaText: {
    color: COLORS.emptyField,
    fontWeight: FONT.bold,
    fontSize: 14,
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
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    overflow: 'visible',
    ...Platform.select({
      android: { elevation: 20 },
      default: {},
    }),
  },
  headerSafeTop: {
    width: '100%',
    backgroundColor: COLORS.white,
  },
  headerBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    shadowColor: '#3A2A1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: HEADER_ROW,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  headerTitle: {
    fontFamily: FONT.displayFamily,
    fontSize: FONT.xxl + 4,
    color: COLORS.textStrong,
    letterSpacing: 0.2,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    backgroundColor: COLORS.savanna,
    paddingHorizontal: 14,
    paddingVertical: 10,
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

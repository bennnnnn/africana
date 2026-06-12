import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { COLORS, FONT, RADIUS } from '@/constants';
import { LIKES_EMPTY_STATES, LIKES_TAB_META } from '@/constants/likes-screen';
import { likesScreenStyles as s } from '@/components/likes/likes-screen-styles';
import { LikesHubTabStrip } from '@/components/likes/LikesHubTabStrip';
import { LikesRow } from '@/components/likes/LikesRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { LikesHubHeader } from '@/components/likes/LikesHubHeader';
import { useLikesHub } from '@/context/likes-hub-context';
import type { LikesHubListItem } from '@/lib/likes-fetch-users';
import { isLikesActivityNew } from '@/lib/utils';
import { isProSync, PAYMENTS_ENABLED } from '@/lib/payments';
import { showProGateDialog } from '@/lib/pro-gate';
import type { User } from '@/types';

export default function LikesHubScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const {
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
  } = useLikesHub();

  const screenTitle = LIKES_TAB_META[activeTab].label;
  const tabSeenAt = activitySeenAt?.[activeTab];
  const seenLoaded = activitySeenAt != null;
  const viewersLocked =
    PAYMENTS_ENABLED && activeTab === 'viewers' && !isProSync();

  const handleListRowPress = (u: User) => {
    if (viewersLocked) {
      showProGateDialog({
        title: 'See who viewed you',
        message: 'Upgrade to Pro to reveal names, photos, and full profiles.',
      });
      return;
    }
    handleRowPress(u);
  };

  const renderFooter = () => {
    if (!activeHasMore || activeList.length === 0) return null;

    if (activeLoadingMore) {
      return (
        <View style={s.footerLoading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <TouchableOpacity onPress={handleLoadMore} style={s.loadMoreBtn} activeOpacity={0.7}>
        <Text style={s.loadMoreText}>Load more</Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (activeError) {
      return (
        <View style={s.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textMuted} />
          <Text style={s.errorText}>{activeError}</Text>
          <TouchableOpacity onPress={handleRetry} style={s.retryBtn}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!loadedTabs.has(activeTab) && !refreshing) {
      return (
        <View style={{ paddingTop: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      );
    }

    return (
      <EmptyState
        icon={LIKES_EMPTY_STATES[activeTab].icon}
        title={LIKES_EMPTY_STATES[activeTab].title}
        description={LIKES_EMPTY_STATES[activeTab].desc}
      />
    );
  };

  // Pro gate (when PAYMENTS_ENABLED): free users see anonymous viewer teasers plus
  // an upsell banner; Pro users see the full list. Data still loads for both so
  // the teaser count is real. Pre-payments (PAYMENTS_ENABLED=false) shows all viewers.
  const viewersUpsellHeader =
    viewersLocked && activeList.length > 0 ? (
      <ViewersUpsellBanner viewersCount={counts.viewers ?? activeList.length} />
    ) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <LikesHubHeader title={screenTitle} />

      <LikesHubTabStrip activeTab={activeTab} counts={counts} onTabPress={handleTabPress} />

      <FlashList<LikesHubListItem>
        data={activeList}
        keyExtractor={(item) => item.user.id}
        extraData={{ activeTab, tabSeenAt, seenLoaded, matchIds, viewersLocked }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListHeaderComponent={viewersUpsellHeader}
        ListEmptyComponent={
          viewersLocked && !activeError && loadedTabs.has(activeTab) ? (
            <ViewersUpsellEmpty viewersCount={counts.viewers ?? 0} />
          ) : (
            renderEmpty()
          )
        }
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          const u = item.user;
          const isNew = isLikesActivityNew(item.activityAt, tabSeenAt, seenLoaded);
          return (
            <LikesRow
              user={u}
              isMutual={activeTab !== 'matches' && matchIds.has(u.id)}
              isNew={isNew}
              showMessageButton={showMessageButton}
              locked={viewersLocked}
              onPress={handleListRowPress}
              onMessagePress={handleMessageStable}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

function ViewersUpsellBanner({ viewersCount }: { viewersCount: number }) {
  const headline =
    viewersCount > 0
      ? `${viewersCount} ${viewersCount === 1 ? 'person' : 'people'} viewed you`
      : 'People are viewing your profile';
  return (
    <View style={upsell.banner}>
      <View style={upsell.bannerTextWrap}>
        <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={upsell.bannerTitle}>{headline}</Text>
          <Text style={upsell.bannerBody}>
            {viewersCount > 0
              ? 'Upgrade to see who they are — names and profiles stay hidden until then.'
              : 'Upgrade to Pro to see who visits your profile.'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={upsell.ctaCompact}
        onPress={() => router.push('/(settings)/upgrade')}
        activeOpacity={0.85}
      >
        <Text style={upsell.ctaText}>Go Pro</Text>
      </TouchableOpacity>
    </View>
  );
}

function ViewersUpsellEmpty({ viewersCount }: { viewersCount: number }) {
  if (viewersCount > 0) {
    return (
      <View style={upsell.emptyWithCount}>
        <ViewersUpsellBanner viewersCount={viewersCount} />
        <Text style={upsell.emptyHint}>
          Viewer previews load here. Names and profiles unlock with Pro.
        </Text>
      </View>
    );
  }
  return (
    <EmptyState
      icon={LIKES_EMPTY_STATES.viewers.icon}
      title={LIKES_EMPTY_STATES.viewers.title}
      description={LIKES_EMPTY_STATES.viewers.desc}
    />
  );
}

const upsell = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}33`,
  },
  bannerTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerTitle: {
    fontSize: FONT.sm,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
  },
  bannerBody: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  ctaCompact: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: FONT.sm,
    fontWeight: FONT.extrabold,
  },
  emptyWithCount: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyHint: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});

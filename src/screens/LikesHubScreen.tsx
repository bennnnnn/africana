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
import { isProSync } from '@/lib/payments';

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

  // Pro gate: the Views tab is Pro-only. We still show the tab strip so the
  // user knows it exists (and the badge can still surface unseen counts —
  // a great upsell trigger), but the body becomes an Upgrade card.
  const showViewersUpsell = activeTab === 'viewers' && !isProSync();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <LikesHubHeader title={screenTitle} />

      <LikesHubTabStrip activeTab={activeTab} counts={counts} onTabPress={handleTabPress} />

      {showViewersUpsell ? (
        <ViewersUpsell viewersCount={counts.viewers ?? 0} />
      ) : (
        <FlashList<LikesHubListItem>
          data={activeList}
          keyExtractor={(item) => item.user.id}
          extraData={{ activeTab, tabSeenAt, seenLoaded, matchIds }}
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
          ListEmptyComponent={renderEmpty}
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
                onPress={handleRowPress}
                onMessagePress={handleMessageStable}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ViewersUpsell({ viewersCount }: { viewersCount: number }) {
  const headline =
    viewersCount > 0
      ? `${viewersCount} ${viewersCount === 1 ? 'person' : 'people'} viewed you`
      : 'See who viewed your profile';
  return (
    <View style={upsell.container}>
      <View style={upsell.iconWrap}>
        <Ionicons name="eye-outline" size={32} color={COLORS.primary} />
      </View>
      <Text style={upsell.title}>{headline}</Text>
      <Text style={upsell.body}>
        Africana Pro reveals who viewed your profile. Unlimited likes and messages too.
      </Text>
      <TouchableOpacity
        style={upsell.cta}
        onPress={() => router.push('/(settings)/upgrade')}
        activeOpacity={0.85}
      >
        <Text style={upsell.ctaText}>Go Pro</Text>
      </TouchableOpacity>
    </View>
  );
}

const upsell = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: FONT.xl,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },
  cta: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: RADIUS.full,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: FONT.extrabold,
  },
});

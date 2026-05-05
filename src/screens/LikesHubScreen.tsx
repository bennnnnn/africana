import React from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { COLORS } from '@/constants';
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <LikesHubHeader title={screenTitle} />

      <LikesHubTabStrip activeTab={activeTab} counts={counts} onTabPress={handleTabPress} />

      <FlashList<LikesHubListItem>
        data={activeList}
        keyExtractor={(item) => item.user.id}
        extraData={{ activeTab, tabSeenAt, seenLoaded, matchIds }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
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
    </SafeAreaView>
  );
}

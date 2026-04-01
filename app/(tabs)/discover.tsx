import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useChatStore } from '@/store/chat.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS } from '@/constants';

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const { users, isLoading, hasMore, filters, fetchUsers, fetchLikedUserIds, toggleLike, likedUserIds, setFilters, resetFilters } =
    useDiscoverStore();
  const { getOrCreateConversation } = useChatStore();
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUsers(user.id, true);
      fetchLikedUserIds(user.id);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchUsers(user.id, true);
    setRefreshing(false);
  }, [user]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore && user) {
      fetchUsers(user.id);
    }
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) {
      router.push(`/(chat)/${convId}`);
    }
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'min_age') return v !== 18;
    if (k === 'max_age') return v !== 80;
    return v !== null && v !== false;
  }).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: '#FFFFFF',
        }}
      >
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>
            🌍 Discover
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {users.length > 0 ? `${users.length} members found` : 'Find your connection'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: activeFilterCount > 0 ? `${COLORS.primary}15` : COLORS.savanna,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: activeFilterCount > 0 ? 1 : 0,
            borderColor: COLORS.primary,
          }}
        >
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeFilterCount > 0 ? COLORS.primary : COLORS.earth }}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          <UserCard
            user={item}
            isLiked={likedUserIds.has(item.id)}
            onLike={(id) => user && toggleLike(user.id, id)}
            onMessage={handleMessage}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="compass-outline"
              title="No members found"
              description="Try adjusting your filters or check back later."
            />
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

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => {
          setFilters(f);
          if (user) fetchUsers(user.id, true);
        }}
        onReset={() => {
          resetFilters();
          if (user) fetchUsers(user.id, true);
        }}
      />
    </SafeAreaView>
  );
}

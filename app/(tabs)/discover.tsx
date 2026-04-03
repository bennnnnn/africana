import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useChatStore } from '@/store/chat.store';
import { UserCard } from '@/components/discover/UserCard';
import { FilterSheet } from '@/components/discover/FilterSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { MatchModal } from '@/components/ui/MatchModal';
import { COLORS } from '@/constants';
import { User } from '@/types';

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const { users, isLoading, hasMore, filters, fetchUsers, fetchLikedUserIds, toggleLike, likedUserIds, setFilters, resetFilters } =
    useDiscoverStore();
  const { getOrCreateConversation } = useChatStore();
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [matchUser, setMatchUser] = useState<User | null>(null);

  // Fade-in animation for the header greeting
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUsers(user.id, user.interested_in, true);
      fetchLikedUserIds(user.id);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchUsers(user.id, user.interested_in, true);
    setRefreshing(false);
  }, [user]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore && user) {
      fetchUsers(user.id, user.interested_in);
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
    if (k === 'max_age') return v !== 100;
    if (k === 'online_only') return v === true;
    return v !== null;
  }).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: '#FFFFFF',
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }}
      >
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>
            🌍 Discover
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1 }}>
            {user ? `Hey ${user.full_name?.split(' ')[0] ?? ''} 👋  ` : ''}
            {users.length > 0 ? `${users.length} members` : 'Find your connection'}
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
            borderWidth: activeFilterCount > 0 ? 1.5 : 0,
            borderColor: COLORS.primary,
          }}
        >
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? COLORS.primary : COLORS.earth} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeFilterCount > 0 ? COLORS.primary : COLORS.earth }}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </Animated.View>

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
            onLike={async (id) => {
              if (!user) return;
              const wasLiked = likedUserIds.has(id);
              const isMatch = await toggleLike(user.id, id);
              if (isMatch && !wasLiked) {
                setMatchUser(users.find((u) => u.id === id) ?? null);
              }
            }}
            onMessage={handleMessage}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 }}>
              <Text style={{ fontSize: 48 }}>🌍</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}>
                No members found
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                Try widening your filters — age range, location, or religion — and more Africana members will appear.
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  onPress={() => { resetFilters(); if (user) fetchUsers(user.id, user.interested_in, true); }}
                  style={{ marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Clear Filters</Text>
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

      <MatchModal
        visible={!!matchUser}
        matchedUser={matchUser}
        onClose={() => setMatchUser(null)}
      />
    </SafeAreaView>
  );
}

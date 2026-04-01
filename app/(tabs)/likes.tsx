import React, { useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { EmptyState } from '@/components/ui/EmptyState';

type Tab = 'received' | 'sent';

export default function LikesScreen() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('received');
  const [receivedLikes, setReceivedLikes] = useState<User[]>([]);
  const [sentLikes, setSentLikes] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLikes = async () => {
    if (!user) return;

    const [{ data: received }, { data: sent }] = await Promise.all([
      supabase
        .from('likes')
        .select('from_user:profiles!from_user_id(*)')
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('likes')
        .select('to_user:profiles!to_user_id(*)')
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (received) setReceivedLikes(received.map((r: { from_user: unknown }) => r.from_user as User));
    if (sent) setSentLikes(sent.map((s: { to_user: unknown }) => s.to_user as User));
  };

  useEffect(() => {
    fetchLikes().finally(() => setIsLoading(false));
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLikes();
    setRefreshing(false);
  };

  const displayList = tab === 'received' ? receivedLikes : sentLikes;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 0,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 14 }}>
          Likes ❤️
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row' }}>
          {(['received', 'sent'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingBottom: 12,
                borderBottomWidth: 2,
                borderBottomColor: tab === t ? COLORS.primary : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: tab === t ? '700' : '400',
                  color: tab === t ? COLORS.primary : COLORS.textSecondary,
                  textTransform: 'capitalize',
                }}
              >
                {t} ({t === 'received' ? receivedLikes.length : sentLikes.length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={displayList}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16 }}
        columnWrapperStyle={{ justifyContent: 'space-between', gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title={tab === 'received' ? 'No likes yet' : 'You haven\'t liked anyone yet'}
            description={
              tab === 'received'
                ? 'Complete your profile to attract more attention.'
                : 'Browse discover to find someone you like.'
            }
          />
        }
        renderItem={({ item }) => {
          const avatar = item.avatar_url || item.profile_photos[0] || `${DEFAULT_AVATAR}${encodeURIComponent(item.full_name.charAt(0))}`;
          const today = new Date();
          const age = today.getFullYear() - new Date(item.birthdate).getFullYear();
          const location = [item.city, item.country].filter(Boolean).join(', ');

          return (
            <TouchableOpacity
              onPress={() => router.push(`/profile/${item.id}`)}
              style={{
                flex: 1,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 2,
                marginBottom: 12,
              }}
            >
              <Image
                source={{ uri: avatar }}
                style={{ width: '100%', aspectRatio: 0.8 }}
                contentFit="cover"
              />
              <View style={{ padding: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }} numberOfLines={1}>
                  {item.full_name}, {age}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, flex: 1 }} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

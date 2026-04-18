import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,

  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfileBrowseStore } from '@/store/profile-browse.store';
import { useChatStore } from '@/store/chat.store';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function OnlineScreen() {
  const { user } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOnlineUsers = async () => {
    if (!user) return;

    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    const blockedIds = blocks?.map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)) ?? [];

    let query = supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .eq('show_in_discover', true)
      .eq('online_visible', true)
      .eq('online_status', 'online')
      .order('online_status', { ascending: true })
      .order('last_seen', { ascending: false });

    if (blockedIds.length > 0) {
      query = query.not('id', 'in', `(${blockedIds.join(',')})`);
    }

    const { data } = await query;
    if (data) setOnlineUsers(data);
  };

  useEffect(() => {
    fetchOnlineUsers().finally(() => setIsLoading(false));

    const channel = supabase
      .channel(`online-users:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchOnlineUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOnlineUsers();
    setRefreshing(false);
  };

  const handleMessage = async (toUserId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, toUserId);
    if (convId) {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: toUserId } });
    }
  };

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
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>
          Online Now
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.online }} />
          <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {onlineUsers.length} online now
          </Text>
        </View>
      </View>

      <FlatList
        data={onlineUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No one online right now"
            description="Check back later to see who's online and ready to connect."
          />
        }
        renderItem={({ item }) => {
          const avatar = item.avatar_url || item.profile_photos[0] || `${DEFAULT_AVATAR}${encodeURIComponent(item.full_name.charAt(0))}`;
          const statusColor = COLORS.online;
          const location = [item.city, item.country].filter(Boolean).join(', ');

          const today = new Date();
          const birthdate = new Date(item.birthdate);
          const age = today.getFullYear() - birthdate.getFullYear();

          return (
            <TouchableOpacity
              onPress={() => {
                setProfileSeed(item);
                useProfileBrowseStore.getState().setOrderedUserIds(onlineUsers.map((u) => u.id));
                router.push(`/(profile)/${item.id}`);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View style={{ position: 'relative', marginRight: 14 }}>
                <Image
                  source={{ uri: avatar }}
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                  contentFit="cover"
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 1,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: statusColor,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                  {item.full_name}, {age}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{location}</Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.online, marginTop: 3, fontWeight: '600' }}>
                  Online now
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleMessage(item.id)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: COLORS.primarySurface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

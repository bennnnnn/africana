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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS } from '@/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const { conversations, isLoading, fetchConversations } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) fetchConversations(user.id);
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchConversations(user.id);
    setRefreshing(false);
  };

  if (isLoading && conversations.length === 0) {
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
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            description="Browse Discover to find someone interesting and start a conversation."
          />
        }
        renderItem={({ item }) => {
          const otherUser = item.other_user;
          const hasUnread = (item.unread_count ?? 0) > 0;

          return (
            <TouchableOpacity
              onPress={() => router.push(`/(chat)/${item.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <Avatar
                uri={otherUser?.avatar_url}
                name={otherUser?.full_name ?? '?'}
                size={54}
                onlineStatus={otherUser?.online_status}
                showStatus
              />

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: hasUnread ? '700' : '600',
                      color: COLORS.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {otherUser?.full_name ?? 'Unknown'}
                  </Text>
                  {item.last_message_at && (
                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                      {dayjs(item.last_message_at).fromNow()}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: hasUnread ? COLORS.text : COLORS.textSecondary,
                      fontWeight: hasUnread ? '500' : '400',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {item.last_message ?? 'Start a conversation'}
                  </Text>
                  {hasUnread && (
                    <View
                      style={{
                        backgroundColor: COLORS.primary,
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 5,
                        marginLeft: 8,
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {item.unread_count}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

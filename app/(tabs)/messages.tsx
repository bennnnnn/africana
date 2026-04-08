import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS, RADIUS, FONT, SHADOWS } from '@/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const { conversations, isLoading, fetchConversations, deleteConversation } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conversation) => conversation.id));
  }, [conversations]);

  const scheduleRefresh = useCallback(() => {
    if (!user) return;
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      fetchConversations(user.id);
    }, 120);
  }, [fetchConversations, user?.id]);

  useEffect(() => {
    if (!user) return;
    fetchConversations(user.id);

    channelRef.current = supabase
      .channel(`conv-list-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as { conversation_id?: string; sender_id?: string };
        if (!message.conversation_id || message.sender_id === user.id) return;
        if (conversationIdsRef.current.has(message.conversation_id)) {
          scheduleRefresh();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const participantIds = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (participantIds.includes(user.id)) {
          scheduleRefresh();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const participantIds = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (participantIds.includes(user.id)) {
          scheduleRefresh();
        }
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [scheduleRefresh, user?.id]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchConversations(user.id);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.other_user?.full_name?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      {/* Search */}
      {conversations.length > 0 && (
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations..."
            placeholderTextColor={COLORS.textMuted}
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 16, gap: 10 }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    height: 80,
                    borderRadius: RADIUS.lg,
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={search ? 'No results found' : 'No messages yet'}
              description={
                search
                  ? 'Try a different name.'
                  : 'Browse Discover to find someone interesting and start a conversation.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const other = item.other_user;
          const hasUnread = (item.unread_count ?? 0) > 0;

          return (
            <TouchableOpacity
              onPress={() => router.push(`/(chat)/${item.id}`)}
              onLongPress={() => {
                Alert.alert(
                  'Delete conversation',
                  `Delete your conversation with ${other?.full_name ?? 'this user'}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteConversation(item.id),
                    },
                  ]
                );
              }}
              delayLongPress={500}
              style={[s.convoCard, hasUnread && s.convoCardUnread]}
              activeOpacity={0.85}
            >
              <Avatar
                uri={other?.avatar_url}
                name={other?.full_name ?? '?'}
                size={52}
                onlineStatus={other?.online_status}
                showStatus
              />

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[s.convoName, hasUnread && { fontWeight: '700' }]} numberOfLines={1}>
                    {other?.full_name ?? 'Unknown'}
                  </Text>
                  {item.last_message_at && (
                    <Text style={s.convoTime}>{dayjs(item.last_message_at).fromNow()}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                  <Text
                    style={[s.convoPreview, hasUnread && { color: COLORS.text, fontWeight: '500' }]}
                    numberOfLines={1}
                  >
                    {item.last_message ?? 'Start a conversation'}
                  </Text>
                  {hasUnread && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{item.unread_count}</Text>
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

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  title: { fontSize: FONT.xxl, fontWeight: FONT.extrabold, color: COLORS.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.savanna,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  convoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  convoCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  convoName: { fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.text, flex: 1 },
  convoTime: { fontSize: FONT.xs, color: COLORS.textMuted },
  convoPreview: { fontSize: FONT.sm, color: COLORS.textSecondary, flex: 1 },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  badgeText: { color: COLORS.white, fontSize: FONT.xs, fontWeight: FONT.bold },
});

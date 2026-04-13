import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useDialog } from '@/components/ui/DialogProvider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS, RADIUS, FONT } from '@/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { conversations, isLoading, fetchConversations, deleteConversation } = useChatStore();
  const { showDialog } = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // Always refresh: new threads won’t be in local list until fetch runs.
        scheduleRefresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (ids.includes(user.id)) scheduleRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const ids = (payload.new as { participant_ids?: string[] })?.participant_ids ?? [];
        if (ids.includes(user.id)) scheduleRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [scheduleRefresh, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchConversations(user.id);
    }, [fetchConversations, user?.id]),
  );

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchConversations(user.id);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.other_user?.full_name?.toLowerCase().includes(q));
  }, [conversations, search]);

  const ListHeader = (
    <View style={s.searchWrap}>
      <Ionicons name="search-outline" size={15} color={COLORS.textMuted} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search conversations..."
        placeholderTextColor={COLORS.textMuted}
        style={s.searchInput}
      />
      {search.length > 0 && (
        <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={conversations.length > 0 ? ListHeader : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 16, gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={s.skeleton} />
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
              onPress={() =>
                router.push({
                  pathname: '/(chat)/[id]',
                  params: {
                    id: item.id,
                    ...(other?.id ? { otherUserId: other.id } : {}),
                  },
                })
              }
              onLongPress={() => {
                showDialog({
                  title: 'Delete conversation',
                  message: `Delete your conversation with ${other?.full_name ?? 'this user'}? This cannot be undone.`,
                  actions: [
                    { label: 'Cancel' },
                    { label: 'Delete', style: 'destructive', onPress: () => deleteConversation(item.id) },
                  ],
                });
              }}
              delayLongPress={500}
              style={s.card}
              activeOpacity={0.82}
            >
              <Avatar
                uri={other?.avatar_url}
                name={other?.full_name ?? '?'}
                size={52}
                onlineStatus={other?.online_status}
                showStatus
              />

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.cardTop}>
                  <Text style={[s.cardName, hasUnread && s.cardNameUnread]} numberOfLines={1}>
                    {other?.full_name ?? 'Unknown'}
                  </Text>
                  {item.last_message_at && (
                    <Text style={s.cardTime}>{dayjs(item.last_message_at).fromNow()}</Text>
                  )}
                </View>
                <View style={s.cardBottom}>
                  <Text
                    style={[s.cardPreview, hasUnread && s.cardPreviewUnread]}
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
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title:    { fontSize: FONT.xxl, fontWeight: FONT.extrabold, color: COLORS.text },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.sm,
    color: COLORS.text,
    padding: 0,
  },

  // ── Conversation card ───────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName:        { fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.text, flex: 1 },
  cardNameUnread:  { fontWeight: FONT.extrabold, color: COLORS.text },
  cardTime:        { fontSize: FONT.xs, color: COLORS.textMuted, marginLeft: 8 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  cardPreview:        { fontSize: FONT.sm, color: COLORS.textSecondary, flex: 1 },
  cardPreviewUnread:  { color: COLORS.text, fontWeight: FONT.medium },

  // ── Unread badge ────────────────────────────────────────────────────────────
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

  // ── Loading skeleton ────────────────────────────────────────────────────────
  skeleton: {
    height: 76,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

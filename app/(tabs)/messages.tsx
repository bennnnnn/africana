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
  AppState,
  AppStateStatus,
} from 'react-native';
import { useDialog } from '@/components/ui/DialogProvider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { COLORS, RADIUS, FONT } from '@/constants';
import haptics from '@/lib/haptics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { conversations, isLoading, fetchConversations, deleteConversation } = useChatStore();
  const { showDialog, showToast } = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Re-fetch when app returns from background — catches messages missed while suspended
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && appStateRef.current !== 'active' && user) {
        fetchConversations(user.id);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [fetchConversations, user?.id]);

  // Realtime + eager fetch live in (tabs)/_layout — avoids duplicate channels and triple fetch on open.

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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header */}
      <View style={s.header}>
        <ScreenTitle>Messages</ScreenTitle>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16, backgroundColor: COLORS.white }}
        style={{ backgroundColor: COLORS.white }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={conversations.length > 0 ? ListHeader : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
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
                const otherName = other?.full_name ?? 'this user';
                showDialog({
                  title: 'Delete conversation',
                  message: `Your entire chat with ${otherName} will be permanently removed. This cannot be undone.`,
                  icon: 'trash-outline',
                  actions: [
                    { label: 'Cancel', style: 'cancel' },
                    {
                      label: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        haptics.tapMedium();
                        await deleteConversation(item.id);
                        showToast({ message: 'Conversation deleted', icon: 'trash-outline' });
                      },
                    },
                  ],
                });
              }}
              delayLongPress={500}
              style={s.row}
              activeOpacity={0.65}
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
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.savanna,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.sm,
    color: COLORS.text,
    padding: 0,
  },

  // ── Conversation row (flat, hairline-separated) ────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 80,
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
});

import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
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
import { acquireTypingChannel } from '@/lib/typing-channel';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Conversation } from '@/types';
import { COLORS, RADIUS, FONT } from '@/constants';
import haptics from '@/lib/haptics';
import { isUserEffectivelyOnline } from '@/lib/utils';
import dayjs from 'dayjs';

const ROW_HEIGHT = 76;
const TYPING_TTL_MS = 3500;
/** Cap how many conversations we open realtime channels on for typing. */
const MAX_TYPING_SUBSCRIPTIONS = 30;

/**
 * Compact time labels for the conversation list.
 *  < 60 s   → "now"
 *  < 60 m   → "5m"
 *  < 24 h   → "3h"
 *  yesterday → "Yesterday"
 *  < 7 days → weekday "Tue"
 *  else     → "Mar 21"
 */
function formatConversationTime(iso: string): string {
  const then = dayjs(iso);
  if (!then.isValid()) return '';
  const now = dayjs();
  const diffSec = now.diff(then, 'second');
  if (diffSec < 60) return 'now';
  const diffMin = now.diff(then, 'minute');
  if (diffMin < 60) return `${diffMin}m`;
  if (now.isSame(then, 'day')) return `${now.diff(then, 'hour')}h`;
  if (now.subtract(1, 'day').isSame(then, 'day')) return 'Yesterday';
  if (now.diff(then, 'day') < 7) return then.format('ddd');
  if (now.isSame(then, 'year')) return then.format('MMM D');
  return then.format('MMM D, YY');
}

/**
 * Hoisted + memoized to avoid re-rendering every row when typing state, the
 * search query, or any conversation's last_message changes for an unrelated
 * row. Without this, a single incoming message would re-render the entire
 * inbox.
 */
const ConversationRow = memo(function ConversationRow({
  item,
  isTyping,
  onPress,
  onLongPress,
}: {
  item: Conversation;
  isTyping: boolean;
  onPress: (item: Conversation) => void;
  onLongPress: (item: Conversation) => void;
}) {
  const other = item.other_user;
  const hasUnread = (item.unread_count ?? 0) > 0;
  const timeLabel = item.last_message_at ? formatConversationTime(item.last_message_at) : '';
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={500}
      style={[s.row, hasUnread && s.rowUnread]}
      activeOpacity={0.65}
    >
      <Avatar
        uri={other?.avatar_url}
        name={other?.full_name ?? '?'}
        size={52}
        onlineStatus={
          isUserEffectivelyOnline(other?.online_status, other?.last_seen)
            ? 'online'
            : 'offline'
        }
        showStatus
      />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={s.cardTop}>
          <Text style={[s.cardName, hasUnread && s.cardNameUnread]} numberOfLines={1}>
            {other?.full_name ?? 'Unknown'}
          </Text>
          {timeLabel ? (
            <Text style={[s.cardTime, hasUnread && s.cardTimeUnread]}>{timeLabel}</Text>
          ) : null}
        </View>
        <View style={s.cardBottom}>
          {isTyping ? (
            <Text style={s.cardTyping} numberOfLines={1}>
              Typing…
            </Text>
          ) : (
            <Text
              style={[s.cardPreview, hasUnread && s.cardPreviewUnread]}
              numberOfLines={1}
            >
              {item.last_message ?? 'Start a conversation'}
            </Text>
          )}
          {hasUnread ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>
                {(item.unread_count ?? 0) > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuthStore();
  const { conversations, isLoading, fetchConversations, deleteConversation } = useChatStore();
  const { showDialog, showToast } = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Live typing indicator: subscribe to each visible conversation's
  // dedicated `chat-typing:${convId}` broadcast channel. We deliberately do
  // NOT subscribe to `chat-live:${convId}` here because that topic carries
  // postgres_changes for the chat screen — supabase-js dedupes channels by
  // topic and would refuse to add postgres_changes callbacks if the inbox
  // subscribed first. Cap to MAX_TYPING_SUBSCRIPTIONS for bounded fan-out.
  const [typingMap, setTypingMap] = useState<Record<string, true>>({});
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  /** Stable signature of the visible conversation IDs — only changes when a
   *  conversation is added, removed, or reordered, NOT when last_message updates.
   *  Prevents resubscribing the typing channels on every incoming message. */
  const subscribedConvIds = useMemo(() => {
    return conversations.slice(0, MAX_TYPING_SUBSCRIPTIONS).map((c) => c.id);
  }, [conversations]);
  const subscribedConvIdsKey = useMemo(() => subscribedConvIds.join(','), [subscribedConvIds]);

  useFocusEffect(
    useCallback(() => {
      if (!user || subscribedConvIds.length === 0) return;

      // Use the shared, ref-counted typing-channel helper so that opening a
      // chat (which also subscribes to the SAME `chat-typing:${convId}`
      // topic) doesn't get its underlying channel torn down when this tab's
      // useFocusEffect cleanup fires. Previous implementation called
      // `supabase.removeChannel(...)` directly, which killed the shared
      // object — exactly why "typing" stopped showing up after navigating
      // from inbox into a chat.
      const releases = subscribedConvIds.map((convId) =>
        acquireTypingChannel(convId, ({ userId }) => {
          if (!userId || userId === user.id) return;
          setTypingMap((prev) => (prev[convId] ? prev : { ...prev, [convId]: true }));
          const existing = typingTimersRef.current.get(convId);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            setTypingMap((prev) => {
              if (!prev[convId]) return prev;
              const { [convId]: _omit, ...rest } = prev;
              return rest;
            });
            typingTimersRef.current.delete(convId);
          }, TYPING_TTL_MS);
          typingTimersRef.current.set(convId, t);
        }).release,
      );

      return () => {
        typingTimersRef.current.forEach((t) => clearTimeout(t));
        typingTimersRef.current.clear();
        for (const release of releases) release();
        setTypingMap({});
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, subscribedConvIdsKey]),
  );

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await fetchConversations(user.id);
    } catch {
      showToast({ icon: 'alert-circle-outline', message: 'Could not refresh. Please try again.' });
    } finally {
      setRefreshing(false);
    }
  }, [user, fetchConversations, showToast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const nameHit = c.other_user?.full_name?.toLowerCase().includes(q);
      const previewHit = c.last_message?.toLowerCase().includes(q);
      return nameHit || previewHit;
    });
  }, [conversations, search]);

  const handleRowPress = useCallback((item: Conversation) => {
    const other = item.other_user;
    router.push({
      pathname: '/(chat)/[id]',
      params: {
        id: item.id,
        ...(other?.id ? { otherUserId: other.id } : {}),
      },
    });
  }, []);

  const handleRowLongPress = useCallback(
    (item: Conversation) => {
      haptics.tapMedium();
      const otherName = item.other_user?.full_name ?? 'this user';
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
    },
    [showDialog, showToast, deleteConversation],
  );

  const ListHeader = useMemo(
    () => (
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={15} color={COLORS.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or message…"
          placeholderTextColor={COLORS.textMuted}
          style={s.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [search],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={s.header}>
        <ScreenTitle>Messages</ScreenTitle>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16, backgroundColor: COLORS.white }}
        style={{ backgroundColor: COLORS.white }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={conversations.length > 0 ? ListHeader : null}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={ItemSeparator}
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
                  ? 'Try a different name or word.'
                  : 'Browse Discover to find someone interesting and start a conversation.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            isTyping={!!typingMap[item.id]}
            onPress={handleRowPress}
            onLongPress={handleRowLongPress}
          />
        )}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (item: Conversation) => item.id;
const getItemLayout = (_: ArrayLike<Conversation> | null | undefined, index: number) => ({
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
  index,
});
const ItemSeparator = () => <View style={s.sep} />;

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
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  rowUnread: {
    backgroundColor: COLORS.primarySurface,
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
  cardTimeUnread:  { color: COLORS.primary, fontWeight: FONT.bold },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  cardPreview:        { fontSize: FONT.sm, color: COLORS.textSecondary, flex: 1 },
  cardPreviewUnread:  { color: COLORS.text, fontWeight: FONT.medium },
  cardTyping: {
    fontSize: FONT.sm,
    color: COLORS.primary,
    fontWeight: FONT.semibold,
    fontStyle: 'italic',
    flex: 1,
  },

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

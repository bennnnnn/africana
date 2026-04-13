import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import type { KeyboardEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Animated, Keyboard, Platform,
  StyleSheet, Dimensions, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import {
  useChatStore,
  ERROR_RECIPIENT_MESSAGES_DISABLED,
  ERROR_SENDER_MESSAGES_DISABLED,
} from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { User, Message } from '@/types';
import { COLORS, RADIUS, FONT, SHADOWS, DEFAULT_AVATAR } from '@/constants';
import { getHiddenMessageIds, persistHiddenMessageIds } from '@/lib/hidden-messages';
import { MOCK_USERS } from '@/lib/mock-data';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

type ChatListItem =
  | { type: 'message'; message: Message }
  | { type: 'date'; id: string; label: string };

function getChatDayKey(createdAt: string): string {
  return dayjs(createdAt).format('YYYY-MM-DD');
}

function formatChatDateLabel(createdAt: string): string {
  const d = dayjs(createdAt);
  if (d.isToday()) return 'Today';
  if (d.isYesterday()) return 'Yesterday';
  return d.format('ddd, MMM D');
}

/** Survives screen remounts (Strict Mode, navigation glitches) so the header never loses peer data mid-session. */
const peerSnapshotByConversationId = new Map<string, User>();
/** Last chat route identity — module scope so remount does not look like a “new” chat and wipe state. */
let lastChatRouteKey: string | null = null;

const { width } = Dimensions.get('window');
/** Stable empty array so memoized rows are not invalidated every parent render. */
const NO_REACTIONS: string[] = [];
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function normalizeRouteParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].length > 0) return v[0];
  return undefined;
}

export default function ChatScreen() {
  const { id: rawConversationId, otherUserId: otherUserIdRaw } = useLocalSearchParams<{
    id: string | string[];
    otherUserId?: string | string[];
  }>();
  const conversationId = normalizeRouteParam(rawConversationId);
  const otherUserIdParam = normalizeRouteParam(otherUserIdRaw);
  /**
   * Expo Router often drops `otherUserId` from params after the first paint (e.g. when the keyboard opens).
   * If we re-run chat init when that happens, `setOtherUser(null)` clears the header. Persist hints per conversation.
   */
  const peerIdHintByConversationRef = useRef<Map<string, string>>(new Map());
  if (conversationId && otherUserIdParam) {
    peerIdHintByConversationRef.current.set(conversationId, otherUserIdParam);
  }
  const { user, settings } = useAuthStore();
  const outgoingMessagingDisabled = settings?.receive_messages === false;
  const { messages, fetchMessages, sendMessage, deleteMessage, markMessagesRead, addMessage } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();
  const { showDialog, showToast } = useDialog();

  const [otherUser, setOtherUser]         = useState<User | null>(null);
  /** Keeps avatar/name visible if otherUser is briefly null (nav/keyboard glitches). Cleared only when switching chats. */
  const [headerFallbackPeer, setHeaderFallbackPeer] = useState<User | null>(null);
  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [menuVisible, setMenuVisible]     = useState(false);
  const [isFavourite, setIsFavourite]     = useState(false);
  const menuAnim  = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const pendingScrollModeRef = useRef<'none' | 'instant' | 'smooth'>('instant');
  const prevMessageCountRef = useRef(0);
  const prevLatestMessageKeyRef = useRef<string | undefined>(undefined);
  const [inputFocused, setInputFocused] = useState(false);
  // Unified overlay — one at a time; isOwn=true → own message (trash only), isOwn=false → other's (emojis + trash)
  const [msgSheet, setMsgSheet] = useState<{ messageId: string; isOwn: boolean } | null>(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  // Local reactions map: messageId → emoji[]
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  // Locally hidden messages (deleted for me only)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const insets = useSafeAreaInsets();
  const [chatHeaderHeight, setChatHeaderHeight] = useState(0);
  /** Lifts list + composer above the keyboard (KAV alone was not enough on iOS here). */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (otherUser) setHeaderFallbackPeer(otherUser);
  }, [otherUser]);

  useEffect(() => {
    if (conversationId && otherUser) peerSnapshotByConversationId.set(conversationId, otherUser);
  }, [conversationId, otherUser]);

  const peer = otherUser ?? headerFallbackPeer;
  const convMessages = messages[conversationId ?? ''] ?? [];
  const visibleMessages = useMemo(
    () => convMessages.filter((m) => !hiddenIds.has(m.id)),
    [convMessages, hiddenIds],
  );
  const listData = visibleMessages;
  const listItems = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];
    let lastDayKey: string | null = null;
    for (const message of listData) {
      const dayKey = getChatDayKey(message.created_at);
      if (dayKey !== lastDayKey) {
        items.push({
          type: 'date',
          id: `date-${dayKey}`,
          label: formatChatDateLabel(message.created_at),
        });
        lastDayKey = dayKey;
      }
      items.push({ type: 'message', message });
    }
    return items;
  }, [listData]);
  const latestMessageKey = visibleMessages.length > 0
    ? (visibleMessages[visibleMessages.length - 1].listKey ?? visibleMessages[visibleMessages.length - 1].id)
    : undefined;
  const isLiked = peer ? likedUserIds.has(peer.id) : false;
  const avatar = peer
    ? (peer.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent((peer.full_name ?? '?').charAt(0))}`)
    : null;

  const bodyTopInset = chatHeaderHeight > 0 ? chatHeaderHeight : insets.top + 54;

  const headerChromeStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      backgroundColor: COLORS.white,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      ...(Platform.OS === 'android'
        ? { elevation: 12 }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }),
    }),
    [insets.top],
  );

  useEffect(() => {
    prevMessageCountRef.current = 0;
    prevLatestMessageKeyRef.current = undefined;
    isNearBottomRef.current = true;
    pendingScrollModeRef.current = 'instant';
  }, [conversationId]);

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const nextCount = visibleMessages.length;
    const prevCount = prevMessageCountRef.current;
    const prevLatestKey = prevLatestMessageKeyRef.current;
    const changed = nextCount !== prevCount || latestMessageKey !== prevLatestKey;

    if (changed && nextCount > 0) {
      const pendingMode = pendingScrollModeRef.current;
      const shouldScroll = pendingMode !== 'none' || isNearBottomRef.current || prevCount === 0;
      if (shouldScroll) {
        const animated = pendingMode === 'smooth' || (pendingMode === 'none' && isNearBottomRef.current && prevCount > 0);
        scrollToBottom(animated);
      }
      pendingScrollModeRef.current = 'none';
    }

    prevMessageCountRef.current = nextCount;
    prevLatestMessageKeyRef.current = latestMessageKey;
  }, [latestMessageKey, scrollToBottom, visibleMessages.length]);

  useEffect(() => {
    if (keyboardHeight > 0 && isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [keyboardHeight, scrollToBottom]);

  const handleListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isNearBottomRef.current = distanceFromBottom < 80;
  }, []);

  useEffect(() => {
    const overlap = (e: KeyboardEvent) => {
      const winH = Dimensions.get('window').height;
      const { screenY, height } = e.endCoordinates;
      let inset = Math.max(0, winH - screenY);
      if (Platform.OS === 'android' && height > 0 && screenY <= 0) {
        inset = height;
      }
      setKeyboardHeight(inset);
    };
    const clear = () => setKeyboardHeight(0);

    if (Platform.OS === 'ios') {
      const sub = Keyboard.addListener('keyboardWillChangeFrame', overlap);
      return () => sub.remove();
    }

    const show = Keyboard.addListener('keyboardDidShow', overlap);
    const hide = Keyboard.addListener('keyboardDidHide', clear);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ── Sync header seed: store + snapshot, survives remount; clear only on real route change.
  useLayoutEffect(() => {
    if (!user) {
      lastChatRouteKey = null;
      return;
    }
    if (!conversationId) return;
    const routeKey = `${conversationId}:${user.id}`;
    const switched = lastChatRouteKey !== routeKey;
    if (switched) lastChatRouteKey = routeKey;

    const storePeer = useChatStore
      .getState()
      .conversations.find((c) => c.id === conversationId)?.other_user;
    const snap = peerSnapshotByConversationId.get(conversationId);
    const seed = storePeer ?? snap ?? null;

    if (switched) {
      setMessagingDisabled(false);
      if (seed) {
        setOtherUser(seed);
        setHeaderFallbackPeer(seed);
      } else {
        setOtherUser(null);
        setHeaderFallbackPeer(null);
      }
      setLoading(true);
    } else if (seed) {
      setOtherUser((p) => p ?? seed);
      setHeaderFallbackPeer((p) => p ?? seed);
    }
  }, [conversationId, user?.id]);

  // ── Fetch like state ─────────────────────────────────────────────────────────
  useEffect(() => { if (user) fetchLikedUserIds(user.id); }, [user?.id]);

  // ── Favourite status ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !peer) return;
    supabase.from('favourites').select('id')
      .eq('user_id', user.id).eq('favourited_id', peer.id).maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user?.id, peer?.id]);

  // ── Chat init — load / refresh peer + messages (layout effect already seeded header when possible).
  useEffect(() => {
    if (!conversationId || !user) return;

    const isMock = conversationId.startsWith('mock-conv-');

    const init = async () => {
      if (isMock) {
        const mockUserId = conversationId.replace('mock-conv-', '');
        const mockUser = MOCK_USERS.find((u) => u.id === mockUserId);
        if (mockUser) setOtherUser(mockUser);
        await fetchMessages(conversationId);
        setLoading(false);
        return;
      }

      const seeded = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      if (seeded?.other_user) {
        setOtherUser(seeded.other_user);
        setLoading(false);
        const otherId = seeded.other_user.id;
        await Promise.all([
          fetchMessages(conversationId),
          markMessagesRead(conversationId, user.id),
        ]);
        const { data: privacy } = await supabase
          .from('profiles')
          .select('accepts_messages, online_visible, online_status')
          .eq('id', otherId)
          .maybeSingle();
        if (privacy?.accepts_messages === false) setMessagingDisabled(true);
        if (privacy && seeded.other_user) {
          const effectiveOnline =
            privacy.online_visible === false ? 'offline' : (seeded.other_user.online_status ?? privacy.online_status ?? 'offline');
          setOtherUser({ ...seeded.other_user, online_status: effectiveOnline });
        }
        return;
      }

      // Opening a new thread from profile/photo modal: conversation row may not be in the store
      // yet and RLS/timing can make select on conversations unreliable — we pass the peer id in the URL.
      const peerFromRoute = conversationId
        ? peerIdHintByConversationRef.current.get(conversationId)
        : undefined;
      if (peerFromRoute && peerFromRoute !== user.id) {
        const { data: raw } = await supabase.from('profiles').select('*').eq('id', peerFromRoute).maybeSingle();
        if (raw) {
          const effectiveOnline =
            raw.online_visible === false ? 'offline' : (raw.online_status ?? 'offline');
          setOtherUser({ ...raw, online_status: effectiveOnline });
          if (raw.accepts_messages === false) setMessagingDisabled(true);
          setLoading(false);
          await Promise.all([
            fetchMessages(conversationId),
            markMessagesRead(conversationId, user.id),
          ]);
          return;
        }
      }

      const [convResult] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle(),
        fetchMessages(conversationId),
        markMessagesRead(conversationId, user.id),
      ]);

      if (convResult.data) {
        const otherId = convResult.data.participant_ids.find((id: string) => id !== user.id);
        if (otherId) {
          const { data: raw } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle();
          if (raw) {
            const effectiveOnline =
              raw.online_visible === false ? 'offline' : (raw.online_status ?? 'offline');
            setOtherUser({ ...raw, online_status: effectiveOnline });
            if (raw.accepts_messages === false) setMessagingDisabled(true);
          }
        }
      }
      setLoading(false);
    };

    void init();
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!conversationId || !user) return;
    let cancelled = false;
    getHiddenMessageIds(user.id, conversationId).then((storedIds) => {
      if (!cancelled) setHiddenIds(storedIds);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.id]);

  // ── Realtime subscription — separate effect so store updates don't rebuild it ─
  useEffect(() => {
    if (!conversationId || !user || conversationId.startsWith('mock-conv-')) return;

    const channel = supabase
      .channel(`messages:${conversationId}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.sender_id !== user.id) {
          addMessage(conversationId, newMsg);
          markMessagesRead(conversationId, user.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !user || conversationId.startsWith('mock-conv-')) return;
      void fetchMessages(conversationId);
    }, [conversationId, fetchMessages, user?.id]),
  );

  // Inverted FlatList handles scroll position automatically — no manual scrollToEnd needed

  // ── Menus ────────────────────────────────────────────────────────────────────
  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };
  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setMenuVisible(false));
  };
  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !user || !conversationId) return;
    if (outgoingMessagingDisabled || messagingDisabled) return;
    const content = text.trim();
    const cid = conversationId;
    setText('');
    pendingScrollModeRef.current = 'smooth';
    const { error } = await sendMessage(cid, user.id, content, user.full_name);
    if (error) {
      setText(content);
      let toastMessage: string;
      if (error === ERROR_RECIPIENT_MESSAGES_DISABLED || error === ERROR_SENDER_MESSAGES_DISABLED) {
        toastMessage = error;
      } else if (/sender does not accept/i.test(error)) {
        toastMessage = ERROR_SENDER_MESSAGES_DISABLED;
      } else if (/recipient does not accept/i.test(error)) {
        toastMessage = ERROR_RECIPIENT_MESSAGES_DISABLED;
      } else {
        toastMessage = 'Message failed to send. Please try again.';
      }
      showToast({ message: toastMessage });
      console.error('[Chat] send error:', error);
    }
  };

  const openMsgSheet = useCallback((messageId: string, isOwn: boolean) => {
    setMsgSheet({ messageId, isOwn });
    reactionAnim.setValue(0);
    Animated.spring(reactionAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, [reactionAnim]);

  const closeMsgSheet = () => {
    Animated.timing(reactionAnim, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => setMsgSheet(null));
  };

  const handleReact = (messageId: string, emoji: string) => {
    setReactions((prev) => {
      const current = prev[messageId] ?? [];
      const exists = current.includes(emoji);
      return { ...prev, [messageId]: exists ? current.filter((e) => e !== emoji) : [...current, emoji] };
    });
    closeMsgSheet();
  };

  const handleTrashPress = (messageId: string, isOwn: boolean) => {
    closeMsgSheet();
    showDialog({
      title: 'Delete message',
      message: isOwn
        ? 'This will permanently delete the message for everyone.'
        : 'This will remove the message from your view.',
      actions: [
        { label: 'Cancel' },
        { label: 'Delete', style: 'destructive', onPress: () => {
          const cid = conversationId;
          if (!cid) return;
          if (isOwn) deleteMessage(cid, messageId);
          else {
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.add(messageId);
              if (user) void persistHiddenMessageIds(user.id, cid, next);
              return next;
            });
          }
          showToast({ message: 'Deleted' });
        }},
      ],
    });
  };

  const handleLike = async () => {
    closeMenu();
    if (!user || !peer) return;
    const wasLiked = likedUserIds.has(peer.id);
    toggleLike(user.id, peer.id);
    showToast({ message: wasLiked ? 'Unliked' : 'Liked' });
  };

  const handleFavourite = async () => {
    closeMenu();
    if (!user || !peer) return;
    if (isFavourite) {
      await supabase.from('favourites').delete().eq('user_id', user.id).eq('favourited_id', peer.id);
      setIsFavourite(false);
      showToast({ message: 'Removed from favourites' });
    } else {
      await supabase.from('favourites').insert({ user_id: user.id, favourited_id: peer.id });
      setIsFavourite(true);
      showToast({ message: 'Added to favourites' });
    }
  };

  const handleReport = () => {
    closeMenu();
    if (!user || !peer) return;
    showDialog({
      title: `Report ${peer.full_name}`,
      message: 'Select a reason. Our team will review it.',
      actions: REPORT_REASONS.map((reason) => ({
        label: reason,
        onPress: async () => {
          await supabase.from('reports').insert({ reporter_id: user.id, reported_id: peer.id, reason });
          showToast({ message: 'Report submitted' });
        },
      })),
    });
  };

  const composerBottomPad = keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10);
  const disabledBarBottomPad = keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16);

  const handleBlock = () => {
    closeMenu();
    if (!user || !peer) return;
    showDialog({
      title: `Block ${peer.full_name}?`,
      message: "They won't be able to see your profile or send you messages.",
      actions: [
        { label: 'Cancel' },
        { label: 'Block', style: 'destructive', onPress: async () => {
          await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: peer.id });
          router.back();
        }},
      ],
    });
  };

  const conversationPane = (
    <>
      {!loading && visibleMessages.length === 0 && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 60, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            No messages yet.{'\n'}Say hello! 👋
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        style={{ flex: 1, minHeight: 0 }}
        data={listItems}
        keyExtractor={(item) => item.type === 'message' ? (item.message.listKey ?? item.message.id) : item.id}
        extraData={reactions}
        removeClippedSubviews={false}
        initialNumToRender={20}
        maxToRenderPerBatch={12}
        windowSize={12}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={{ padding: 12, paddingTop: 8, flexGrow: 1, justifyContent: 'flex-end' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={null}
        renderItem={({ item }) => item.type === 'date' ? (
          <View style={{ alignItems: 'center', marginVertical: 6 }}>
            <Text style={s.datePill}>{item.label}</Text>
          </View>
        ) : (
          <ChatMessageRow
            item={item.message}
            userId={user?.id}
            msgReactions={reactions[item.message.id] ?? NO_REACTIONS}
            onLongPress={openMsgSheet}
          />
        )}
      />

      {outgoingMessagingDisabled ? (
        <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}>
            Your messages are turned off. Open Settings → Privacy and turn on Receive messages to send.
          </Text>
        </View>
      ) : messagingDisabled ? (
        <View style={[s.disabledBar, { paddingBottom: disabledBarBottomPad }]}>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}>
            This person has turned off receiving messages in their settings.
          </Text>
        </View>
      ) : (
        <View style={[s.inputRow, { paddingBottom: composerBottomPad }]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={1000}
            style={[s.input, inputFocused && s.inputFocused]}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={[s.sendBtn, { backgroundColor: text.trim() ? COLORS.primary : COLORS.border }]}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF6EE' }}>
      {/*
        Header stays absolute. Bottom inset = overlap between window bottom and keyboard top
        (works with iOS animations; on Android with adjustResize, winH often already shrinks so
        overlap ≈ 0 and we do not double-pad).
      */}
      <View
        style={{
          flex: 1,
          marginTop: bodyTopInset,
          paddingBottom: keyboardHeight,
        }}
      >
        <View style={{ flex: 1 }}>{conversationPane}</View>
      </View>

      <View
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setChatHeaderHeight(Math.round(h));
        }}
        style={headerChromeStyle}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textStrong} />
          </TouchableOpacity>

          {peer ? (
            <TouchableOpacity
              onPress={() => router.push(`/(profile)/${peer.id}`)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {avatar ? (
                <View>
                  <Image
                    key={peer.id}
                    source={{ uri: avatar }}
                    style={s.headerAvatar}
                    contentFit="cover"
                  />
                  <View style={[s.onlineDot, { backgroundColor: peer.online_status === 'online' ? COLORS.online : COLORS.border }]} />
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.headerName} numberOfLines={1}>{peer.full_name}</Text>
                <Text style={[s.headerStatus, { color: peer.online_status === 'online' ? COLORS.online : COLORS.textMuted }]}>
                  {peer.online_status === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {peer ? (
            <TouchableOpacity onPress={openMenu} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textStrong} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Dropdown menu — absolute, no Modal so keyboard stays open ── */}
      {menuVisible && (
        <>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeMenu} />
          <Animated.View style={[s.dropdown, { top: bodyTopInset + 6 }, {
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          }]}>
            <TouchableOpacity style={s.menuItem} onPress={handleLike}>
              <View style={s.menuIcon}><Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={17} color={COLORS.textStrong} /></View>
              <Text style={s.menuLabel}>{isLiked ? 'Unlike' : 'Like'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={handleFavourite}>
              <View style={s.menuIcon}><Ionicons name={isFavourite ? 'star' : 'star-outline'} size={17} color={COLORS.textStrong} /></View>
              <Text style={s.menuLabel}>{isFavourite ? 'Unfavourite' : 'Favourite'}</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 }} />
            <TouchableOpacity style={s.menuItem} onPress={handleReport}>
              <View style={s.menuIcon}><Ionicons name="flag-outline" size={17} color={COLORS.textStrong} /></View>
              <Text style={s.menuLabel}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={handleBlock}>
              <View style={s.menuIcon}><Ionicons name="ban-outline" size={17} color={COLORS.error} /></View>
              <Text style={[s.menuLabel, { color: COLORS.error }]}>Block</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* ── Unified message overlay — no Modal so keyboard stays open ── */}
      {msgSheet && (
        <>
          {/* Backdrop */}
          <TouchableOpacity style={s.ctxBackdrop} activeOpacity={1} onPress={closeMsgSheet} />

          {/* Emoji reactions card — only for other user's messages */}
          {!msgSheet.isOwn && (
            <Animated.View style={[s.reactionCard, {
              opacity: reactionAnim,
              transform: [{ scale: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
            }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 16 }}>
                {REACTIONS.map((emoji) => {
                  const active = (reactions[msgSheet.messageId] ?? []).includes(emoji);
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => handleReact(msgSheet.messageId, emoji)}
                      style={[s.reactionBtn, active && s.reactionBtnActive]}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Floating trash icon — same for both own and other's messages */}
          <Animated.View style={[s.deleteFloat, {
            opacity: reactionAnim,
            transform: [{ scale: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
          }]}>
            <TouchableOpacity
              onPress={() => handleTrashPress(msgSheet.messageId, msgSheet.isOwn)}
              style={s.deleteFloatBtn}
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.textStrong} />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: COLORS.white },
  headerName: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.textStrong },
  headerStatus: { fontSize: FONT.xs, fontWeight: FONT.medium, marginTop: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 },
  dropdown: { position: 'absolute', right: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, paddingVertical: 6, minWidth: 180, ...SHADOWS.md, borderWidth: 1, borderColor: COLORS.border, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  menuIcon: { width: 32, height: 32, borderRadius: RADIUS.md, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.textStrong },
  datePill: { fontSize: FONT.xs, color: COLORS.textSecondary, backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  bubbleOwn: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FONT.md, lineHeight: 21 },
  timestamp: { fontSize: 10, color: COLORS.textMuted },
  disabledBar: { padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10, fontSize: FONT.md, color: COLORS.textStrong, borderWidth: 1.5, borderColor: COLORS.border },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  // Reaction bubble under message
  reactionBubble: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  // Reaction sheet
  ctxBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.overlayLight, zIndex: 998 },
  reactionBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  reactionBtnActive: { backgroundColor: `${COLORS.primary}18`, borderWidth: 1.5, borderColor: COLORS.primary },
  reactionCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '22%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    zIndex: 999,
    ...SHADOWS.lg,
  },
  deleteFloat: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    top: '40%',
    alignItems: 'center',
    zIndex: 999,
  },
  deleteFloatBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
});

const ChatMessageRow = memo(function ChatMessageRow({
  item,
  userId,
  msgReactions,
  onLongPress,
}: {
  item: Message;
  userId: string | undefined;
  msgReactions: string[];
  onLongPress: (messageId: string, isOwn: boolean) => void;
}) {
  const isOwn = item.sender_id === userId;
  const isTemp = item.id.startsWith('temp-');

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
        <Pressable
          onLongPress={() => onLongPress(item.id, isOwn)}
          delayLongPress={350}
          android_ripple={null}
          style={{ opacity: 1 }}
        >
          <View style={{ maxWidth: width * 0.72 }}>
            <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
              <Text style={[s.bubbleText, { color: isOwn ? COLORS.white : COLORS.textStrong }]}>{item.content}</Text>
            </View>
            {msgReactions.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 3,
                  marginTop: -10,
                  marginBottom: 4,
                  paddingHorizontal: 6,
                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                {msgReactions.map((emoji, i) => (
                  <View key={i} style={s.reactionBubble}>
                    <Text style={{ fontSize: 13 }}>{emoji}</Text>
                  </View>
                ))}
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 3,
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                paddingHorizontal: 4,
              }}
            >
              <Text style={s.timestamp}>{dayjs(item.created_at).format('h:mm A')}</Text>
              {isOwn && (
                <Text style={{ fontSize: 10, color: item.read_at ? COLORS.success : COLORS.textMuted }}>
                  {item.read_at ? '✓✓' : isTemp ? '○' : '✓'}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
});

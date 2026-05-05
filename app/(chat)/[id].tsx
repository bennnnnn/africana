import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { View, Text, FlatList, TextInput, Animated, Platform, StyleSheet } from 'react-native';
// Universal keyboard handling. `KeyboardAvoidingView` from
// react-native-keyboard-controller reads keyboard insets from native
// platform APIs (WindowInsetsCompat on Android, native observer on iOS),
// so it works identically on Samsung, MIUI, ColorOS, and iOS — no manual
// per-OEM math needed.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import {
  useChatStore,
  getChatStoreState,
  ERROR_RECIPIENT_MESSAGES_DISABLED,
  ERROR_SENDER_MESSAGES_DISABLED,
  ERROR_MESSAGING_BLOCKED,
} from '@/store/chat.store';
import { hasSymmetricBlockBetween } from '@/lib/block-queries';
import { useDiscoverStore } from '@/store/discover.store';
import { useDialog } from '@/components/ui/DialogProvider';
import { ReportUserModal } from '@/components/ui/ReportUserModal';
import { ChatMessageRow } from '@/components/chat/ChatMessageRow';
import { chatScreenStyles as s } from '@/components/chat/chat-screen-styles';
import { DeleteForEveryoneConfirmContent } from '@/components/chat/DeleteForEveryoneConfirmContent';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatComposerArea, type ChatComposerVariant } from '@/components/chat/ChatComposerArea';
import { ChatPeerOverflowMenu } from '@/components/chat/ChatPeerOverflowMenu';
import { ChatReactionPickerOverlay } from '@/components/chat/ChatReactionPickerOverlay';
import { ChatScreenHeaderChrome } from '@/components/chat/ChatScreenHeaderChrome';
import { addFavourite, hasExistingReport } from '@/lib/social-actions';
import { User, Message } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { EMPTY_REACTION_LIST, type ReactionEmoji, type ReactionsMap } from '@/constants/chat-reactions';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import { UI_LABELS, UI_TOAST } from '@/constants/copy';
import { isUserEffectivelyOnline } from '@/lib/utils';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useChatVisibilitySync } from '@/hooks/use-chat-visibility-sync';
import { SPRING, SNAP_OUT } from '@/lib/motion';
import haptics from '@/lib/haptics';
import * as Clipboard from 'expo-clipboard';
import { normalizeRouteParam } from '@/lib/chat-route-utils';
import { peerSnapshotByConversationId, getLastChatRouteKey, setLastChatRouteKey } from '@/lib/chat-peer-session';
import { buildChatListItems, type ChatListItem } from '@/lib/chat-list-build';

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
  const { user, settings } = useAuthStore(
    useShallow((s) => ({ user: s.user, settings: s.settings })),
  );
  const outgoingMessagingDisabled = settings?.receive_messages === false;
  const { messages, conversations, fetchMessages, sendMessage, deleteMessage, softDeleteMessageForSelf, markMessagesRead, addMessage, applyMessageUpdate, removeMessage } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      conversations: s.conversations,
      fetchMessages: s.fetchMessages,
      sendMessage: s.sendMessage,
      deleteMessage: s.deleteMessage,
      softDeleteMessageForSelf: s.softDeleteMessageForSelf,
      markMessagesRead: s.markMessagesRead,
      addMessage: s.addMessage,
      applyMessageUpdate: s.applyMessageUpdate,
      removeMessage: s.removeMessage,
    })),
  );
  // `conversationId` is `string | undefined` until the route param resolves;
  // guard the lookups so we don't index a dictionary with `undefined`.
  const hasMoreOlder = useChatStore((s) => (conversationId ? !!s.hasMoreMessages[conversationId] : false));
  const isLoadingOlder = useChatStore((s) => (conversationId ? !!s.loadingOlderMessages[conversationId] : false));
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore(
    useShallow((s) => ({
      likedUserIds: s.likedUserIds,
      toggleLike: s.toggleLike,
      fetchLikedUserIds: s.fetchLikedUserIds,
    })),
  );
  const { showDialog, showToast } = useDialog();

  const [otherUser, setOtherUser]         = useState<User | null>(null);
  /** Keeps avatar/name visible if otherUser is briefly null (nav/keyboard glitches). Cleared only when switching chats. */
  const [headerFallbackPeer, setHeaderFallbackPeer] = useState<User | null>(null);
  /**
   * Typing indicator state:
   *  - `peerTyping`      → peer keystrokes seen recently; header switches to "Typing…".
   *  - `typingChannelRef`→ DEDICATED typing channel so the inbox can subscribe to
   *                         typing events without colliding with the postgres_changes
   *                         listener on `chat-live:${convId}` (the supabase JS client
   *                         dedupes channels by topic and refuses to add
   *                         postgres_changes callbacks after the topic is already
   *                         subscribed elsewhere).
   *  - `peerTypingTimerRef` clears the indicator after 3s of silence.
   *  - `lastTypingSentRef` throttles outgoing broadcasts to once every 2.5s.
   */
  const [peerTyping, setPeerTyping]       = useState(false);
  const typingChannelRef                  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerTypingTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef                 = useRef(0);
  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  /** True when a `blocks` row exists in either direction (composer disabled). */
  const [blockRelationshipActive, setBlockRelationshipActive] = useState(false);
  const [menuVisible, setMenuVisible]     = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isFavourite, setIsFavourite]     = useState(false);
  const menuAnim  = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<ChatListItem>>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const pendingScrollModeRef = useRef<'none' | 'instant' | 'smooth'>('instant');
  const prevMessageCountRef = useRef(0);
  const prevLatestMessageKeyRef = useRef<string | undefined>(undefined);
  const [inputFocused, setInputFocused] = useState(false);
  // Unified overlay — one at a time. Own messages get Copy + Delete in the
  // header; other users' messages get emoji reactions (no delete).
  const [selectedMessages, setSelectedMessages] = useState<Map<string, { isOwn: boolean; content: string }>>(new Map());
  const reactionAnim = useRef(new Animated.Value(0)).current;
  // Reactions are persisted in `message_reactions` and synced via realtime.
  // Shape: messageId → { userId → emoji }. PK in DB is (message_id, user_id),
  // so each user can only have ONE active reaction per message (iMessage style).
  const [reactions, setReactions] = useState<ReactionsMap>({});
  /**
   * Set of message ids currently rendered in this conversation. Used by the
   * realtime `message_reactions` listener as a cheap O(1) discriminator —
   * we receive reactions for every conversation we participate in (RLS),
   * and discard any whose message we don't know about locally.
   */
  const messagesIdSetRef = useRef<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const [chatHeaderHeight, setChatHeaderHeight] = useState(0);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (otherUser) setHeaderFallbackPeer(otherUser);
  }, [otherUser]);

  useEffect(() => {
    if (conversationId && otherUser) peerSnapshotByConversationId.set(conversationId, otherUser);
  }, [conversationId, otherUser]);

  const peer = otherUser ?? headerFallbackPeer;
  const convMessages = messages[conversationId ?? ''] ?? [];
  const visibleMessages = convMessages;

  // Keep the id set in sync with the rendered message list so the realtime
  // reactions handler can quickly tell whether an inbound row is for us.
  // Only "real" (non-temp) ids matter — reactions never target an optimistic
  // temp message.
  useEffect(() => {
    const next = new Set<string>();
    for (const m of convMessages) {
      if (!m.id.startsWith('temp-')) next.add(m.id);
    }
    messagesIdSetRef.current = next;
  }, [convMessages]);

  /**
   * Derived `messageId → emoji[]` map fed to ChatMessageRow. We dedupe so
   * "two people both reacted ❤️" shows a single ❤️ pill (matches iMessage),
   * but distinct emojis stack so you can see "peer 😂, you ❤️".
   */
  const reactionEmojiArrays = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const [msgId, byUser] of Object.entries(reactions)) {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const emoji of Object.values(byUser)) {
        if (seen.has(emoji)) continue;
        seen.add(emoji);
        list.push(emoji);
      }
      if (list.length > 0) out[msgId] = list;
    }
    return out;
  }, [reactions]);
  /**
   * If the conversation list says there's a `last_message`, we know messages
   * exist — don't flash "No messages yet" while the cache/network is still
   * loading them in. Keeps the screen calm during the brief seed window.
   * Uses reactive `conversations` from the store (not a non-reactive snapshot)
   * so it updates as soon as the conversation list loads.
   */
  const conversationHasMessages = useMemo(() => {
    if (!conversationId) return false;
    const conv = conversations.find((c) => c.id === conversationId);
    return !!(conv?.last_message || conv?.last_message_at);
  }, [conversationId, conversations]);

  /** Stable object so FlatList doesn't see a new extraData reference every render. */
  const flatListExtraData = useMemo(
    () => ({ reactionEmojiArrays, selectedMessages }),
    [reactionEmojiArrays, selectedMessages],
  );

  const listData = visibleMessages;
  const listItems = useMemo<ChatListItem[]>(() => buildChatListItems(listData), [listData]);

  // Inverted FlatList expects newest-first data. Reversing here means index 0 =
  // latest message, which the list renders at the bottom with no initial scroll needed.
  const invertedListItems = useMemo(() => [...listItems].reverse(), [listItems]);
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
      zIndex: 1000,
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
    setReportModalVisible(false);
    setPeerTyping(false);
    lastTypingSentRef.current = 0;
  }, [conversationId]);


  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated });
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
    // With inverted FlatList: offset 0 = newest messages (visual bottom).
    // Scrolling toward older messages increases contentOffset.y.
    isNearBottomRef.current = contentOffset.y < 80;
    // Load older messages when the user scrolls near the visual top
    // (= far end of the inverted list = high contentOffset.y).
    const distanceFromTop = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (
      conversationId &&
      hasMoreOlder &&
      !isLoadingOlder &&
      distanceFromTop < layoutMeasurement.height * 0.6
    ) {
      void loadOlderMessages(conversationId);
    }
  }, [conversationId, hasMoreOlder, isLoadingOlder, loadOlderMessages]);

  // ── Sync header seed: store + snapshot, survives remount; clear only on real route change.
  useLayoutEffect(() => {
    if (!user) {
      setLastChatRouteKey(null);
      return;
    }
    if (!conversationId) return;
    const routeKey = `${conversationId}:${user.id}`;
    const switched = getLastChatRouteKey() !== routeKey;
    if (switched) setLastChatRouteKey(routeKey);

    const storePeer = getChatStoreState().conversations.find((c) => c.id === conversationId)?.other_user;
    const snap = peerSnapshotByConversationId.get(conversationId);
    const seed = storePeer ?? snap ?? null;

    if (switched) {
      setMessagingDisabled(false);
      setBlockRelationshipActive(false);
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

    const init = async () => {
      const seeded = getChatStoreState().conversations.find((c) => c.id === conversationId);
      if (seeded?.other_user) {
        // accepts_messages / online_visible now live on profiles (mirrored from
        // user_settings via trigger), so the seeded peer already carries them.
        // We used to do an extra .select() here on every chat open — that was
        // a full network round-trip blocking the perceived "messages appearing".
        const peerSeed = seeded.other_user;
        const effectiveOnline =
          peerSeed.online_visible === false
            ? 'offline'
            : isUserEffectivelyOnline(peerSeed.online_status, peerSeed.last_seen)
              ? 'online'
              : 'offline';
        setOtherUser({ ...peerSeed, online_status: effectiveOnline });
        if (peerSeed.accepts_messages === false) setMessagingDisabled(true);
        if (await hasSymmetricBlockBetween(user.id, peerSeed.id)) {
          setBlockRelationshipActive(true);
        }
        setLoading(false);
        void markMessagesRead(conversationId, user.id);
        void fetchMessages(conversationId);
        return;
      }

      // Opening a new thread from profile/photo modal: conversation row may not be in the store
      // yet and RLS/timing can make select on conversations unreliable — we pass the peer id in the URL.
      const peerFromRoute = conversationId
        ? peerIdHintByConversationRef.current.get(conversationId)
        : undefined;
      if (peerFromRoute && peerFromRoute !== user.id) {
        void fetchMessages(conversationId);
        void markMessagesRead(conversationId, user.id);
        const { data: raw } = await supabase
          .from('profiles')
          .select(PROFILE_LIST_SELECT as '*')
          .eq('id', peerFromRoute)
          .maybeSingle();
        if (raw) {
          const effectiveOnline =
            raw.online_visible === false
              ? 'offline'
              : isUserEffectivelyOnline(raw.online_status, raw.last_seen)
                ? 'online'
                : 'offline';
          setOtherUser({ ...raw, online_status: effectiveOnline });
          if (raw.accepts_messages === false) setMessagingDisabled(true);
          if (await hasSymmetricBlockBetween(user.id, peerFromRoute)) {
            setBlockRelationshipActive(true);
          }
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      const [convResult] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle(),
        fetchMessages(conversationId),
        markMessagesRead(conversationId, user.id),
      ]);

      setLoading(false);

      if (convResult.data) {
        const otherId = convResult.data.participant_ids.find((id: string) => id !== user.id);
        if (otherId) {
          const { data: raw } = await supabase
            .from('profiles')
            .select(PROFILE_LIST_SELECT as '*')
            .eq('id', otherId)
            .maybeSingle();
          if (raw) {
            const effectiveOnline =
              raw.online_visible === false
                ? 'offline'
                : isUserEffectivelyOnline(raw.online_status, raw.last_seen)
                  ? 'online'
                  : 'offline';
            setOtherUser({ ...raw, online_status: effectiveOnline });
            if (raw.accepts_messages === false) setMessagingDisabled(true);
            if (await hasSymmetricBlockBetween(user.id, otherId)) {
              setBlockRelationshipActive(true);
            }
          }
        }
      }
    };

    void init();
  }, [conversationId, user?.id]);

  useChatRealtime({
    conversationId,
    userId: user?.id,
    messagesIdSetRef,
    peerTypingTimerRef,
    typingChannelRef,
    addMessage,
    applyMessageUpdate,
    removeMessage,
    markMessagesRead,
    setPeerTyping,
    setReactions,
  });

  useChatVisibilitySync(conversationId, user?.id, fetchMessages, markMessagesRead);

  // ── Menus ────────────────────────────────────────────────────────────────────
  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnim, { toValue: 1, ...SPRING }).start();
  };
  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, ...SNAP_OUT }).start(() => setMenuVisible(false));
  };
  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !user || !conversationId) return;
    if (outgoingMessagingDisabled || messagingDisabled || blockRelationshipActive) return;
    const content = text.trim();
    const cid = conversationId;
    setText('');
    lastTypingSentRef.current = 0;
    haptics.tapLight();
    pendingScrollModeRef.current = 'smooth';
    const { error } = await sendMessage(cid, user.id, content, user.full_name);
    if (error) {
      // Only restore text if the user hasn't already started typing something new
      setText((prev) => (prev.trim() ? prev : content));
      haptics.error();
      let toastMessage: string;
      if (
        error === ERROR_RECIPIENT_MESSAGES_DISABLED
        || error === ERROR_SENDER_MESSAGES_DISABLED
        || error === ERROR_MESSAGING_BLOCKED
      ) {
        toastMessage = error;
      } else if (/sender does not accept/i.test(error)) {
        toastMessage = ERROR_SENDER_MESSAGES_DISABLED;
      } else if (/recipient does not accept/i.test(error)) {
        toastMessage = ERROR_RECIPIENT_MESSAGES_DISABLED;
      } else if (/messaging blocked between participants/i.test(error)) {
        toastMessage = ERROR_MESSAGING_BLOCKED;
      } else {
        toastMessage = 'Message failed to send. Please try again.';
      }
      showToast({ message: toastMessage });
      console.error('[Chat] send error:', error);
    }
  };

  const openMsgSheet = useCallback((messageId: string, isOwn: boolean, content: string) => {
    setSelectedMessages((prev) => {
      if (prev.size === 0) {
        haptics.tapMedium();
        reactionAnim.setValue(0);
        Animated.spring(reactionAnim, { toValue: 1, ...SPRING }).start();
      } else {
        haptics.tapLight();
      }
      const next = new Map(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        if (next.size === 0) {
          Animated.timing(reactionAnim, { toValue: 0, ...SNAP_OUT }).start();
        }
      } else {
        next.set(messageId, { isOwn, content });
      }
      return next;
    });
  }, [reactionAnim]);

  const closeMsgSheet = useCallback(() => {
    Animated.timing(reactionAnim, { toValue: 0, ...SNAP_OUT })
      .start(() => setSelectedMessages(new Map()));
  }, [reactionAnim]);

  /**
   * Toggle a reaction. iMessage-style: each user can only have ONE reaction
   * per message (DB PK is (message_id, user_id)). Tapping the same emoji
   * removes it; tapping a different emoji replaces the existing one.
   *
   * Optimistic UI: we update local state immediately, then write to Postgres.
   * The realtime listener will reconcile if the server state diverges.
   */
  const handleReact = useCallback(async (messageId: string, emoji: ReactionEmoji) => {
    if (!user) return;
    closeMsgSheet();
    haptics.tapLight();

    const currentForMessage = reactions[messageId] ?? {};
    const myCurrent = currentForMessage[user.id];
    const isRemoval = myCurrent === emoji;

    setReactions((prev) => {
      const next = { ...(prev[messageId] ?? {}) };
      if (isRemoval) {
        delete next[user.id];
      } else {
        next[user.id] = emoji;
      }
      return { ...prev, [messageId]: next };
    });

    try {
      if (isRemoval) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // upsert handles both first-react and switch-emoji in one round-trip,
        // and is idempotent across the realtime echo.
        const { error } = await supabase
          .from('message_reactions')
          .upsert(
            { message_id: messageId, user_id: user.id, emoji },
            { onConflict: 'message_id,user_id' },
          );
        if (error) throw error;
      }
    } catch (err) {
      console.warn('[Chat] reaction write failed', err);
      // Roll back on failure.
      setReactions((prev) => {
        const next = { ...(prev[messageId] ?? {}) };
        if (myCurrent) {
          next[user.id] = myCurrent;
        } else {
          delete next[user.id];
        }
        return { ...prev, [messageId]: next };
      });
    }
  }, [user, reactions, closeMsgSheet]);

  const handleCopyMessage = async () => {
    const contents = Array.from(selectedMessages.values()).map(m => m.content.trim()).filter(Boolean);
    closeMsgSheet();
    if (contents.length === 0) return;
    const text = contents.join('\n\n');
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS !== 'android') {
        showToast({ message: UI_TOAST.copied, icon: 'copy-outline' });
      }
    } catch {
      showToast({ message: UI_TOAST.copyFailed });
    }
  };

  const handleTrashPress = () => {
    const msgs = Array.from(selectedMessages.entries());
    closeMsgSheet();
    const cid = conversationId;
    if (!cid || !user) return;

    // If selection includes ANY incoming messages, we only support "Delete for me".
    if (!msgs.every(([, meta]) => meta.isOwn)) {
      showDialog({
        title: msgs.length > 1 ? `Delete ${msgs.length} messages?` : 'Delete message?',
        icon: 'trash-outline',
        content: (
          <View style={{ paddingTop: 6 }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 18 }}>
              This will delete the selected message{msgs.length > 1 ? 's' : ''} for you only.
            </Text>
          </View>
        ),
        actions: [
          { label: UI_LABELS.cancel, style: 'cancel' },
          {
            label: UI_LABELS.delete,
            style: 'destructive',
            onPress: async () => {
              try {
                await Promise.all(msgs.map(([messageId]) => softDeleteMessageForSelf(cid, messageId)));
                showToast({
                  message: msgs.length > 1 ? 'Messages deleted for you' : 'Message deleted for you',
                  icon: 'trash-outline',
                });
              } catch {
                showToast({ message: 'Failed to delete some messages.', icon: 'alert-circle-outline' });
              }
            },
          },
        ],
      });
      return;
    }

    const deleteForEveryoneRef = { current: false };

    showDialog({
      title: msgs.length > 1 ? `Delete ${msgs.length} messages?` : 'Delete message?',
      icon: 'trash-outline',
      content: <DeleteForEveryoneConfirmContent checkedRef={deleteForEveryoneRef} />,
      actions: [
        { label: UI_LABELS.cancel, style: 'cancel' },
        {
          label: UI_LABELS.delete,
          style: 'destructive',
          onPress: async () => {
            if (!deleteForEveryoneRef.current) {
              showToast({
                message: 'Check "Delete for everyone" to confirm.',
                icon: 'information-circle-outline',
              });
              return;
            }
            try {
              await Promise.all(msgs.map(([messageId]) => deleteMessage(cid, messageId)));
              showToast({
                message:
                  msgs.length > 1 ? 'Messages deleted for everyone' : 'Message deleted for everyone',
                icon: 'trash-outline',
              });
            } catch {
              showToast({ message: 'Failed to delete some messages.', icon: 'alert-circle-outline' });
            }
          },
        },
      ],
    });
  };

  const handleLike = async () => {
    closeMenu();
    if (!user || !peer) return;
    const wasLiked = likedUserIds.has(peer.id);
    if (!wasLiked && blockRelationshipActive) {
      showToast({ message: UI_TOAST.interactionBlocked, icon: 'ban-outline' });
      return;
    }
    if (!wasLiked) haptics.tapLight();
    await toggleLike(user.id, peer.id);
    if (!wasLiked && !useDiscoverStore.getState().likedUserIds.has(peer.id)) {
      return;
    }
    showToast({ message: wasLiked ? UI_TOAST.likeRemoved : UI_TOAST.liked });
  };

  const handleFavourite = async () => {
    closeMenu();
    if (!user || !peer) return;
    if (isFavourite) {
      try {
        const { error } = await supabase.from('favourites').delete().eq('user_id', user.id).eq('favourited_id', peer.id);
        if (error) throw error;
        setIsFavourite(false);
        showToast({ message: UI_TOAST.favouriteRemoved });
      } catch {
        showToast({ icon: 'alert-circle-outline', message: UI_TOAST.favouritesUpdateFailed });
      }
    } else {
      if (blockRelationshipActive) {
        showToast({ message: UI_TOAST.interactionBlocked, icon: 'ban-outline' });
        return;
      }
      haptics.tapLight();
      try {
        const result = await addFavourite(user.id, peer.id);
        if (result === 'blocked') {
          showToast({ message: UI_TOAST.interactionBlocked, icon: 'ban-outline' });
          return;
        }
      } catch {
        showToast({ icon: 'alert-circle-outline', message: UI_TOAST.favouritesUpdateFailed });
        return;
      }
      setIsFavourite(true);
      showToast({ message: UI_TOAST.favouriteAdded });
    }
  };

  const handleReport = async () => {
    closeMenu();
    if (!user || !peer) return;
    try {
      if (await hasExistingReport(user.id, peer.id)) {
        showToast({ message: UI_TOAST.reportExists, icon: 'information-circle-outline' });
        return;
      }
    } catch {
      showToast({ message: UI_TOAST.reportCheckFailed, icon: 'alert-circle-outline' });
      return;
    }
    setReportModalVisible(true);
  };

  const composerBottomPad = keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10);
  const disabledBarBottomPad = keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16);

  const handleBlock = () => {
    closeMenu();
    if (!user || !peer) return;
    showDialog({
      title: `Block ${peer.full_name}?`,
      message: "They won't see your profile or message you.",
      icon: 'ban-outline',
      actions: [
        { label: UI_LABELS.cancel, style: 'cancel' },
        { label: UI_LABELS.block, style: 'destructive', onPress: async () => {
          const { error: blockErr } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: peer.id });
          if (blockErr) {
            showToast({ message: 'Failed to block user. Please try again.', icon: 'alert-circle-outline' });
            return;
          }
          setBlockRelationshipActive(true);
          router.back();
        }},
      ],
    });
  };

  /** Stable renderItem — avoids invalidating FlatList's render cache on every parent render. */
  const renderItem = useCallback(({ item }: { item: ChatListItem }) => {
    if (item.type === 'date') {
      return (
        <View style={{ alignItems: 'center', marginVertical: 6 }}>
          <Text style={s.datePill}>{item.label}</Text>
        </View>
      );
    }
    return (
      <ChatMessageRow
        item={item.message}
        userId={user?.id}
        msgReactions={reactionEmojiArrays[item.message.id] ?? EMPTY_REACTION_LIST}
        onLongPress={openMsgSheet}
        onPress={selectedMessages.size > 0 ? openMsgSheet : undefined}
        isSelected={selectedMessages.has(item.message.id)}
        isGroupStart={item.isGroupStart}
        isGroupEnd={item.isGroupEnd}
      />
    );
  }, [user?.id, reactionEmojiArrays, selectedMessages, openMsgSheet]);

  const composerVariant: ChatComposerVariant = outgoingMessagingDisabled
    ? 'outgoing-off'
    : blockRelationshipActive
      ? 'blocked'
      : messagingDisabled
        ? 'peer-off'
        : 'active';

  const handleComposerChange = useCallback(
    (v: string) => {
      setText(v);
      if (!v.trim() || !user || !typingChannelRef.current) return;
      const now = Date.now();
      if (now - lastTypingSentRef.current < 2500) return;
      const ch = typingChannelRef.current;
      const chState = (ch as unknown as { state?: string }).state;
      if (chState !== 'joined') return;
      lastTypingSentRef.current = now;
      ch
        .send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id },
        })
        .catch((e: unknown) => {
          console.warn('[Chat] typing send failed', e);
        });
    },
    [user],
  );

  const conversationPane = (
    <>
      <ChatMessageList
        listRef={flatListRef}
        data={invertedListItems}
        extraData={flatListExtraData}
        isLoadingOlder={isLoadingOlder}
        onScroll={handleListScroll}
        renderItem={renderItem}
        showEmptyHint={!loading && visibleMessages.length === 0 && !conversationHasMessages}
      />

      <ChatComposerArea
        variant={composerVariant}
        text={text}
        onChangeText={handleComposerChange}
        onSend={handleSend}
        inputRef={inputRef}
        inputFocused={inputFocused}
        onInputFocus={() => setInputFocused(true)}
        onInputBlur={() => setInputFocused(false)}
        composerBottomPad={composerBottomPad}
        disabledBarBottomPad={disabledBarBottomPad}
      />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/*
        Universal cross-OEM keyboard handling. KeyboardAvoidingView from
        react-native-keyboard-controller reads native window insets, so it
        lifts the composer to exactly the right position on every device
        (Samsung One UI, MIUI, ColorOS, iOS) — no per-OEM math.
        `keyboardVerticalOffset` accounts for our absolutely-positioned
        custom header so KAV doesn't try to lift content above the header.
      */}
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? bodyTopInset : 0}
        style={{ flex: 1, marginTop: bodyTopInset }}
      >
        <View style={{ flex: 1 }}>{conversationPane}</View>
      </KeyboardAvoidingView>

      <View
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setChatHeaderHeight(Math.round(h));
        }}
        style={headerChromeStyle}
      >
        {selectedMessages.size > 0 ? (
          <ChatScreenHeaderChrome
            mode="selection"
            selectionCount={selectedMessages.size}
            showDelete={true}
            onCloseSelection={closeMsgSheet}
            onCopy={handleCopyMessage}
            onDelete={handleTrashPress}
          />
        ) : (
          <ChatScreenHeaderChrome
            mode="peer"
            peer={peer}
            avatar={avatar}
            peerTyping={peerTyping}
            onOpenMenu={openMenu}
          />
        )}
      </View>

      {menuVisible ? (
        <ChatPeerOverflowMenu
          bodyTopInset={bodyTopInset}
          menuAnim={menuAnim}
          isLiked={isLiked}
          isFavourite={isFavourite}
          onBackdropPress={closeMenu}
          onLike={handleLike}
          onFavourite={handleFavourite}
          onReport={handleReport}
          onBlock={handleBlock}
        />
      ) : null}

      {selectedMessages.size === 1 && !Array.from(selectedMessages.values())[0].isOwn ? (
        <ChatReactionPickerOverlay
          messageId={Array.from(selectedMessages.keys())[0]}
          userId={user?.id}
          reactions={reactions}
          reactionAnim={reactionAnim}
          onBackdropPress={closeMsgSheet}
          onPick={handleReact}
        />
      ) : null}

      {user && peer ? (
        <ReportUserModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          reporterId={user.id}
          reportedUserId={peer.id}
          reportedUserName={peer.full_name ?? 'User'}
        />
      ) : null}
    </View>
  );
}

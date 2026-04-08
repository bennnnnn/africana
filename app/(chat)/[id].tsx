import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, Animated, KeyboardAvoidingView, Platform,
  StyleSheet, Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
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

const { width } = Dimensions.get('window');
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { conversations, messages, fetchMessages, sendMessage, deleteMessage, markMessagesRead, addMessage } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();
  const { showDialog, showToast } = useDialog();

  const [otherUser, setOtherUser]         = useState<User | null>(null);
  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [menuVisible, setMenuVisible]     = useState(false);
  const [isFavourite, setIsFavourite]     = useState(false);
  const menuAnim  = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);
  // Unified overlay — one at a time; isOwn=true → own message (trash only), isOwn=false → other's (emojis + trash)
  const [msgSheet, setMsgSheet] = useState<{ messageId: string; isOwn: boolean } | null>(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  // Local reactions map: messageId → emoji[]
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  // Locally hidden messages (deleted for me only)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());


  const convMessages = messages[conversationId] ?? [];
  const visibleMessages = convMessages.filter((message) => !hiddenIds.has(message.id));
  const seededConversation = conversations.find((conversation) => conversation.id === conversationId);
  const isLiked = otherUser ? likedUserIds.has(otherUser.id) : false;
  const avatar = otherUser
    ? (otherUser.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(otherUser.full_name.charAt(0))}`)
    : null;

  // ── Fetch like state ─────────────────────────────────────────────────────────
  useEffect(() => { if (user) fetchLikedUserIds(user.id); }, [user?.id]);

  // ── Favourite status ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !otherUser) return;
    supabase.from('favourites').select('id')
      .eq('user_id', user.id).eq('favourited_id', otherUser.id).maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user?.id, otherUser?.id]);

  // ── Chat init — runs once per conversation ───────────────────────────────────
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

      const seeded = seededConversation;
      if (seeded?.other_user) {
        setOtherUser(seeded.other_user);
        setLoading(false);
        const otherId = seeded.other_user.id;
        await Promise.all([
          fetchMessages(conversationId),
          markMessagesRead(conversationId, user.id),
        ]);
        supabase
          .from('user_settings')
          .select('receive_messages')
          .eq('user_id', otherId)
          .single()
          .then(({ data }) => {
            if (data && !data.receive_messages) setMessagingDisabled(true);
          });
        return;
      }

      const [convResult] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', conversationId).single(),
        fetchMessages(conversationId),
        markMessagesRead(conversationId, user.id),
      ]);

      if (convResult.data) {
        const otherId = convResult.data.participant_ids.find((id: string) => id !== user.id);
        if (otherId) {
          const [profileResult, settingsResult] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', otherId).single(),
            supabase.from('user_settings').select('receive_messages').eq('user_id', otherId).single(),
          ]);
          setOtherUser(profileResult.data);
          if (settingsResult.data && !settingsResult.data.receive_messages) setMessagingDisabled(true);
        }
      }
      setLoading(false);
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .channel(`messages-${conversationId}`)
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
    if (!text.trim() || !user) return;
    if (messagingDisabled) return;
    const content = text.trim();
    setText('');
    inputRef.current?.focus();
    const { error } = await sendMessage(conversationId, user.id, content, user.full_name);
    if (error) {
      setText(content);
      showToast({ message: 'Message failed to send' });
      console.error('[Chat] send error:', error);
    }
  };

  const openMsgSheet = (messageId: string, isOwn: boolean) => {
    setMsgSheet({ messageId, isOwn });
    reactionAnim.setValue(0);
    Animated.spring(reactionAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

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
          if (isOwn) deleteMessage(conversationId, messageId);
          else {
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.add(messageId);
              if (user) void persistHiddenMessageIds(user.id, conversationId, next);
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
    if (!user || !otherUser) return;
    const wasLiked = likedUserIds.has(otherUser.id);
    toggleLike(user.id, otherUser.id);
    showToast({ message: wasLiked ? 'Unliked' : 'Liked' });
  };

  const handleFavourite = async () => {
    closeMenu();
    if (!user || !otherUser) return;
    if (isFavourite) {
      await supabase.from('favourites').delete().eq('user_id', user.id).eq('favourited_id', otherUser.id);
      setIsFavourite(false);
      showToast({ message: 'Removed from favourites' });
    } else {
      await supabase.from('favourites').insert({ user_id: user.id, favourited_id: otherUser.id });
      setIsFavourite(true);
      showToast({ message: 'Added to favourites' });
    }
  };

  const handleReport = () => {
    closeMenu();
    if (!user || !otherUser) return;
    showDialog({
      title: `Report ${otherUser.full_name}`,
      message: 'Select a reason. Our team will review it.',
      actions: REPORT_REASONS.map((reason) => ({
        label: reason,
        onPress: async () => {
          await supabase.from('reports').insert({ reporter_id: user.id, reported_id: otherUser.id, reason });
          showToast({ message: 'Report submitted' });
        },
      })),
    });
  };

  const handleBlock = () => {
    closeMenu();
    if (!user || !otherUser) return;
    showDialog({
      title: `Block ${otherUser.full_name}?`,
      message: "They won't be able to see your profile or send you messages.",
      actions: [
        { label: 'Cancel' },
        { label: 'Block', style: 'destructive', onPress: async () => {
          await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: otherUser.id });
          router.back();
        }},
      ],
    });
  };

  const isOwnProfile = user?.id === otherUser?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF6EE' }}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textStrong} />
        </TouchableOpacity>

        {otherUser ? (
          <TouchableOpacity
            onPress={() => router.push(`/(profile)/${otherUser.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {avatar && (
              <View>
                <Image source={{ uri: avatar }} style={s.headerAvatar} contentFit="cover" />
                <View style={[s.onlineDot, { backgroundColor: otherUser.online_status === 'online' ? COLORS.online : COLORS.border }]} />
              </View>
            )}
            <View>
              <Text style={s.headerName}>{otherUser.full_name}</Text>
              <Text style={[s.headerStatus, { color: otherUser.online_status === 'online' ? COLORS.online : COLORS.textMuted }]}>
                {otherUser.online_status === 'online' ? 'Online' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}

        {otherUser && (
          <TouchableOpacity onPress={openMenu} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textStrong} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Dropdown menu — absolute, no Modal so keyboard stays open ── */}
      {menuVisible && (
        <>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeMenu} />
          <Animated.View style={[s.dropdown, {
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── Empty state — outside FlatList to avoid inverted transform issues ── */}
        {!loading && visibleMessages.length === 0 && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 60, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              No messages yet.{'\n'}Say hello! 👋
            </Text>
          </View>
        )}

        {/* ── Messages — inverted so newest is always at bottom, no scroll animation needed ── */}
        <FlatList
          ref={flatListRef}
          data={[...visibleMessages].reverse()}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={null}
          renderItem={({ item, index, separators: _ }) => {
            // In inverted list, index 0 = newest. nextItem is the older message above it.
            const isOwn = item.sender_id === user?.id;
            const isTemp = item.id.startsWith('temp-');
            const nextItem = visibleMessages[visibleMessages.length - 1 - index - 1]; // older message
            const showDate = !nextItem ||
              dayjs(item.created_at).format('YYYY-MM-DD') !== dayjs(nextItem.created_at).format('YYYY-MM-DD');
            const msgReactions = reactions[item.id] ?? [];

            return (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                  <Pressable
                    onLongPress={() => openMsgSheet(item.id, isOwn)}
                    delayLongPress={350}
                    android_ripple={null}
                    style={{ opacity: 1 }}
                  >
                    <View style={{ maxWidth: width * 0.72 }}>
                      <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
                        <Text style={[s.bubbleText, { color: isOwn ? COLORS.white : COLORS.textStrong }]}>{item.content}</Text>
                      </View>
                      {/* Reactions hug the bottom edge of the bubble */}
                      {msgReactions.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 3, marginTop: -10,
                          marginBottom: 4,
                          paddingHorizontal: 6,
                          justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                          {msgReactions.map((emoji, i) => (
                            <View key={i} style={s.reactionBubble}>
                              <Text style={{ fontSize: 13 }}>{emoji}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
                        justifyContent: isOwn ? 'flex-end' : 'flex-start', paddingHorizontal: 4 }}>
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
                {showDate && (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <Text style={s.datePill}>
                      {dayjs(item.created_at).isToday() ? 'Today'
                        : dayjs(item.created_at).isYesterday() ? 'Yesterday'
                        : dayjs(item.created_at).format('ddd, MMM D')}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* ── Input ── */}
        {messagingDisabled ? (
          <View style={s.disabledBar}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>This user has disabled messages.</Text>
          </View>
        ) : (
          <View style={s.inputRow}>
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
              autoFocus
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
      </KeyboardAvoidingView>




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

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: COLORS.white },
  headerName: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.textStrong },
  headerStatus: { fontSize: FONT.xs, fontWeight: FONT.medium, marginTop: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 },
  dropdown: { position: 'absolute', top: 96, right: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, paddingVertical: 6, minWidth: 180, ...SHADOWS.md, borderWidth: 1, borderColor: COLORS.border, zIndex: 999 },
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

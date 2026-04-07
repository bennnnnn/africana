import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, Animated, KeyboardAvoidingView, Platform,
  StyleSheet, Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { User, Message } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { MOCK_USERS } from '@/lib/mock-data';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

const { width } = Dimensions.get('window');
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { conversations, messages, fetchMessages, sendMessage, deleteMessage, markMessagesRead, addMessage } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();

  const [otherUser, setOtherUser]         = useState<User | null>(null);
  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [menuVisible, setMenuVisible]     = useState(false);
  const [isFavourite, setIsFavourite]     = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<typeof REPORT_REASONS[number] | null>(null);
  const [blockVisible, setBlockVisible]   = useState(false);
  const [ctxMsg, setCtxMsg]               = useState<{ id: string; content: string; isOwn: boolean } | null>(null);
  // Local emoji reactions (visual only — persisted reactions need a DB table)
  const [reactions, setReactions]         = useState<Record<string, string[]>>({});

  const menuAnim  = useRef(new Animated.Value(0)).current;
  const ctxAnim   = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [toast, setToast] = useState<{ icon: string; message: string } | null>(null);

  const showToast = (icon: string, message: string) => {
    setToast({ icon, message });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const convMessages = messages[conversationId] ?? [];
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

  // ── Chat init — ALL parallel ─────────────────────────────────────────────────
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

      if (seededConversation?.other_user) {
        setOtherUser(seededConversation.other_user);
        setLoading(false);
        const otherId = seededConversation.other_user.id;
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

      // Run conversation fetch + messages fetch in parallel
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

    if (isMock) return;

    // Real-time: use payload.new directly — NO extra DB fetch
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
  }, [conversationId, seededConversation?.other_user?.id, user?.id]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (convMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [convMessages.length]);

  // ── Menus ────────────────────────────────────────────────────────────────────
  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };
  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setMenuVisible(false));
  };
  const openCtx = (id: string, content: string, isOwn: boolean) => {
    setCtxMsg({ id, content, isOwn });
    ctxAnim.setValue(0);
    Animated.spring(ctxAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };
  const closeCtx = () => {
    Animated.timing(ctxAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setCtxMsg(null));
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!text.trim() || !user) return;
    if (messagingDisabled) return; // disabled notice shown in UI
    const content = text.trim();
    setText('');
    sendMessage(conversationId, user.id, content); // optimistic — no await needed
  };

  const handleReact = (emoji: string) => {
    if (!ctxMsg) return;
    const msgId = ctxMsg.id;
    setReactions((prev) => {
      const current = prev[msgId] ?? [];
      const exists = current.includes(emoji);
      return { ...prev, [msgId]: exists ? current.filter((e) => e !== emoji) : [...current, emoji] };
    });
    closeCtx();
  };

  const handleDelete = (messageId: string) => {
    deleteMessage(conversationId, messageId); // optimistic in store
    closeCtx();
  };

  const handleCopy = (content: string) => { Clipboard.setStringAsync(content); closeCtx(); };

  const handleLike = async () => {
    closeMenu();
    if (!user || !otherUser) return;
    const wasLiked = likedUserIds.has(otherUser.id);
    toggleLike(user.id, otherUser.id);
    showToast(wasLiked ? '💔' : '❤️', wasLiked ? 'Unliked' : 'Liked!');
  };

  const handleFavourite = async () => {
    closeMenu();
    if (!user || !otherUser) return;
    if (isFavourite) {
      await supabase.from('favourites').delete().eq('user_id', user.id).eq('favourited_id', otherUser.id);
      setIsFavourite(false);
      showToast('🗑️', 'Removed from favourites');
    } else {
      await supabase.from('favourites').insert({ user_id: user.id, favourited_id: otherUser.id });
      setIsFavourite(true);
      showToast('⭐', 'Added to favourites!');
    }
  };

  const submitReport = async () => {
    if (!user || !otherUser || !selectedReason) return;
    await supabase.from('reports').insert({ reporter_id: user.id, reported_id: otherUser.id, reason: selectedReason });
    setReportVisible(false);
    setSelectedReason(null);
  };

  const confirmBlock = async () => {
    if (!user || !otherUser) return;
    await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: otherUser.id });
    setBlockVisible(false);
    router.back();
  };

  const isOwnProfile = user?.id === otherUser?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F0' }}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>

        {otherUser ? (
          <TouchableOpacity
            onPress={() => router.push(`/(profile)/${otherUser.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {avatar && (
              <View>
                <Image source={{ uri: avatar }} style={s.headerAvatar} contentFit="cover" />
                <View style={[s.onlineDot, { backgroundColor: otherUser.online_status === 'online' ? COLORS.online : '#CCC' }]} />
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
            <Ionicons name="ellipsis-vertical" size={22} color="#111" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Dropdown menu ── */}
      {menuVisible && (
        <Modal transparent animationType="none" onRequestClose={closeMenu}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeMenu} />
          <Animated.View style={[s.dropdown, {
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          }]}>
            <TouchableOpacity style={s.menuItem} onPress={handleLike}>
              <View style={s.menuIcon}><Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={17} color="#111" /></View>
              <Text style={s.menuLabel}>{isLiked ? 'Unlike' : 'Like'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={handleFavourite}>
              <View style={s.menuIcon}><Ionicons name={isFavourite ? 'star' : 'star-outline'} size={17} color="#111" /></View>
              <Text style={s.menuLabel}>{isFavourite ? 'Unfavourite' : 'Favourite'}</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 }} />
            <TouchableOpacity style={s.menuItem} onPress={() => { closeMenu(); setTimeout(() => setReportVisible(true), 120); }}>
              <View style={s.menuIcon}><Ionicons name="flag-outline" size={17} color="#111" /></View>
              <Text style={s.menuLabel}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { closeMenu(); setTimeout(() => setBlockVisible(true), 120); }}>
              <View style={s.menuIcon}><Ionicons name="ban-outline" size={17} color="#E53E3E" /></View>
              <Text style={[s.menuLabel, { color: '#E53E3E' }]}>Block</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                  No messages yet.{'\n'}Say hello! 👋
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isOwn = item.sender_id === user?.id;
            const isTemp = item.id.startsWith('temp-');
            const showDate = index === 0 ||
              dayjs(item.created_at).format('YYYY-MM-DD') !== dayjs(convMessages[index - 1]?.created_at).format('YYYY-MM-DD');
            const msgReactions = reactions[item.id] ?? [];

            return (
              <View>
                {showDate && (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <Text style={s.datePill}>
                      {dayjs(item.created_at).isToday() ? 'Today'
                        : dayjs(item.created_at).isYesterday() ? 'Yesterday'
                        : dayjs(item.created_at).format('ddd, MMM D')}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => openCtx(item.id, item.content, isOwn)}
                    delayLongPress={350}
                  >
                    <View style={{ maxWidth: width * 0.72 }}>
                      <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther, isTemp && { opacity: 0.6 }]}>
                        <Text style={[s.bubbleText, { color: isOwn ? '#FFF' : '#111' }]}>{item.content}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
                        justifyContent: isOwn ? 'flex-end' : 'flex-start', paddingHorizontal: 4 }}>
                        <Text style={s.timestamp}>{dayjs(item.created_at).format('h:mm A')}</Text>
                        {isOwn && (
                          <Text style={{ fontSize: 10, color: item.read_at ? COLORS.success : COLORS.textMuted }}>
                            {item.read_at ? '✓✓' : isTemp ? '○' : '✓'}
                          </Text>
                        )}
                      </View>
                      {msgReactions.length > 0 && (
                        <View style={[s.reactionRow, { justifyContent: isOwn ? 'flex-end' : 'flex-start' }]}>
                          {msgReactions.map((emoji, i) => (
                            <View key={i} style={s.reactionBubble}>
                              <Text style={{ fontSize: 15 }}>{emoji}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
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
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={1000}
              style={s.input}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim()}
              style={[s.sendBtn, { backgroundColor: text.trim() ? COLORS.primary : COLORS.border }]}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Toast notification ── */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 80,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(17,17,17,0.88)',
            paddingHorizontal: 18,
            paddingVertical: 11,
            borderRadius: 30,
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }}
        >
          <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* ── Long-press context sheet ── */}
      {ctxMsg && (
        <Modal transparent animationType="none" onRequestClose={closeCtx}>
          <TouchableOpacity style={s.ctxBackdrop} activeOpacity={1} onPress={closeCtx} />
          <Animated.View style={[s.ctxSheet, {
            opacity: ctxAnim,
            transform: [{ translateY: ctxAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }]}>
            <View style={s.ctxHandle} />

            {/* Emoji reaction row */}
            <View style={s.reactionPicker}>
              {QUICK_REACTIONS.map((emoji) => {
                const active = (reactions[ctxMsg.id] ?? []).includes(emoji);
                return (
                  <TouchableOpacity key={emoji} onPress={() => handleReact(emoji)}
                    style={[s.reactionPickerItem, active && s.reactionPickerItemActive]}>
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: 20, marginVertical: 4 }} />

            {/* Copy */}
            <TouchableOpacity style={s.ctxItem} onPress={() => handleCopy(ctxMsg.content)}>
              <View style={[s.ctxIcon, { backgroundColor: '#F0F0F0' }]}>
                <Ionicons name="copy-outline" size={18} color="#111" />
              </View>
              <Text style={s.ctxLabel}>Copy</Text>
            </TouchableOpacity>

            {/* Delete (own messages only — no Alert, instant) */}
            {ctxMsg.isOwn && (
              <>
                <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 }} />
                <TouchableOpacity style={s.ctxItem} onPress={() => handleDelete(ctxMsg.id)}>
                  <View style={[s.ctxIcon, { backgroundColor: '#FFF0F0' }]}>
                    <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                  </View>
                  <Text style={[s.ctxLabel, { color: '#E53E3E' }]}>Delete message</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </Modal>
      )}

      {/* ── Report modal ── */}
      <Modal visible={reportVisible} transparent animationType="fade"
        onRequestClose={() => { setReportVisible(false); setSelectedReason(null); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Report {otherUser?.full_name}</Text>
            <Text style={s.modalSub}>Select a reason</Text>
            <View style={{ gap: 8, marginTop: 14 }}>
              {REPORT_REASONS.map((reason) => {
                const on = selectedReason === reason;
                return (
                  <TouchableOpacity key={reason} onPress={() => setSelectedReason(reason)}
                    style={[s.reportOption, on && s.reportOptionOn]}>
                    <Text style={[s.reportOptionTxt, on && { color: COLORS.primary, fontWeight: '700' }]}>{reason}</Text>
                    {on && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setReportVisible(false); setSelectedReason(null); }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, !selectedReason && { opacity: 0.4 }]}
                onPress={submitReport} disabled={!selectedReason}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Block modal ── */}
      <Modal visible={blockVisible} transparent animationType="fade" onRequestClose={() => setBlockVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Block {otherUser?.full_name}?</Text>
            <Text style={s.modalSub}>They won't be able to see your profile or message you.</Text>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setBlockVisible(false)}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, { backgroundColor: '#E53E3E' }]} onPress={confirmBlock}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFF' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#111' },
  headerStatus: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dropdown: { position: 'absolute', top: 96, right: 12, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 6, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 10, borderWidth: 1, borderColor: COLORS.border, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  datePill: { fontSize: 11, color: COLORS.textSecondary, backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  bubbleOwn: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  timestamp: { fontSize: 10, color: COLORS.textMuted },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionBubble: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  disabledBar: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: COLORS.surface, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111', borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ctxBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.32)' },
  ctxSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, paddingTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 },
  ctxHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 12 },
  ctxItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  ctxIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctxLabel: { fontSize: 16, fontWeight: '500', color: '#111' },
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingVertical: 14 },
  reactionPickerItem: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactionPickerItemActive: { backgroundColor: `${COLORS.success}18`, borderWidth: 1.5, borderColor: COLORS.success },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,17,17,0.36)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', lineHeight: 26 },
  modalSub: { marginTop: 6, fontSize: 14, color: '#555', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#E7E1DC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  modalConfirm: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  reportOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E7E1DC', backgroundColor: '#FFF' },
  reportOptionOn: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08` },
  reportOptionTxt: { fontSize: 14, fontWeight: '500', color: '#111' },
});

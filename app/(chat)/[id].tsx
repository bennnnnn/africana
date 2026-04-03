import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { Avatar } from '@/components/ui/Avatar';
import { User } from '@/types';
import { COLORS } from '@/constants';
import { MOCK_USERS } from '@/lib/mock-data';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(isToday);
dayjs.extend(isYesterday);

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { messages, fetchMessages, sendMessage, deleteMessage, markMessagesRead, addMessage } = useChatStore();
  const { likedUserIds, toggleLike, fetchLikedUserIds } = useDiscoverStore();

  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [ctxMessage, setCtxMessage] = useState<{ id: string; content: string; isOwn: boolean } | null>(null);
  const ctxAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const convMessages = messages[conversationId] ?? [];

  // Fetch like state and favourite state on mount
  useEffect(() => {
    if (user) fetchLikedUserIds(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !otherUser) return;
    // Check favourite status
    supabase
      .from('favourites')
      .select('id')
      .eq('user_id', user.id)
      .eq('favourited_id', otherUser.id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user?.id, otherUser?.id]);

  useEffect(() => {
    if (!conversationId || !user) return;

    const isMock = conversationId.startsWith('mock-conv-');

    const init = async () => {
      if (isMock) {
        // For mock conversations: resolve the other user from the mock-conv ID
        // e.g. "mock-conv-mock-1" → otherUserId = "mock-1"
        const mockUserId = conversationId.replace('mock-conv-', '');
        const mockUser = MOCK_USERS.find((u) => u.id === mockUserId);
        if (mockUser) setOtherUser(mockUser);
        await fetchMessages(conversationId);
        setLoading(false);
        return;
      }

      // Real Supabase conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (conv) {
        const otherId = conv.participant_ids.find((id: string) => id !== user.id);
        if (otherId) {
          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherId)
            .single();
          setOtherUser(otherProfile);

          // Check if messaging is disabled
          const { data: settings } = await supabase
            .from('user_settings')
            .select('receive_messages')
            .eq('user_id', otherId)
            .single();

          if (settings && !settings.receive_messages) {
            setMessagingDisabled(true);
          }
        }
      }

      await fetchMessages(conversationId);
      await markMessagesRead(conversationId, user.id);
      setLoading(false);
    };

    init();

    if (isMock) return; // No real-time subscription for mock chats

    // Real-time subscription
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data: msgWithSender } = await supabase
            .from('messages')
            .select('*, sender:profiles(*)')
            .eq('id', payload.new.id)
            .single();
          if (msgWithSender && msgWithSender.sender_id !== user.id) {
            addMessage(conversationId, msgWithSender);
            markMessagesRead(conversationId, user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  useEffect(() => {
    if (convMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [convMessages.length]);

  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() =>
      setMenuVisible(false)
    );
  };

  const handleLike = async () => {
    closeMenu();
    if (!user || !otherUser) return;
    await toggleLike(user.id, otherUser.id);
  };

  const handleFavourite = async () => {
    closeMenu();
    if (!user || !otherUser) return;
    if (isFavourite) {
      await supabase
        .from('favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('favourited_id', otherUser.id);
      setIsFavourite(false);
    } else {
      await supabase
        .from('favourites')
        .insert({ user_id: user.id, favourited_id: otherUser.id });
      setIsFavourite(true);
    }
  };

  const handleReport = () => {
    closeMenu();
    if (!user || !otherUser) return;
    const reasons = [
      'Fake profile / impersonation',
      'Inappropriate content',
      'Harassment or abuse',
      'Spam or scam',
      'Underage user',
      'Other',
    ];
    setTimeout(() => {
      Alert.alert(
        `Report ${otherUser.full_name}`,
        'Why are you reporting this conversation?',
        [
          ...reasons.map((reason) => ({
            text: reason,
            onPress: async () => {
              await supabase.from('reports').insert({
                reporter_id: user.id,
                reported_id: otherUser.id,
                reason,
              });
              Alert.alert('Report submitted', 'Thank you. Our team will review this within 24 hours.');
            },
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }, 200);
  };

  const handleBlock = () => {
    closeMenu();
    if (!user || !otherUser) return;
    setTimeout(() => {
      Alert.alert(
        'Block User',
        `Block ${otherUser.full_name}? They won't be able to message or see your profile.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('blocks').insert({
                blocker_id: user.id,
                blocked_id: otherUser.id,
              });
              Alert.alert('Blocked', `${otherUser.full_name} has been blocked.`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            },
          },
        ],
      );
    }, 200);
  };

  const openCtx = (id: string, content: string, isOwn: boolean) => {
    setCtxMessage({ id, content, isOwn });
    ctxAnim.setValue(0);
    Animated.spring(ctxAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const closeCtx = () => {
    Animated.timing(ctxAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() =>
      setCtxMessage(null)
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    closeCtx();
    setTimeout(() => {
      Alert.alert('Delete message', 'Remove this message for everyone?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMessage(conversationId, messageId),
        },
      ]);
    }, 200);
  };

  const handleCopy = (content: string) => {
    Clipboard.setStringAsync(content);
    closeCtx();
  };

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;

    if (messagingDisabled) {
      Alert.alert('Cannot Send', 'This user has disabled messages.');
      return;
    }

    setSending(true);
    const content = text.trim();
    setText('');
    await sendMessage(conversationId, user.id, content);
    setSending(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isLiked = otherUser ? likedUserIds.has(otherUser.id) : false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {otherUser && (
          <TouchableOpacity
            onPress={() => router.push(`/(profile)/${otherUser.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Avatar
              uri={otherUser.avatar_url}
              name={otherUser.full_name}
              size={42}
              onlineStatus={otherUser.online_status}
              showStatus
            />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                {otherUser.full_name}
              </Text>
              <Text style={{
                fontSize: 12,
                color: otherUser.online_status === 'online' ? COLORS.online : COLORS.textMuted,
                fontWeight: '500',
              }}>
                {otherUser.online_status === 'online' ? 'Online' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Single ⋮ menu button */}
        {otherUser && (
          <TouchableOpacity onPress={openMenu} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown menu (report / block) */}
      {menuVisible && (
        <Modal transparent animationType="none" onRequestClose={closeMenu}>
          {/* Backdrop */}
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeMenu} />
          <Animated.View
            style={[
              s.dropdown,
              {
                opacity: menuAnim,
                transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
              },
            ]}
          >
            {/* Like */}
            <TouchableOpacity style={s.menuItem} onPress={handleLike}>
              <View style={[s.menuIcon, { backgroundColor: isLiked ? `${COLORS.primary}18` : '#FFF0F0' }]}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={17} color={COLORS.primary} />
              </View>
              <Text style={s.menuLabel}>{isLiked ? 'Unlike' : 'Like'}</Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            {/* Favourite */}
            <TouchableOpacity style={s.menuItem} onPress={handleFavourite}>
              <View style={[s.menuIcon, { backgroundColor: isFavourite ? '#FFF8E1' : '#FFFDE7' }]}>
                <Ionicons name={isFavourite ? 'star' : 'star-outline'} size={17} color={COLORS.gold} />
              </View>
              <Text style={s.menuLabel}>{isFavourite ? 'Unfavourite' : 'Favourite'}</Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            {/* Report */}
            <TouchableOpacity style={s.menuItem} onPress={handleReport}>
              <View style={[s.menuIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="flag-outline" size={17} color={COLORS.warning} />
              </View>
              <Text style={s.menuLabel}>Report</Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            {/* Block */}
            <TouchableOpacity style={s.menuItem} onPress={handleBlock}>
              <View style={[s.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="ban-outline" size={17} color={COLORS.error} />
              </View>
              <Text style={[s.menuLabel, { color: COLORS.error }]}>Block</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                No messages yet.{'\n'}Say hello! 👋
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isOwn = item.sender_id === user?.id;
            const showDate =
              index === 0 ||
              dayjs(item.created_at).format('YYYY-MM-DD') !==
                dayjs(convMessages[index - 1]?.created_at).format('YYYY-MM-DD');

            const bubble = (
              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={() => openCtx(item.id, item.content, isOwn)}
                delayLongPress={400}
              >
                <View style={{ maxWidth: '72%' }}>
                  <View
                    style={{
                      backgroundColor: isOwn ? COLORS.primary : '#FFFFFF',
                      borderRadius: 18,
                      borderBottomRightRadius: isOwn ? 4 : 18,
                      borderBottomLeftRadius: isOwn ? 18 : 4,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 3,
                      elevation: 1,
                    }}
                  >
                    <Text style={{ fontSize: 15, color: isOwn ? '#FFFFFF' : COLORS.text, lineHeight: 20 }}>
                      {item.content}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: COLORS.textMuted,
                      marginTop: 3,
                      alignSelf: isOwn ? 'flex-end' : 'flex-start',
                      marginHorizontal: 4,
                    }}
                  >
                    {dayjs(item.created_at).format('h:mm A')}
                    {isOwn && item.read_at && ' ✓✓'}
                  </Text>
                </View>
              </TouchableOpacity>
            );

            return (
              <View>
                {showDate && (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: COLORS.textSecondary,
                        backgroundColor: COLORS.border,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 10,
                      }}
                    >
                      {dayjs(item.created_at).isToday()
                        ? 'Today'
                        : dayjs(item.created_at).isYesterday()
                          ? 'Yesterday'
                          : dayjs(item.created_at).format('ddd, MMM D')}
                    </Text>
                  </View>
                )}
                {isOwn ? (
                  <Swipeable
                    renderLeftActions={() => (
                      <TouchableOpacity
                        onPress={() => handleDeleteMessage(item.id)}
                        style={s.swipeDelete}
                      >
                        <Ionicons name="trash" size={20} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 11, marginTop: 2 }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                    leftThreshold={60}
                    overshootLeft={false}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
                      {bubble}
                    </View>
                  </Swipeable>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 }}>
                    <Avatar
                      uri={otherUser?.avatar_url}
                      name={otherUser?.full_name ?? '?'}
                      size={28}
                      style={{ marginRight: 8, marginTop: 4 }}
                    />
                    {bubble}
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Input */}
        {messagingDisabled ? (
          <View
            style={{
              padding: 16,
              backgroundColor: '#FFF',
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>
              This user has disabled messages.
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              gap: 10,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                minHeight: 42,
                maxHeight: 120,
                backgroundColor: COLORS.surface,
                borderRadius: 21,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 15,
                color: COLORS.text,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: text.trim() ? COLORS.primary : COLORS.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Long-press context sheet */}
      {ctxMessage && (
        <Modal transparent animationType="none" onRequestClose={closeCtx}>
          <TouchableOpacity style={s.ctxBackdrop} activeOpacity={1} onPress={closeCtx} />
          <Animated.View
            style={[
              s.ctxSheet,
              {
                opacity: ctxAnim,
                transform: [{ translateY: ctxAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              },
            ]}
          >
            <View style={s.ctxHandle} />
            <TouchableOpacity style={s.ctxItem} onPress={() => handleCopy(ctxMessage.content)}>
              <View style={[s.ctxIcon, { backgroundColor: '#F0F0F0' }]}>
                <Ionicons name="copy-outline" size={18} color={COLORS.text} />
              </View>
              <Text style={s.ctxLabel}>Copy</Text>
            </TouchableOpacity>
            {ctxMessage.isOwn && (
              <>
                <View style={s.ctxDivider} />
                <TouchableOpacity style={s.ctxItem} onPress={() => handleDeleteMessage(ctxMessage.id)}>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  dropdown: {
    position: 'absolute',
    top: 96,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    minWidth: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 999,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 14,
  },
  swipeDelete: {
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginBottom: 6,
    borderRadius: 12,
    marginLeft: 6,
  },
  ctxBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  ctxSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  ctxHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 12,
  },
  ctxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  ctxIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  ctxDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
});

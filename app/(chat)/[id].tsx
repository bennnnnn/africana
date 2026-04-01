import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { Avatar } from '@/components/ui/Avatar';
import { Message, User } from '@/types';
import { COLORS } from '@/constants';
import dayjs from 'dayjs';

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { messages, fetchMessages, sendMessage, markMessagesRead, addMessage } = useChatStore();

  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const convMessages = messages[conversationId] ?? [];

  useEffect(() => {
    if (!conversationId || !user) return;

    const init = async () => {
      // Get conversation and other participant
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {otherUser && (
          <TouchableOpacity
            onPress={() => router.push(`/profile/${otherUser.id}`)}
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
              <Text
                style={{
                  fontSize: 12,
                  color:
                    otherUser.online_status === 'online' ? COLORS.online :
                    otherUser.online_status === 'away' ? COLORS.away : COLORS.textMuted,
                  fontWeight: '500',
                }}
              >
                {otherUser.online_status === 'online' ? 'Online' :
                 otherUser.online_status === 'away' ? 'Away' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
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
                      {dayjs(item.created_at).format('ddd, MMM D')}
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  {!isOwn && (
                    <Avatar
                      uri={otherUser?.avatar_url}
                      name={otherUser?.full_name ?? '?'}
                      size={28}
                      style={{ marginRight: 8, marginTop: 4 }}
                    />
                  )}
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
                      <Text
                        style={{
                          fontSize: 15,
                          color: isOwn ? '#FFFFFF' : COLORS.text,
                          lineHeight: 20,
                        }}
                      >
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
                </View>
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
    </SafeAreaView>
  );
}

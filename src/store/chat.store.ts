import { create } from 'zustand';
import { Conversation, Message, User } from '@/types';
import { supabase } from '@/lib/supabase';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  isLoading: boolean;
  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string) => Promise<void>;
  getOrCreateConversation: (userId: string, otherUserId: string) => Promise<string | null>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  isLoading: false,

  fetchConversations: async (userId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [userId])
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!error && data) {
        const conversationsWithUsers = await Promise.all(
          data.map(async (conv) => {
            const otherUserId = conv.participant_ids.find((id: string) => id !== userId);
            let other_user: User | undefined;

            if (otherUserId) {
              const { data: userData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', otherUserId)
                .single();
              other_user = userData ?? undefined;
            }

            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .is('read_at', null)
              .neq('sender_id', userId);

            return { ...conv, other_user, unread_count: count ?? 0 };
          })
        );
        set({ conversations: conversationsWithUsers });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId) => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      set((state) => ({
        messages: { ...state.messages, [conversationId]: data },
      }));
    }
  },

  sendMessage: async (conversationId, senderId, content) => {
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select('*, sender:profiles(*)')
      .single();

    if (data) {
      get().addMessage(conversationId, data);
      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }
  },

  getOrCreateConversation: async (userId, otherUserId) => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .contains('participant_ids', [userId, otherUserId])
      .single();

    if (existing) return existing.id;

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ participant_ids: [userId, otherUserId] })
      .select('id')
      .single();

    return newConv?.id ?? null;
  },

  markMessagesRead: async (conversationId, userId) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', userId);
  },

  addMessage: (conversationId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), message],
      },
    }));
  },
}));

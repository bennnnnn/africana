import { create } from 'zustand';
import { Conversation, Message, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { MOCK_USERS } from '@/lib/mock-data';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'mock-conv-mock-1',
    participant_ids: ['__current__', 'mock-1'],
    last_message: 'Hey! I saw your profile and loved it 😊',
    last_message_at: new Date(Date.now() - 10 * 60000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
    other_user: MOCK_USERS[0],
    unread_count: 2,
  },
  {
    id: 'mock-conv-mock-5',
    participant_ids: ['__current__', 'mock-5'],
    last_message: 'Are you coming to Lagos for the holidays?',
    last_message_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    other_user: MOCK_USERS[4],
    unread_count: 0,
  },
  {
    id: 'mock-conv-mock-2',
    participant_ids: ['__current__', 'mock-2'],
    last_message: 'Nice to meet you! Where are you based?',
    last_message_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    other_user: MOCK_USERS[1],
    unread_count: 1,
  },
];

// Pre-seeded messages so mock chat threads aren't empty
const MOCK_MESSAGES: Record<string, import('@/types').Message[]> = {
  'mock-conv-mock-1': [
    { id: 'mm-1-1', conversation_id: 'mock-conv-mock-1', sender_id: 'mock-1', content: 'Hey! I saw your profile and loved it 😊', read_at: null, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 'mm-1-2', conversation_id: 'mock-conv-mock-1', sender_id: '__current__', content: 'Thank you! I love your photos too 😍', read_at: new Date().toISOString(), created_at: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: 'mm-1-3', conversation_id: 'mock-conv-mock-1', sender_id: 'mock-1', content: 'Where are you based right now?', read_at: null, created_at: new Date(Date.now() - 10 * 60000).toISOString() },
  ],
  'mock-conv-mock-5': [
    { id: 'mm-5-1', conversation_id: 'mock-conv-mock-5', sender_id: 'mock-5', content: 'Are you coming to Lagos for the holidays?', read_at: new Date().toISOString(), created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  ],
  'mock-conv-mock-2': [
    { id: 'mm-2-1', conversation_id: 'mock-conv-mock-2', sender_id: '__current__', content: 'Hi! Loved your profile 🌍', read_at: new Date().toISOString(), created_at: new Date(Date.now() - 26 * 3600000).toISOString() },
    { id: 'mm-2-2', conversation_id: 'mock-conv-mock-2', sender_id: 'mock-2', content: 'Nice to meet you! Where are you based?', read_at: null, created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  ],
};

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  isLoading: boolean;
  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  getOrCreateConversation: (userId: string, otherUserId: string) => Promise<string | null>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: __DEV__ ? MOCK_MESSAGES : {},
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
        // In development, always prepend mock conversations so UI is testable
        const mockToAdd = __DEV__
          ? MOCK_CONVERSATIONS.filter((m) => !conversationsWithUsers.some((r) => r.id === m.id))
          : [];
        const result = [...conversationsWithUsers, ...mockToAdd];
        set({ conversations: result });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId) => {
    // Mock conversations are pre-seeded in initial state — no DB round-trip needed
    if (conversationId.startsWith('mock-')) {
      // Ensure the messages key exists (e.g. for dynamically created mock convs)
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId] ?? [],
        },
      }));
      return;
    }

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
    // For mock conversations — store message locally only
    if (conversationId.startsWith('mock-')) {
      const msg: Message = {
        id: `msg-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      get().addMessage(conversationId, msg);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
            : c
        ),
      }));
      return;
    }

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

      // Push-notify the other participant
      const conv = get().conversations.find((c) => c.id === conversationId);
      const recipientId = conv?.participant_ids?.find((id) => id !== senderId);
      const senderName = (data.sender as User | null)?.full_name ?? 'Someone';
      if (recipientId) {
        notifyUser({
          type: 'message',
          recipientId,
          senderId,
          senderName,
          extra: { conversationId },
        });
      }
    }
  },

  getOrCreateConversation: async (userId, otherUserId) => {
    // Mock users live in memory — no Supabase round-trip needed
    if (otherUserId.startsWith('mock-')) {
      const mockConvId = `mock-conv-${otherUserId}`;
      const exists = get().conversations.some((c) => c.id === mockConvId);
      if (!exists) {
        const mockUser = MOCK_USERS.find((u) => u.id === otherUserId);
        if (mockUser) {
          set((state) => ({
            conversations: [
              {
                id: mockConvId,
                participant_ids: [userId, otherUserId],
                last_message: null,
                last_message_at: null,
                created_at: new Date().toISOString(),
                other_user: mockUser,
                unread_count: 0,
              },
              ...state.conversations,
            ],
            messages: { ...state.messages, [mockConvId]: [] },
          }));
        }
      }
      return mockConvId;
    }

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

  deleteMessage: async (conversationId, messageId) => {
    // Remove from local state immediately
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
    // Skip DB call for mock messages
    if (messageId.startsWith('mm-') || conversationId.startsWith('mock-')) return;
    await supabase.from('messages').delete().eq('id', messageId);
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

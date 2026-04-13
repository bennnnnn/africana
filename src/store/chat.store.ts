import { create } from 'zustand';
import { Conversation, Message, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { MOCK_USERS } from '@/lib/mock-data';
import {
  clearCachedMessages,
  getCachedConversationSnapshot,
  getCachedMessages,
  replaceCachedConversations,
  replaceCachedMessages,
  enqueueReplaceCachedMessages,
} from '@/lib/chat-cache';
import { useAuthStore } from '@/store/auth.store';

/** Shown to the sender when the recipient has turned off receiving messages. */
export const ERROR_RECIPIENT_MESSAGES_DISABLED =
  'This person has turned off receiving messages in their settings.';

/** Shown when your own Receive messages is off (nothing in or out until you turn it on). */
export const ERROR_SENDER_MESSAGES_DISABLED =
  'Your messages are turned off. Open Settings → Privacy and turn on Receive messages to send.';

function pgErrorBlob(err: { message?: string; details?: string; hint?: string } | null): string {
  if (!err) return '';
  return `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase();
}

function isRecipientMessagesDisabledDbError(err: { message?: string; code?: string; details?: string; hint?: string } | null): boolean {
  const b = pgErrorBlob(err);
  return b.includes('recipient') && b.includes('not accept');
}

function isSenderMessagesDisabledDbError(err: { message?: string; code?: string; details?: string; hint?: string } | null): boolean {
  const b = pgErrorBlob(err);
  return b.includes('sender') && b.includes('not accept');
}

/** Maps raw PostgREST errors so the UI never shows a vague insert failure for prefs guards. */
function mapMessagesInsertError(err: { message?: string; code?: string; details?: string; hint?: string } | null): string | null {
  if (!err) return null;
  if (isRecipientMessagesDisabledDbError(err)) return ERROR_RECIPIENT_MESSAGES_DISABLED;
  if (isSenderMessagesDisabledDbError(err)) return ERROR_SENDER_MESSAGES_DISABLED;
  return null;
}

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
  sendMessage: (conversationId: string, senderId: string, content: string, senderName?: string) => Promise<{ error: string | null }>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  getOrCreateConversation: (userId: string, otherUserId: string) => Promise<string | null>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: __DEV__ ? MOCK_MESSAGES : {},
  isLoading: false,

  fetchConversations: async (userId) => {
    const cachedSnapshot = await getCachedConversationSnapshot(userId);
    if (cachedSnapshot.found) {
      set({ conversations: cachedSnapshot.conversations, isLoading: false });
    } else {
      set({ isLoading: true });
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [userId])
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!error && data) {
        const conversationIds = data.map((conv) => conv.id);
        const otherUserIds = Array.from(
          new Set(
            data
              .map((conv) => conv.participant_ids.find((id: string) => id !== userId))
              .filter(Boolean)
          )
        ) as string[];

        const [profilesResult, unreadResult] = await Promise.all([
          otherUserIds.length > 0
            ? supabase.from('profiles').select('*').in('id', otherUserIds)
            : Promise.resolve({ data: [] as User[] }),
          conversationIds.length > 0
            ? supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', conversationIds)
                .is('read_at', null)
                .neq('sender_id', userId)
            : Promise.resolve({ data: [] as { conversation_id: string }[] }),
        ]);

        const profilesById = new Map(
          ((profilesResult.data ?? []) as User[]).map((profile) => [profile.id, profile])
        );
        const unreadCounts = new Map<string, number>();
        for (const row of (unreadResult.data ?? []) as { conversation_id: string }[]) {
          unreadCounts.set(row.conversation_id, (unreadCounts.get(row.conversation_id) ?? 0) + 1);
        }

        const conversationsWithUsers = data.map((conv) => {
          const otherUserId = conv.participant_ids.find((id: string) => id !== userId);
          return {
            ...conv,
            other_user: otherUserId ? profilesById.get(otherUserId) : undefined,
            unread_count: unreadCounts.get(conv.id) ?? 0,
          };
        });
        // In development, always prepend mock conversations so UI is testable
        const mockToAdd = __DEV__
          ? MOCK_CONVERSATIONS.filter((m) => !conversationsWithUsers.some((r) => r.id === m.id))
          : [];
        const result = [...conversationsWithUsers, ...mockToAdd];
        set({ conversations: result });
        try {
          await replaceCachedConversations(userId, result);
        } catch (e) {
          console.warn('[chat-cache] replaceCachedConversations failed:', e);
        }
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

    const cachedMessages = await getCachedMessages(conversationId);
    if (cachedMessages.length > 0) {
      set((state) => ({
        messages: { ...state.messages, [conversationId]: cachedMessages },
      }));
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[fetchMessages]', conversationId, error.message);
      return;
    }
    if (data !== null && data !== undefined) {
      const rows = data as Message[];
      set((state) => ({
        messages: { ...state.messages, [conversationId]: rows },
      }));
      try {
        await replaceCachedMessages(conversationId, rows);
      } catch (e) {
        console.warn('[chat-cache] fetchMessages persist failed:', e);
      }
    }
  },

  sendMessage: async (conversationId, senderId, content, senderName = 'Someone') => {
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
      return { error: null };
    }

    const { user: authUser, settings: authSettings } = useAuthStore.getState();
    const isOwnAccount = authUser?.id === senderId;

    if (isOwnAccount && authSettings?.receive_messages === false) {
      return { error: ERROR_SENDER_MESSAGES_DISABLED };
    }

    if (isOwnAccount) {
      const { data: ownSettings } = await supabase
        .from('user_settings')
        .select('receive_messages')
        .eq('user_id', senderId)
        .maybeSingle();
      if (ownSettings && ownSettings.receive_messages === false) {
        return { error: ERROR_SENDER_MESSAGES_DISABLED };
      }
    } else {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('accepts_messages')
        .eq('id', senderId)
        .maybeSingle();
      if (senderProfile && senderProfile.accepts_messages === false) {
        return { error: ERROR_SENDER_MESSAGES_DISABLED };
      }
    }

    let recipientId = get().conversations.find((c) => c.id === conversationId)?.participant_ids
      ?.find((pid) => pid !== senderId);
    if (!recipientId) {
      const { data: convRow } = await supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .maybeSingle();
      recipientId = convRow?.participant_ids?.find((pid: string) => pid !== senderId);
    }

    if (recipientId) {
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('accepts_messages')
        .eq('id', recipientId)
        .maybeSingle();
      if (recipientProfile && recipientProfile.accepts_messages === false) {
        return { error: ERROR_RECIPIENT_MESSAGES_DISABLED };
      }
    }

    // ━━ Optimistic UI: show message instantly before DB confirms ━━
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      listKey: tempId,
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), tempMsg],
      },
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, last_message: content, last_message_at: tempMsg.created_at }
          : c
      ),
    }));
    enqueueReplaceCachedMessages(conversationId, get().messages[conversationId] ?? []);

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select()
      .single();

    if (error || !data) {
      console.error('[sendMessage] insert failed:', error?.message, '| code:', error?.code, '| details:', error?.details, '| hint:', error?.hint);
      // Roll back optimistic message
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] ?? []).filter((m) => m.id !== tempId),
        },
      }));
      enqueueReplaceCachedMessages(
        conversationId,
        (get().messages[conversationId] ?? []).filter((m) => m.id !== tempId),
      );
      const mapped = mapMessagesInsertError(error);
      if (mapped) return { error: mapped };
      return { error: error?.message ?? 'Failed to send message' };
    }

    // Replace temp with confirmed message in-place; keep listKey so FlatList row does not remount.
    const confirmed: Message = { ...(data as Message), listKey: tempId };
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map(
          (m) => m.id === tempId ? confirmed : m
        ),
      },
    }));
    enqueueReplaceCachedMessages(conversationId, get().messages[conversationId] ?? []);

    // Update conversation last_message (participants can update — see migration)
    const { error: convErr } = await supabase
      .from('conversations')
      .update({ last_message: content, last_message_at: data.created_at })
      .eq('id', conversationId);
    if (convErr) console.error('[sendMessage] conversation update:', convErr.message);

    if (recipientId) {
      notifyUser({ type: 'message', recipientId, senderId, senderName, extra: { conversationId } });
    }

    return { error: null };
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
      .maybeSingle();

    if (existing) return existing.id;

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ participant_ids: [userId, otherUserId] })
      .select('id')
      .single();

    return newConv?.id ?? null;
  },

  deleteConversation: async (conversationId) => {
    // Optimistic: remove instantly from local state
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([id]) => id !== conversationId),
      ),
    }));
    if (conversationId.startsWith('mock-')) return;
    try {
      await clearCachedMessages(conversationId);
    } catch (e) {
      console.warn('[chat-cache] clearCachedMessages failed:', e);
    }
    // Delete messages first (FK constraint), then conversation
    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);
  },

  deleteMessage: async (conversationId, messageId) => {
    // Remove from local state immediately
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).filter((m) => m.id !== messageId),
      },
    }));
    enqueueReplaceCachedMessages(
      conversationId,
      (get().messages[conversationId] ?? []).filter((m) => m.id !== messageId),
    );
    // Skip DB call for mock messages
    if (messageId.startsWith('mm-') || conversationId.startsWith('mock-')) return;
    await supabase.from('messages').delete().eq('id', messageId);
  },

  markMessagesRead: async (conversationId, userId) => {
    const readAt = new Date().toISOString();
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      ),
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map((message) =>
          message.sender_id !== userId && !message.read_at
            ? { ...message, read_at: readAt }
            : message
        ),
      },
    }));
    enqueueReplaceCachedMessages(conversationId, get().messages[conversationId] ?? []);
    if (conversationId.startsWith('mock-')) return;
    await supabase
      .from('messages')
      .update({ read_at: readAt })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', userId);
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const list = state.messages[conversationId] ?? [];
      if (list.some((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...list, message],
        },
      };
    });
  },
}));

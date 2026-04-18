import { create } from 'zustand';
import { Conversation, Message, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import {
  clearCachedMessages,
  getCachedConversationSnapshot,
  getCachedMessages,
  replaceCachedConversations,
  replaceCachedMessages,
  enqueueReplaceCachedMessages,
} from '@/lib/chat-cache';
import { useAuthStore } from '@/store/auth.store';
import { moderateMessage } from '@/lib/moderation';
import { maybeWarnMessageQuota } from '@/lib/rate-limit-warn';
import { track, EVENTS } from '@/lib/analytics';

/** Parallel callers await the same in-flight work (tab layout + messages tab + focus). */
const fetchConversationsPending = new Map<string, Promise<void>>();
const fetchMessagesPending = new Map<string, Promise<void>>();
const loadOlderPending = new Map<string, Promise<void>>();

/**
 * How many messages we pull per page from the server. The chat screen never
 * needs more than this on first paint — anything older is fetched on demand
 * when the user scrolls toward the top of the thread.
 */
export const MESSAGE_PAGE_SIZE = 50;

/**
 * Cap on how many messages we persist to SQLite per conversation. Keeps the
 * cache file small for very long threads while still giving us a generous
 * offline window.
 */
export const MESSAGE_CACHE_LIMIT = 200;

function tailForCache(messages: Message[]): Message[] {
  return messages.length > MESSAGE_CACHE_LIMIT
    ? messages.slice(messages.length - MESSAGE_CACHE_LIMIT)
    : messages;
}

/** Shown to the sender when the recipient has turned off receiving messages. */
export const ERROR_RECIPIENT_MESSAGES_DISABLED =
  'This person has turned off receiving messages in their settings.';

/** Shown when your own Receive messages is off (nothing in or out until you turn it on). */
export const ERROR_SENDER_MESSAGES_DISABLED =
  'Your messages are turned off. Open Settings → Privacy and turn on Receive messages to send.';

/** Shown when a message is flagged by the local moderation filter. */
export const ERROR_MESSAGE_MODERATION =
  'This message looks inappropriate. Please rephrase it.';

/** Raised when the DB-level rate-limit trigger fires. */
export const ERROR_MESSAGE_RATE_LIMIT_HOUR =
  'You\u2019re sending messages too fast. Please wait a bit and try again.';
export const ERROR_MESSAGE_RATE_LIMIT_DAY =
  'You\u2019ve reached today\u2019s message limit. Please try again tomorrow.';

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
  const blob = pgErrorBlob(err);
  if (blob.includes('rate_limit:messages:hour')) return ERROR_MESSAGE_RATE_LIMIT_HOUR;
  if (blob.includes('rate_limit:messages:day')) return ERROR_MESSAGE_RATE_LIMIT_DAY;
  return null;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  /** True while we still believe there are older messages on the server. */
  hasMoreMessages: Record<string, boolean>;
  /** True while a `loadOlderMessages` request is in flight for this conversation. */
  loadingOlderMessages: Record<string, boolean>;
  isLoading: boolean;
  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string, senderName?: string) => Promise<{ error: string | null }>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  getOrCreateConversation: (userId: string, otherUserId: string) => Promise<string | null>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
  applyMessageUpdate: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  hasMoreMessages: {},
  loadingOlderMessages: {},
  isLoading: false,

  fetchConversations: async (userId) => {
    const existing = fetchConversationsPending.get(userId);
    if (existing) {
      await existing;
      return;
    }

    const run = async () => {
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

          set({ conversations: conversationsWithUsers });
          try {
            await replaceCachedConversations(userId, conversationsWithUsers);
          } catch (e) {
            console.warn('[chat-cache] replaceCachedConversations failed:', e);
          }

          // Pre-warm the per-conversation message cache in the background so
          // tapping into a thread paints instantly instead of waiting for the
          // SQLite read + network round-trip to finish from a cold state.
          // Skip threads we already have in memory (don't overwrite fresher
          // data), and run inside requestIdleCallback-equivalent so it never
          // competes with the conversations list paint.
          const idsNeedingWarmup = conversationIds.filter(
            (id) => (get().messages[id]?.length ?? 0) === 0,
          );
          if (idsNeedingWarmup.length > 0) {
            void (async () => {
              for (const id of idsNeedingWarmup) {
                try {
                  const cached = await getCachedMessages(id);
                  if (cached.length === 0) continue;
                  if ((get().messages[id]?.length ?? 0) > 0) continue;
                  set((state) => ({
                    messages: { ...state.messages, [id]: cached },
                  }));
                } catch {
                  // best-effort; tapping in will fall back to the cold path
                }
              }
            })();
          }
        }
      } finally {
        set({ isLoading: false });
      }
    };

    const p = run();
    fetchConversationsPending.set(userId, p);
    try {
      await p;
    } finally {
      if (fetchConversationsPending.get(userId) === p) fetchConversationsPending.delete(userId);
    }
  },

  fetchMessages: async (conversationId) => {
    const existing = fetchMessagesPending.get(conversationId);
    if (existing) {
      await existing;
      return;
    }

    const run = async () => {
      // Seed-and-refresh: paint cached messages to the screen immediately so
      // the conversation appears instantly, then reconcile with the network.
      // Only seed if we don't already have this conversation in memory — we
      // don't want to overwrite a fresher in-memory state with stale cache.
      const alreadyInMemory = (get().messages[conversationId]?.length ?? 0) > 0;
      const cachedPromise = alreadyInMemory
        ? Promise.resolve<Message[]>([])
        : getCachedMessages(conversationId).then((cached) => {
            if (cached.length > 0 && (get().messages[conversationId]?.length ?? 0) === 0) {
              set((state) => ({
                messages: { ...state.messages, [conversationId]: cached },
              }));
            }
            return cached;
          });

      // Pull only the most recent page from the server. For long-running
      // threads this used to download the entire history (could be thousands
      // of rows) on every chat open; now it's a fixed-size, fast query and
      // older messages page in on scroll.
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      // Make sure the cache-seed task has finished before returning, so a
      // short-lived offline start still shows cached messages.
      const cachedMessages = await cachedPromise;

      if (error) {
        console.error('[fetchMessages]', conversationId, error.message);
        if (cachedMessages.length > 0 && (get().messages[conversationId]?.length ?? 0) === 0) {
          set((state) => ({
            messages: { ...state.messages, [conversationId]: cachedMessages },
          }));
        }
        return;
      }
      if (data !== null && data !== undefined) {
        // Server returned newest→oldest; flip back to chronological for the UI.
        const rows = (data as Message[]).slice().reverse();
        const hasMore = (data as Message[]).length === MESSAGE_PAGE_SIZE;

        // Preserve any optimistic messages that are newer than the page we
        // just fetched (e.g. a temp-id message the user sent while offline).
        const previous = get().messages[conversationId] ?? [];
        const newestServerTs = rows.length > 0 ? rows[rows.length - 1].created_at : null;
        const trailingOptimistic = previous.filter(
          (m) =>
            m.id.startsWith('temp-') &&
            (!newestServerTs || m.created_at > newestServerTs),
        );
        const merged = trailingOptimistic.length > 0 ? [...rows, ...trailingOptimistic] : rows;

        set((state) => ({
          messages: { ...state.messages, [conversationId]: merged },
          hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: hasMore },
        }));
        try {
          await replaceCachedMessages(conversationId, tailForCache(merged));
        } catch (e) {
          console.warn('[chat-cache] fetchMessages persist failed:', e);
        }
      }
    };

    const p = run();
    fetchMessagesPending.set(conversationId, p);
    try {
      await p;
    } finally {
      if (fetchMessagesPending.get(conversationId) === p) fetchMessagesPending.delete(conversationId);
    }
  },

  loadOlderMessages: async (conversationId) => {
    if (!conversationId) return;
    const existing = loadOlderPending.get(conversationId);
    if (existing) {
      await existing;
      return;
    }
    if (get().hasMoreMessages[conversationId] === false) return;

    const current = get().messages[conversationId] ?? [];
    // Anchor on the oldest non-optimistic message — temp ids don't have a
    // real server timestamp we can compare against.
    const oldestReal = current.find((m) => !m.id.startsWith('temp-'));
    if (!oldestReal) return;

    const run = async () => {
      set((state) => ({
        loadingOlderMessages: { ...state.loadingOlderMessages, [conversationId]: true },
      }));
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .lt('created_at', oldestReal.created_at)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_PAGE_SIZE);

        if (error) {
          console.error('[loadOlderMessages]', conversationId, error.message);
          return;
        }
        const older = ((data ?? []) as Message[]).slice().reverse();
        const hasMore = (data ?? []).length === MESSAGE_PAGE_SIZE;

        if (older.length === 0) {
          set((state) => ({
            hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: false },
          }));
          return;
        }

        const existingIds = new Set(current.map((m) => m.id));
        const deduped = older.filter((m) => !existingIds.has(m.id));
        const next = [...deduped, ...(get().messages[conversationId] ?? [])];

        set((state) => ({
          messages: { ...state.messages, [conversationId]: next },
          hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: hasMore },
        }));
        try {
          await replaceCachedMessages(conversationId, tailForCache(next));
        } catch (e) {
          console.warn('[chat-cache] loadOlderMessages persist failed:', e);
        }
      } finally {
        set((state) => ({
          loadingOlderMessages: { ...state.loadingOlderMessages, [conversationId]: false },
        }));
      }
    };

    const p = run();
    loadOlderPending.set(conversationId, p);
    try {
      await p;
    } finally {
      if (loadOlderPending.get(conversationId) === p) loadOlderPending.delete(conversationId);
    }
  },

  sendMessage: async (conversationId, senderId, content, senderName = 'Someone') => {
    const moderation = moderateMessage(content);
    if (!moderation.ok) {
      return { error: ERROR_MESSAGE_MODERATION };
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
    enqueueReplaceCachedMessages(conversationId, tailForCache(get().messages[conversationId] ?? []));

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
        tailForCache((get().messages[conversationId] ?? []).filter((m) => m.id !== tempId)),
      );
      const mapped = mapMessagesInsertError(error);
      if (mapped) {
        const isHour = mapped === ERROR_MESSAGE_RATE_LIMIT_HOUR;
        track(EVENTS.RATE_LIMIT_HIT, { topic: 'messages', window: isHour ? 'hour' : 'day' });
        return { error: mapped };
      }
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
    enqueueReplaceCachedMessages(conversationId, tailForCache(get().messages[conversationId] ?? []));

    // Update conversation last_message (participants can update — see migration)
    const { error: convErr } = await supabase
      .from('conversations')
      .update({ last_message: content, last_message_at: data.created_at })
      .eq('id', conversationId);
    if (convErr) console.error('[sendMessage] conversation update:', convErr.message);

    if (recipientId) {
      notifyUser({ type: 'message', recipientId, senderId, senderName, extra: { conversationId } });
    }

    track(EVENTS.MESSAGE_SENT);

    // Fire-and-forget soft warning when approaching the per-hour/day cap.
    void maybeWarnMessageQuota();

    return { error: null };
  },

  getOrCreateConversation: async (userId, otherUserId) => {
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
      tailForCache((get().messages[conversationId] ?? []).filter((m) => m.id !== messageId)),
    );
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
    enqueueReplaceCachedMessages(conversationId, tailForCache(get().messages[conversationId] ?? []));
    // Persist the zeroed unread count so a cold start doesn't revive the badge
    // from a stale cached snapshot before the live fetch lands.
    try {
      await replaceCachedConversations(userId, get().conversations);
    } catch (e) {
      console.warn('[chat-cache] markMessagesRead persist failed:', e);
    }
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

  // Patches an existing cached message in place. Used by the realtime UPDATE
  // listener so that read-receipts (read_at) and edits flip without a full
  // re-fetch — that's why "Seen" used to only appear after closing/reopening
  // the conversation.
  applyMessageUpdate: (conversationId, message) => {
    set((state) => {
      const list = state.messages[conversationId];
      if (!list || list.length === 0) return state;
      let changed = false;
      const next = list.map((m) => {
        if (m.id !== message.id) return m;
        if (m.read_at === message.read_at && m.content === message.content) return m;
        changed = true;
        return { ...m, ...message };
      });
      if (!changed) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: next,
        },
      };
    });
    enqueueReplaceCachedMessages(
      conversationId,
      tailForCache(get().messages[conversationId] ?? []),
    );
  },
}));

/** Read chat state outside of render (layout effects, async). Not a hook — avoids `useChatStore` being mistaken for a hook call mid-file. */
export function getChatStoreState(): ChatState {
  return useChatStore.getState();
}

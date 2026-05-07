import { create } from 'zustand';
import type { ChatStoreState } from '@/store/chat-store.types';
import { Conversation, Message, User } from '@/types';
import { PROFILE_LIST_SELECT } from '@/constants/profile-select';
import { supabase } from '@/lib/supabase';
import { notifyLifecycleEmail, notifyUser } from '@/lib/notifications';
import {
  clearCachedMessages,
  deleteCachedConversation,
  getCachedConversationSnapshot,
  getCachedMessages,
  replaceCachedConversations,
  replaceCachedMessages,
  enqueueReplaceCachedMessages,
} from '@/lib/chat-cache';
import { useAuthStore } from '@/store/auth.store';
import { hasSymmetricBlockBetween } from '@/lib/block-queries';
import { moderateMessage } from '@/lib/moderation';
import { maybeWarnMessageQuota } from '@/lib/rate-limit-warn';
import { track, EVENTS } from '@/lib/analytics';
import { logError, logWarn } from '@/lib/logger';
import {
  mapMessagesInsertError,
  ERROR_MESSAGE_RATE_LIMIT_HOUR,
  ERROR_MESSAGE_RATE_LIMIT_DAY,
  ERROR_MESSAGE_MODERATION,
  ERROR_SENDER_MESSAGES_DISABLED,
} from '@/lib/message-insert-errors';

export {
  ERROR_RECIPIENT_MESSAGES_DISABLED,
  ERROR_SENDER_MESSAGES_DISABLED,
  ERROR_MESSAGE_MODERATION,
  ERROR_MESSAGE_RATE_LIMIT_HOUR,
  ERROR_MESSAGE_RATE_LIMIT_DAY,
  ERROR_MESSAGING_BLOCKED,
} from '@/lib/message-insert-errors';

/** Parallel callers await the same in-flight work (tab layout + messages tab + focus). */
const fetchConversationsPending = new Map<string, Promise<void>>();
const fetchMessagesPending = new Map<string, Promise<void>>();
const loadOlderPending = new Map<string, Promise<void>>();
/** O(1) duplicate guard for addMessage — keyed by conversationId. */
const messageIdSets = new Map<string, Set<string>>();

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

export type { ChatStoreState } from '@/store/chat-store.types';

export const useChatStore = create<ChatStoreState>((set, get) => ({
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
        const [{ data, error }, hiddenRes] = await Promise.all([
          supabase
            .from('conversations')
            .select('*')
            .contains('participant_ids', [userId])
            .order('last_message_at', { ascending: false, nullsFirst: false }),
          supabase.from('conversation_hidden').select('conversation_id').eq('user_id', userId),
        ]);

        if (error) {
          logError('[fetchConversations] failed to load conversations', error);
          // Keep whatever was already in state (cache-seeded or stale); just hide the spinner.
          // Callers can show their own refresh-to-retry UI using the exposed isLoading flag.
        } else if (data) {
          const hiddenIds = new Set((hiddenRes.data ?? []).map((r) => r.conversation_id));
          const visible = data.filter((c) => !hiddenIds.has(c.id));
          const conversationIds = visible.map((conv) => conv.id);
          const otherUserIds = Array.from(
            new Set(
              visible
                .map((conv) => conv.participant_ids.find((id: string) => id !== userId))
                .filter(Boolean)
            )
          ) as string[];

          const [profilesResult, unreadResult] = await Promise.all([
            otherUserIds.length > 0
              ? supabase.from('profiles').select(PROFILE_LIST_SELECT as '*').in('id', otherUserIds)
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

          const conversationsWithUsers = visible.map((conv) => {
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
            logWarn('[chat-cache] replaceCachedConversations failed', e);
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
        logError('[fetchMessages] failed', { conversationId, error });
        if (cachedMessages.length > 0 && (get().messages[conversationId]?.length ?? 0) === 0) {
          set((state) => ({
            messages: { ...state.messages, [conversationId]: cachedMessages },
          }));
        }
        return;
      }
      if (data !== null && data !== undefined) {
      const userId = useAuthStore.getState().user?.id;

      // Server returns newest→oldest; flip back to chronological for the UI.
      // Also strip out any messages the current user has soft-deleted.
      const rawRows = (data as Message[]).slice().reverse();
      const rows = userId
        ? rawRows.filter((m) => !(m.deleted_for ?? []).includes(userId))
        : rawRows;
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
          logWarn('[chat-cache] fetchMessages persist failed', e);
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
          logError('[loadOlderMessages] failed', { conversationId, error });
          return;
        }
        const rawOlder = ((data ?? []) as Message[]).slice().reverse();
        const userId = useAuthStore.getState().user?.id;
        const older = userId
          ? rawOlder.filter((m) => !(m.deleted_for ?? []).includes(userId))
          : rawOlder;
        const hasMore = (data ?? []).length === MESSAGE_PAGE_SIZE;

        if (older.length === 0) {
          set((state) => ({
            hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: false },
          }));
          return;
        }

        const existingIds = new Set((get().messages[conversationId] ?? []).map((m) => m.id));
        const deduped = older.filter((m) => !existingIds.has(m.id));
        const next = [...deduped, ...(get().messages[conversationId] ?? [])];

        set((state) => ({
          messages: { ...state.messages, [conversationId]: next },
          hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: hasMore },
        }));
        try {
          await replaceCachedMessages(conversationId, tailForCache(next));
        } catch (e) {
          logWarn('[chat-cache] loadOlderMessages persist failed', e);
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

    // ━━ Optimistic UI: show message instantly BEFORE any network calls ━━
    // Pre-flight checks (recipient prefs, block status) are enforced server-side
    // by DB triggers anyway. Doing the optimistic insert first means the bubble
    // appears in <1ms instead of after 200–600ms of pre-flight round-trips.
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
    // Snapshot the current last_message so we can roll it back on failure
    const previousConvLastMessage = get().conversations.find((c) => c.id === conversationId)?.last_message ?? null;
    const previousConvLastMessageAt = get().conversations.find((c) => c.id === conversationId)?.last_message_at ?? null;
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

    let recipientId = get().conversations.find((c) => c.id === conversationId)?.participant_ids?.find(
      (pid) => pid !== senderId,
    );
    if (!recipientId) {
      const { data: convRow } = await supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .maybeSingle();
      recipientId = convRow?.participant_ids?.find((pid: string) => pid !== senderId);
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select()
      .single();

    if (error || !data) {
      logError('[sendMessage] insert failed', error);
      // Roll back optimistic message AND last_message preview in inbox
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] ?? []).filter((m) => m.id !== tempId),
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, last_message: previousConvLastMessage, last_message_at: previousConvLastMessageAt }
            : c
        ),
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

    // DB trigger `sync_conversation_last_message` keeps `conversations.last_message*` in sync.

    if (recipientId) {
      void notifyUser({ type: 'message', recipientId, senderId, senderName, extra: { conversationId } });
      void notifyLifecycleEmail({
        campaign: 'first_message',
        recipientId,
        senderName,
        extra: { conversationId },
      });
    }

    track(EVENTS.MESSAGE_SENT);

    // Fire-and-forget soft warning when approaching the per-hour/day cap.
    void maybeWarnMessageQuota();

    return { error: null };
  },

  getOrCreateConversation: async (userId, otherUserId) => {
    if (await hasSymmetricBlockBetween(userId, otherUserId)) {
      return { ok: false, reason: 'blocked' };
    }

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .contains('participant_ids', [userId, otherUserId])
      .maybeSingle();

    if (existing?.id) return { ok: true, conversationId: existing.id };

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ participant_ids: [userId, otherUserId] })
      .select('id')
      .single();

    if (error || !newConv?.id) {
      return { ok: false, reason: 'error' };
    }
    return { ok: true, conversationId: newConv.id };
  },

  deleteConversation: async (conversationId) => {
    // Snapshot for rollback
    const previousConversations = get().conversations;
    const previousMessages = get().messages;

    // Get user id for cache deletion using the auth store (avoids async getUser() call)
    const userId = useAuthStore.getState().user?.id;

    // Optimistic: remove instantly from local state
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([id]) => id !== conversationId),
      ),
    }));
    try {
      await clearCachedMessages(conversationId);
      if (userId) {
        await deleteCachedConversation(userId, conversationId);
      }
    } catch (e) {
      logWarn('[chat-cache] delete cache failed', e);
    }

    if (!userId) {
      set({ conversations: previousConversations, messages: previousMessages });
      throw new Error('Not authenticated');
    }

    const { error: hideErr } = await supabase.from('conversation_hidden').upsert(
      { user_id: userId, conversation_id: conversationId },
      { onConflict: 'user_id,conversation_id' },
    );
    if (hideErr) {
      logError('[deleteConversation] Failed to hide conversation', hideErr);
      set({ conversations: previousConversations, messages: previousMessages });
      throw hideErr;
    }
  },

  deleteMessage: async (conversationId, messageId) => {
    const currentMessages = get().messages[conversationId] ?? [];
    const isLast = currentMessages.length > 0 && currentMessages[currentMessages.length - 1].id === messageId;

    // Hard delete: remove row for everyone (sender-only via RLS).
    const updatedMessages = currentMessages.filter((m) => m.id !== messageId);

    set((state) => {
      let nextConversations = state.conversations;
      if (isLast) {
        const newLast = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
        nextConversations = state.conversations.map(c =>
          c.id === conversationId
            ? { ...c, last_message: newLast ? newLast.content : null, last_message_at: newLast ? newLast.created_at : null }
            : c
        );
      }
      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: nextConversations,
      };
    });

    enqueueReplaceCachedMessages(
      conversationId,
      tailForCache(updatedMessages),
    );

    await supabase.from('messages').delete().eq('id', messageId);

    if (isLast) {
      const newLast = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
      await supabase.from('conversations').update({
        last_message: newLast ? newLast.content : null,
        last_message_at: newLast ? newLast.created_at : null,
      }).eq('id', conversationId);
    }
  },

  softDeleteMessageForSelf: async (conversationId, messageId) => {
    const currentMessages = get().messages[conversationId] ?? [];
    const isLast = currentMessages.length > 0 && currentMessages[currentMessages.length - 1].id === messageId;

    // Optimistic local removal.
    const updatedMessages = currentMessages.filter((m) => m.id !== messageId);
    set((state) => {
      let nextConversations = state.conversations;
      if (isLast) {
        const newLast = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
        nextConversations = state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, last_message: newLast ? newLast.content : null, last_message_at: newLast ? newLast.created_at : null }
            : c,
        );
      }
      return {
        messages: { ...state.messages, [conversationId]: updatedMessages },
        conversations: nextConversations,
      };
    });

    enqueueReplaceCachedMessages(conversationId, tailForCache(updatedMessages));

    // Server-side soft delete. (RPC verifies participant membership.)
    await supabase.rpc('soft_delete_message_for_self', { p_message_id: messageId });

    // If we removed the last message, recompute the conversation preview.
    if (isLast) {
      const newLast = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
      await supabase
        .from('conversations')
        .update({
          last_message: newLast ? newLast.content : null,
          last_message_at: newLast ? newLast.created_at : null,
        })
        .eq('id', conversationId);
    }
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
    // Persist only the zeroed-unread conversation so a cold start doesn't revive
    // the badge from a stale snapshot — much cheaper than re-writing ALL convos.
    const updatedConv = get().conversations.find((c) => c.id === conversationId);
    if (updatedConv) {
      const currentSnapshot = get().conversations;
      try {
        await replaceCachedConversations(userId, currentSnapshot);
      } catch (e) {
        logWarn('[chat-cache] markMessagesRead persist failed', e);
      }
    }
    await supabase
      .from('messages')
      .update({ read_at: readAt })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', userId);
  },

  addMessage: (conversationId, message) => {
    // O(1) duplicate check using a Set, avoiding O(n) Array.some() on long threads
    const idSet = messageIdSets.get(conversationId) ?? new Set<string>();
    if (idSet.has(message.id)) return;
    idSet.add(message.id);
    messageIdSets.set(conversationId, idSet);

    set((state) => {
      const list = state.messages[conversationId] ?? [];
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
        const sameDeleted =
          JSON.stringify(m.deleted_for ?? []) === JSON.stringify(message.deleted_for ?? []);
        if (m.read_at === message.read_at && m.content === message.content && sameDeleted) return m;
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

  // Drops a message from local state. Used by the realtime DELETE listener so
  // a peer's "delete for everyone" reflects without requiring a manual refresh.
  // Idempotent: a no-op if the message isn't currently cached (e.g. already
  // pruned by the local optimistic delete on the sender's side).
  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const list = state.messages[conversationId];
      if (!list || list.length === 0) return state;
      const next = list.filter((m) => m.id !== messageId);
      if (next.length === list.length) return state;
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
export function getChatStoreState(): ChatStoreState {
  return useChatStore.getState();
}

/** Clears module-level dedupe maps and in-memory chat state on logout. */
export function resetChatModuleStateAtLogout(): void {
  fetchConversationsPending.clear();
  fetchMessagesPending.clear();
  loadOlderPending.clear();
  messageIdSets.clear();
  useChatStore.setState({
    conversations: [],
    messages: {},
    hasMoreMessages: {},
    loadingOlderMessages: {},
    isLoading: false,
  });
}

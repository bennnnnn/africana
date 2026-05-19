import type { Conversation, Message } from '@/types';

// ── LRU-capped in-memory stores ──────────────────────────────────────────────
// Without a cap these Maps grow for the entire browser-tab lifetime: every
// conversation the user opens accumulates its full message list in memory and
// is never evicted.  On low-RAM mobile browsers (PWA) the OS eventually kills
// the tab.  We keep the 30 most-recently-accessed entries per store and evict
// the oldest on overflow.
const MAX_ENTRIES = 30;

function lruSet<V>(map: Map<string, V>, key: string, value: V): void {
  if (map.has(key)) map.delete(key); // refresh recency
  map.set(key, value);
  if (map.size > MAX_ENTRIES) {
    // Map preserves insertion order; first key is the oldest
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}

const conversationSnapshotStore = new Map<string, Conversation[]>();
const conversationStore = new Map<string, Conversation[]>();
const messageStore = new Map<string, Message[]>();

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    unread_count: conversation.unread_count ?? 0,
  };
}

function normalizeMessage(message: Message): Message {
  return {
    ...message,
    edited_at: message.edited_at ?? null,
    reactions: message.reactions ?? [],
  };
}

export async function getCachedConversations(userId: string): Promise<Conversation[]> {
  return (conversationStore.get(userId) ?? []).map(normalizeConversation);
}

export async function getCachedConversationSnapshot(
  userId: string,
): Promise<{ found: boolean; conversations: Conversation[] }> {
  const conversations = conversationSnapshotStore.get(userId) ?? [];
  return {
    found: conversationSnapshotStore.has(userId),
    conversations: conversations.map(normalizeConversation),
  };
}

export async function patchCachedConversationUnread(
  userId: string,
  conversationId: string,
  unreadCount: number,
): Promise<void> {
  const snapshot = conversationSnapshotStore.get(userId);
  if (snapshot) {
    const next = snapshot.map((c) =>
      c.id === conversationId ? { ...c, unread_count: unreadCount } : c,
    );
    lruSet(conversationSnapshotStore, userId, next);
    lruSet(conversationStore, userId, next);
  }
}

export async function replaceCachedConversations(
  userId: string,
  conversations: Conversation[],
): Promise<void> {
  const next = conversations.map(normalizeConversation);
  lruSet(conversationSnapshotStore, userId, next);
  lruSet(conversationStore, userId, next);
}

export async function deleteCachedConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  // Remove from snapshot store
  const snapshot = conversationSnapshotStore.get(userId);
  if (snapshot) {
    const filtered = snapshot.filter((c) => c.id !== conversationId);
    lruSet(conversationSnapshotStore, userId, filtered);
  }
  // Remove from conversation store
  const convs = conversationStore.get(userId);
  if (convs) {
    const filtered = convs.filter((c) => c.id !== conversationId);
    lruSet(conversationStore, userId, filtered);
  }
  // Remove message cache for this conversation
  messageStore.delete(conversationId);
}

export async function getCachedMessages(conversationId: string): Promise<Message[]> {
  return (messageStore.get(conversationId) ?? []).map(normalizeMessage);
}

export async function replaceCachedMessages(
  conversationId: string,
  messages: Message[],
): Promise<void> {
  lruSet(messageStore, conversationId, messages.map(normalizeMessage));
}

export async function clearCachedMessages(conversationId: string): Promise<void> {
  messageStore.delete(conversationId);
}

export function enqueueReplaceCachedMessages(conversationId: string, messages: Message[]): void {
  void replaceCachedMessages(conversationId, messages).catch((e) => {
    console.warn('[chat-cache] replaceCachedMessages failed:', e);
  });
}

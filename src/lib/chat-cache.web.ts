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

/* All 8 functions in this file are dead — no imports exist anywhere in the codebase.
   The native (expo-sqlite) implementation in chat-cache.ts is used instead. */

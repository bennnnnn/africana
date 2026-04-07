import * as SQLite from 'expo-sqlite';
import type { Conversation, Message } from '@/types';

type CachedPayloadRow = {
  payload: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('africana-cache.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cached_conversations (
          user_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          sort_timestamp TEXT,
          payload TEXT NOT NULL,
          PRIMARY KEY (user_id, conversation_id)
        );
        CREATE TABLE IF NOT EXISTS cached_conversation_snapshots (
          user_id TEXT NOT NULL PRIMARY KEY,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cached_messages (
          conversation_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (conversation_id, message_id)
        );
        CREATE INDEX IF NOT EXISTS idx_cached_conversations_user_sort
          ON cached_conversations (user_id, sort_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_cached_messages_conversation_created
          ON cached_messages (conversation_id, created_at ASC);
      `);
      return db;
    });
  }

  return dbPromise;
}

function serializeConversation(conversation: Conversation): string {
  return JSON.stringify({
    ...conversation,
    unread_count: conversation.unread_count ?? 0,
  });
}

function serializeMessage(message: Message): string {
  return JSON.stringify({
    ...message,
    reactions: message.reactions ?? [],
  });
}

function safeParseConversation(payload: string): Conversation | null {
  try {
    const parsed = JSON.parse(payload) as Conversation;
    return {
      ...parsed,
      unread_count: parsed.unread_count ?? 0,
    };
  } catch {
    return null;
  }
}

function safeParseMessage(payload: string): Message | null {
  try {
    const parsed = JSON.parse(payload) as Message;
    return {
      ...parsed,
      edited_at: parsed.edited_at ?? null,
      reactions: parsed.reactions ?? [],
    };
  } catch {
    return null;
  }
}

export async function getCachedConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<CachedPayloadRow>(
    `SELECT payload
     FROM cached_conversations
     WHERE user_id = ?
     ORDER BY CASE WHEN sort_timestamp IS NULL OR sort_timestamp = '' THEN 1 ELSE 0 END, sort_timestamp DESC`,
    userId,
  );

  return rows
    .map((row) => safeParseConversation(row.payload))
    .filter((conversation): conversation is Conversation => !!conversation);
}

export async function getCachedConversationSnapshot(
  userId: string,
): Promise<{ found: boolean; conversations: Conversation[] }> {
  if (!userId) return { found: false, conversations: [] };
  const db = await getDb();
  const row = await db.getFirstAsync<CachedPayloadRow>(
    `SELECT payload
     FROM cached_conversation_snapshots
     WHERE user_id = ?`,
    userId,
  );

  if (!row?.payload) {
    return { found: false, conversations: [] };
  }

  try {
    const parsed = JSON.parse(row.payload) as Conversation[];
    return {
      found: true,
      conversations: parsed.map((conversation) => ({
        ...conversation,
        unread_count: conversation.unread_count ?? 0,
      })),
    };
  } catch {
    return { found: false, conversations: [] };
  }
}

export async function replaceCachedConversations(userId: string, conversations: Conversation[]): Promise<void> {
  if (!userId) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_conversation_snapshots (user_id, payload)
       VALUES (?, ?)`,
      userId,
      JSON.stringify(conversations),
    );
    await db.runAsync('DELETE FROM cached_conversations WHERE user_id = ?', userId);

    for (const conversation of conversations) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_conversations (user_id, conversation_id, sort_timestamp, payload)
         VALUES (?, ?, ?, ?)`,
        userId,
        conversation.id,
        conversation.last_message_at ?? conversation.created_at ?? null,
        serializeConversation(conversation),
      );
    }
  });
}

export async function getCachedMessages(conversationId: string): Promise<Message[]> {
  if (!conversationId) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<CachedPayloadRow>(
    `SELECT payload
     FROM cached_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC`,
    conversationId,
  );

  return rows
    .map((row) => safeParseMessage(row.payload))
    .filter((message): message is Message => !!message);
}

export async function replaceCachedMessages(conversationId: string, messages: Message[]): Promise<void> {
  if (!conversationId) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cached_messages WHERE conversation_id = ?', conversationId);

    for (const message of messages) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_messages (conversation_id, message_id, created_at, payload)
         VALUES (?, ?, ?, ?)`,
        conversationId,
        message.id,
        message.created_at,
        serializeMessage(message),
      );
    }
  });
}

export async function clearCachedMessages(conversationId: string): Promise<void> {
  if (!conversationId) return;
  const db = await getDb();
  await db.runAsync('DELETE FROM cached_messages WHERE conversation_id = ?', conversationId);
}

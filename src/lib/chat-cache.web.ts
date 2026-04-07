import type { Conversation, Message } from '@/types';

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

export async function replaceCachedConversations(userId: string, conversations: Conversation[]): Promise<void> {
  const next = conversations.map(normalizeConversation);
  conversationSnapshotStore.set(userId, next);
  conversationStore.set(userId, next);
}

export async function getCachedMessages(conversationId: string): Promise<Message[]> {
  return (messageStore.get(conversationId) ?? []).map(normalizeMessage);
}

export async function replaceCachedMessages(conversationId: string, messages: Message[]): Promise<void> {
  messageStore.set(conversationId, messages.map(normalizeMessage));
}

export async function clearCachedMessages(conversationId: string): Promise<void> {
  messageStore.delete(conversationId);
}

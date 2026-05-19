import type { Conversation, Message } from '@/types';

export interface ChatStoreState {
  conversations: Conversation[];
  /** O(1) membership check for realtime filters — rebuilt when conversation IDs change. */
  conversationIdSet: Set<string>;
  messages: Record<string, Message[]>;
  /** True while we still believe there are older messages on the server. */
  hasMoreMessages: Record<string, boolean>;
  /** True while a `loadOlderMessages` request is in flight for this conversation. */
  loadingOlderMessages: Record<string, boolean>;
  isLoading: boolean;
  fetchConversations: (userId: string, options?: { force?: boolean }) => Promise<void>; // force bypasses in-flight dedup
  fetchMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    senderId: string,
    content: string,
    senderName?: string,
  ) => Promise<{ error: string | null }>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  /** Delete for me only (soft-delete via `messages.deleted_for`). Works for incoming + outgoing. */
  softDeleteMessageForSelf: (conversationId: string, messageId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  getOrCreateConversation: (
    userId: string,
    otherUserId: string,
  ) => Promise<{ ok: true; conversationId: string } | { ok: false; reason: 'blocked' | 'error' }>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => void;
  applyMessageUpdate: (conversationId: string, message: Message) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
}

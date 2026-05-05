import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { acquireTypingChannel } from '@/lib/typing-channel';
import type { Message } from '@/types';
import type { ReactionEmoji, ReactionsMap } from '@/constants/chat-reactions';

export type ChatTypingChannelRef = MutableRefObject<ReturnType<typeof supabase.channel> | null>;

/**
 * Messages INSERT/UPDATE/DELETE, reactions channel, typing acquire/release,
 * and initial reaction backfill. See inline comments in the chat screen for
 * why channels are split (supabase-js topic dedupe + publication isolation).
 */
export function useChatRealtime(params: {
  conversationId: string | undefined;
  userId: string | undefined;
  messagesIdSetRef: MutableRefObject<Set<string>>;
  peerTypingTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  typingChannelRef: ChatTypingChannelRef;
  addMessage: (conversationId: string, message: Message) => void;
  applyMessageUpdate: (conversationId: string, message: Message) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
  setPeerTyping: (value: boolean) => void;
  setReactions: Dispatch<SetStateAction<ReactionsMap>>;
}): void {
  const {
    conversationId,
    userId,
    messagesIdSetRef,
    peerTypingTimerRef,
    typingChannelRef,
    addMessage,
    applyMessageUpdate,
    removeMessage,
    markMessagesRead,
    setPeerTyping,
    setReactions,
  } = params;

  useEffect(() => {
    if (!conversationId || !userId) return;

    const liveTopic = `chat-live:${conversationId}:${Math.random().toString(36).slice(2, 10)}`;

    const messagesChannel = supabase
      .channel(liveTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id !== userId) {
            if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
            setPeerTyping(false);
            addMessage(conversationId, newMsg);
            markMessagesRead(conversationId, userId);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          applyMessageUpdate(conversationId, updated);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deleted = payload.old as { id?: string } | undefined;
          if (deleted?.id) removeMessage(conversationId, deleted.id);
        },
      )
      .subscribe();

    const reactionsTopic = `chat-reactions:${conversationId}:${Math.random().toString(36).slice(2, 10)}`;
    const reactionsChannel = supabase
      .channel(reactionsTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { message_id: string; user_id: string; emoji: ReactionEmoji }
            | undefined;
          if (!row) return;
          const knownIds = messagesIdSetRef.current;
          if (!knownIds.has(row.message_id)) return;
          setReactions((prev) => {
            const forMsg = { ...(prev[row.message_id] ?? {}) };
            if (payload.eventType === 'DELETE') {
              delete forMsg[row.user_id];
            } else {
              forMsg[row.user_id] = row.emoji;
            }
            return { ...prev, [row.message_id]: forMsg };
          });
        },
      )
      .subscribe();

    const { channel: typingChannel, release: releaseTyping } = acquireTypingChannel(
      conversationId,
      ({ userId: typingUserId }) => {
        if (!typingUserId || typingUserId === userId) return;
        setPeerTyping(true);
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 3000);
      },
    );
    typingChannelRef.current = typingChannel;

    setReactions({});

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji, messages!inner(conversation_id)')
        .eq('messages.conversation_id', conversationId);
      if (cancelled || error || !data) return;
      const next: ReactionsMap = {};
      for (const row of data as unknown as Array<{
        message_id: string;
        user_id: string;
        emoji: ReactionEmoji;
      }>) {
        if (!next[row.message_id]) next[row.message_id] = {};
        next[row.message_id][row.user_id] = row.emoji;
      }
      setReactions(next);
    })();

    return () => {
      cancelled = true;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      peerTypingTimerRef.current = null;
      typingChannelRef.current = null;
      setPeerTyping(false);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reactionsChannel);
      releaseTyping();
    };
  }, [
    conversationId,
    userId,
    addMessage,
    applyMessageUpdate,
    removeMessage,
    markMessagesRead,
    messagesIdSetRef,
    peerTypingTimerRef,
    setPeerTyping,
    setReactions,
    typingChannelRef,
  ]);
}

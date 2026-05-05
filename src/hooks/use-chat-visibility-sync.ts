import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { setActiveConversation } from '@/lib/active-chat';

/** Refetch on foreground + mark active conversation while this screen is focused. */
export function useChatVisibilitySync(
  conversationId: string | undefined,
  userId: string | undefined,
  fetchMessages: (id: string) => Promise<void>,
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>,
): void {
  useEffect(() => {
    if (!conversationId || !userId) return;
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && appStateRef.current !== 'active') {
        void fetchMessages(conversationId);
        void markMessagesRead(conversationId, userId);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [conversationId, fetchMessages, markMessagesRead, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !userId) return;
      void fetchMessages(conversationId);
      setActiveConversation(conversationId);
      return () => {
        setActiveConversation(null);
      };
    }, [conversationId, fetchMessages, userId]),
  );
}

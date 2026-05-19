import { create } from 'zustand';

type InboxTypingState = {
  byConversationId: Record<string, true>;
  setTyping: (conversationId: string, typing: boolean) => void;
  clearAll: () => void;
};

export const useInboxTypingStore = create<InboxTypingState>((set) => ({
  byConversationId: {},
  setTyping: (conversationId, typing) =>
    set((state) => {
      if (typing) {
        if (state.byConversationId[conversationId]) return state;
        return { byConversationId: { ...state.byConversationId, [conversationId]: true } };
      }
      if (!state.byConversationId[conversationId]) return state;
      const next = { ...state.byConversationId };
      delete next[conversationId];
      return { byConversationId: next };
    }),
  clearAll: () => set({ byConversationId: {} }),
}));

'use client';

import { create } from 'zustand';

export const ACTIVE_CONVERSATION_STORAGE_KEY =
  'network-agent-active-conversation';

interface ActiveConversationState {
  activeConversationId: string | null;
  hasHydrated: boolean;
  setActiveConversationId: (id: string) => void;
  clearActiveConversation: () => void;
  hydrate: () => void;
}

export const useActiveConversationStore = create<ActiveConversationState>(
  (set) => ({
    activeConversationId: null,
    hasHydrated: false,
    setActiveConversationId: (id) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, id);
      }
      set({ activeConversationId: id, hasHydrated: true });
    },
    clearActiveConversation: () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      }
      set({ activeConversationId: null, hasHydrated: true });
    },
    hydrate: () => {
      if (typeof window === 'undefined') return;
      const activeConversationId = window.localStorage.getItem(
        ACTIVE_CONVERSATION_STORAGE_KEY,
      );
      set({ activeConversationId, hasHydrated: true });
    },
  }),
);

'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'network-agent-active-conversation';

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
        window.localStorage.setItem(STORAGE_KEY, id);
      }
      set({ activeConversationId: id, hasHydrated: true });
    },
    clearActiveConversation: () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      set({ activeConversationId: null, hasHydrated: true });
    },
    hydrate: () => {
      if (typeof window === 'undefined') return;
      const activeConversationId =
        window.localStorage.getItem(STORAGE_KEY) || null;
      set({ activeConversationId, hasHydrated: true });
    },
  }),
);

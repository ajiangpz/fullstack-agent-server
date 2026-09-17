'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hasHydrated: false,
      setSession: ({ accessToken, user }) => set({ accessToken, user }),
      clearSession: () => set({ accessToken: null, user: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'network-agent-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ accessToken, user }) => ({ accessToken, user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

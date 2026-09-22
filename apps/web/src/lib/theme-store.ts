'use client';

import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'network-agent-theme';

interface ThemeState {
  mode: ThemeMode;
  hasHydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  hasHydrated: false,
  setMode: (mode) => {
    persistTheme(mode);
    set({ mode, hasHydrated: true });
  },
  toggleMode: () =>
    set((state) => {
      const mode: ThemeMode = state.mode === 'dark' ? 'light' : 'dark';
      persistTheme(mode);
      return { mode, hasHydrated: true };
    }),
  hydrate: () => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    set({
      mode: saved === 'light' || saved === 'dark' ? saved : 'dark',
      hasHydrated: true,
    });
  },
}));

function persistTheme(mode: ThemeMode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

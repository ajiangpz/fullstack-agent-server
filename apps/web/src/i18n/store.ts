'use client';

import { create } from 'zustand';
import type { Language } from './types';

const STORAGE_KEY = 'network-agent-language';

interface LanguageState {
  language: Language;
  hasHydrated: boolean;
  setLanguage: (language: Language) => void;
  hydrate: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  hasHydrated: false,
  setLanguage: (language) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
    set({ language, hasHydrated: true });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    const language = isLanguage(saved)
      ? saved
      : window.navigator.language.toLowerCase().startsWith('zh')
        ? 'zh-CN'
        : 'en';

    set({ language, hasHydrated: true });
  },
}));

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'zh-CN';
}

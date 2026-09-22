'use client';

import { create } from 'zustand';

export const THEME_SKINS = ['cyan', 'blue', 'violet', 'emerald'] as const;
export type ThemeSkin = (typeof THEME_SKINS)[number];

const STORAGE_KEY = 'network-agent-theme-skin';

interface ThemeState {
  skin: ThemeSkin;
  hasHydrated: boolean;
  setSkin: (skin: ThemeSkin) => void;
  cycleSkin: () => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  skin: 'cyan',
  hasHydrated: false,
  setSkin: (skin) => {
    persistSkin(skin);
    set({ skin, hasHydrated: true });
  },
  cycleSkin: () =>
    set((state) => {
      const skin = getNextThemeSkin(state.skin);
      persistSkin(skin);
      return { skin, hasHydrated: true };
    }),
  hydrate: () => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    set({
      skin: isThemeSkin(saved) ? saved : 'cyan',
      hasHydrated: true,
    });
  },
}));

export function getNextThemeSkin(skin: ThemeSkin): ThemeSkin {
  const index = THEME_SKINS.indexOf(skin);
  return THEME_SKINS[(index + 1) % THEME_SKINS.length];
}

function persistSkin(skin: ThemeSkin) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, skin);
  }
}

function isThemeSkin(value: string | null): value is ThemeSkin {
  return THEME_SKINS.some((skin) => skin === value);
}

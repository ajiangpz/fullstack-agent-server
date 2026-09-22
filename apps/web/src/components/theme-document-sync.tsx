'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/theme-store';

export function ThemeDocumentSync() {
  const skin = useThemeStore((state) => state.skin);
  const hydrate = useThemeStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.themeSkin = skin;
  }, [skin]);

  return null;
}

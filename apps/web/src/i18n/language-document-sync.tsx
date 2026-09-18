'use client';

import { useEffect } from 'react';
import { useLanguageStore } from './store';

export function LanguageDocumentSync() {
  const language = useLanguageStore((state) => state.language);
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const hydrate = useLanguageStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.lang = language;
  }, [hasHydrated, language]);

  return null;
}

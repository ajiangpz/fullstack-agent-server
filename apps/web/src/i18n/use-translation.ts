'use client';

import { useCallback } from 'react';
import { useLanguageStore } from './store';
import { translate } from './translate';
import type { TranslationKey, TranslationParams } from './types';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  );

  return {
    language,
    setLanguage,
    t,
    intlLocale: language === 'zh-CN' ? 'zh-CN' : 'en-US',
  };
}

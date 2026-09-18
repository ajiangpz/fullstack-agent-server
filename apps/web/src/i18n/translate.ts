import { en } from './locales/en';
import { zhCN } from './locales/zh-CN';
import type { Language, TranslationKey, TranslationParams } from './types';

const messages = {
  en,
  'zh-CN': zhCN,
} satisfies Record<Language, Record<TranslationKey, string>>;

export function translate(
  language: Language,
  key: TranslationKey,
  params: TranslationParams = {},
) {
  const template = messages[language][key] ?? en[key];

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function isTranslationKey(value: string): value is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, value);
}

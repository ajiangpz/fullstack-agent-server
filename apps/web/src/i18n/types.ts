import { en } from './locales/en';

export type Language = 'en' | 'zh-CN';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

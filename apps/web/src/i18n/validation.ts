import { isTranslationKey } from './translate';
import type { TranslationKey } from './types';

type Translate = (key: TranslationKey) => string;

export function translateValidationMessage(
  message: string | undefined,
  t: Translate,
) {
  if (!message) return undefined;
  return isTranslationKey(message) ? t(message) : message;
}

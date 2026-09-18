'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();
  const nextLanguage = language === 'en' ? 'zh-CN' : 'en';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={
        language === 'en'
          ? t('language.switchToChinese')
          : t('language.switchToEnglish')
      }
      title={
        language === 'en'
          ? t('language.switchToChinese')
          : t('language.switchToEnglish')
      }
    >
      <Languages className="mr-1.5 h-4 w-4" />
      {language === 'en' ? t('language.chinese') : 'EN'}
    </Button>
  );
}

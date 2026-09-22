'use client';

import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';

export default function SettingsPage() {
  const { language, t } = useTranslation();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">{t('settings.title')}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t('settings.description')}</p>

      <Card className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-zinc-100">
            {t('settings.language.title')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {t('settings.language.description')}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {language === 'zh-CN'
              ? t('language.chinese')
              : t('language.english')}
          </p>
        </div>
        <LanguageSwitcher />
      </Card>

      <Card className="mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-zinc-100">
            {t('settings.theme.title')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            {t('settings.theme.description')}
          </p>
        </div>
        <ThemeSwitcher />
      </Card>
    </div>
  );
}

'use client';

import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { useThemeStore, type ThemeSkin } from '@/lib/theme-store';

const labelKeys: Record<ThemeSkin, TranslationKey> = {
  cyan: 'theme.cyan',
  blue: 'theme.blue',
  violet: 'theme.violet',
  emerald: 'theme.emerald',
};

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const skin = useThemeStore((state) => state.skin);
  const cycleSkin = useThemeStore((state) => state.cycleSkin);
  const { t } = useTranslation();
  const label = t(labelKeys[skin]);
  const accessibleLabel = `${t('theme.switch')}: ${label}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={cycleSkin}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <Palette className={compact ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'} />
      {compact ? null : label}
    </Button>
  );
}

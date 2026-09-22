'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';
import { useThemeStore } from '@/lib/theme-store';

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const mode = useThemeStore((state) => state.mode);
  const toggleMode = useThemeStore((state) => state.toggleMode);
  const { t } = useTranslation();

  const isDark = mode === 'dark';
  const currentLabel = t(isDark ? 'theme.dark' : 'theme.light');
  const actionLabel = t(isDark ? 'theme.switchToLight' : 'theme.switchToDark');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleMode}
      aria-label={actionLabel}
      title={actionLabel}
    >
      {isDark ? (
        <Moon className={compact ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'} />
      ) : (
        <Sun className={compact ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'} />
      )}
      {compact ? null : currentLabel}
    </Button>
  );
}

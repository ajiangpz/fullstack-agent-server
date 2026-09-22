'use client';

import {
  Bot,
  Boxes,
  ClipboardList,
  Gauge,
  LogOut,
  ScrollText,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/dashboard', label: 'nav.overview' as const, icon: Gauge },
  { href: '/devices', label: 'nav.devices' as const, icon: Boxes },
  { href: '/agent', label: 'nav.agent' as const, icon: Bot },
  { href: '/tasks', label: 'nav.tasks' as const, icon: ClipboardList },
  { href: '/audit', label: 'nav.audit' as const, icon: ScrollText },
  { href: '/settings', label: 'nav.settings' as const, icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { t } = useTranslation();
  const isAgentPage = pathname === '/agent';

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div
      className={cn(
        'bg-zinc-950 text-zinc-100',
        isAgentPage ? 'fixed inset-0 overflow-hidden' : 'min-h-screen',
      )}
    >
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-zinc-950/95 p-4 lg:block">
        <div className="mb-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Network Agent
          </p>
          <p className="mt-2 text-sm text-zinc-500">{t('shell.console')}</p>
        </div>
        <nav className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(label)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          'lg:pl-64',
          isAgentPage && 'flex h-full min-h-0 flex-col overflow-hidden',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-5 backdrop-blur lg:px-8',
            isAgentPage && 'shrink-0',
          )}
        >
          <div>
            <p className="text-sm font-medium">{t('shell.header.title')}</p>
            <p className="text-xs text-zinc-500">{t('shell.header.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <LanguageSwitcher />
            <div className="hidden text-right sm:block">
              <p className="text-sm text-zinc-200">
                {user?.displayName || user?.username}
              </p>
              <p className="text-xs text-zinc-500">{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              aria-label={t('shell.signOut')}
              title={t('shell.signOut')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main
          className={cn(
            'px-5 py-8 lg:px-8',
            isAgentPage && 'min-h-0 flex-1 overflow-hidden',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

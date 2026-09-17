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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: Gauge },
  { href: '/devices', label: 'Devices', icon: Boxes },
  { href: '/agent', label: 'AI Agent', icon: Bot },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/audit', label: 'Audit Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-zinc-950/95 p-4 lg:block">
        <div className="mb-8 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">Network Agent</p>
          <p className="mt-2 text-sm text-zinc-500">AI operations console</p>
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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-5 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-medium">Network Operations</p>
            <p className="text-xs text-zinc-500">Manage devices and agent workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm text-zinc-200">{user?.displayName || user?.username}</p>
              <p className="text-xs text-zinc-500">{user?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

'use client';

import { Activity, Bot, Network } from 'lucide-react';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Card } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/login-form';
import { useTranslation } from '@/i18n/use-translation';

export default function LoginPage() {
  const { t } = useTranslation();
  const features = [
    [t('auth.feature.devices'), Network],
    [t('auth.feature.tasks'), Bot],
    [t('auth.feature.trace'), Activity],
  ] as const;

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div className="absolute right-5 top-5 z-10">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:block">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Network Agent
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-zinc-100">
            {t('auth.hero.loginTitle')}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            {t('auth.hero.loginDescription')}
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {features.map(([label, Icon]) => (
              <div
                key={label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <Icon className="mb-3 h-5 w-5 text-zinc-500" />
                <p className="text-sm text-zinc-300">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md p-7 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
              Network Agent
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-100">
              {t('auth.login.title')}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              {t('auth.login.description')}
            </p>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-zinc-500">
            {t('auth.login.newUser')}{' '}
            <Link
              className="font-medium text-cyan-400 hover:text-cyan-300"
              href="/register"
            >
              {t('auth.login.createAccount')}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

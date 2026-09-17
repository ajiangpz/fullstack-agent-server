import { Activity, Bot, Network } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:block">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Network Agent</p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
            Network operations with an observable AI agent runtime.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            Manage devices, run AI tasks, and inspect every model and tool step from one operations console.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {[['Devices', Network], ['Agent Tasks', Bot], ['Execution Trace', Activity]].map(([label, Icon]) => {
              const ItemIcon = Icon as typeof Network;
              return (
                <div key={label as string} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <ItemIcon className="mb-3 h-5 w-5 text-cyan-400" />
                  <p className="text-sm text-zinc-300">{label as string}</p>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md p-7 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">Network Agent</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Sign in</h2>
            <p className="mt-2 text-sm text-zinc-500">Use the email address registered with the NestJS API.</p>
          </div>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}

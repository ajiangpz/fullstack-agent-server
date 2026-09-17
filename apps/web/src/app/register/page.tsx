import { Activity, Bot, Network } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { RegisterForm } from '@/features/auth/register-form';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:block">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Network Agent</p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
            Build an account for observable network operations.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            Register once, then manage devices, run AI tasks, and inspect the Agent execution trace from the same console.
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
            <h2 className="mt-3 text-2xl font-semibold text-white">Create account</h2>
            <p className="mt-2 text-sm text-zinc-500">Create a local account backed by the NestJS authentication service.</p>
          </div>
          <RegisterForm />
          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link className="font-medium text-cyan-400 hover:text-cyan-300" href="/login">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

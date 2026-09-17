import { Activity, Bot, Boxes, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';

const capabilities = [
  {
    title: 'Device management',
    description: 'CRUD, pagination, search and device-status filters are available in the NestJS API.',
    icon: Boxes,
  },
  {
    title: 'Agent runtime',
    description: 'Model calls, tool calls, tool results and final answers are persisted as AgentSteps.',
    icon: Bot,
  },
  {
    title: 'Async execution',
    description: 'BullMQ and Redis handle queued AI tasks, retries, leases and worker execution.',
    icon: Activity,
  },
  {
    title: 'Access control',
    description: 'JWT authentication and role-based access control protect backend resources.',
    icon: ShieldCheck,
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-sm text-cyan-400">Overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Network Agent Console</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Phase 1 establishes the authenticated frontend foundation. Operational metrics will appear only after dedicated backend summary APIs exist.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {capabilities.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-medium text-zinc-100">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

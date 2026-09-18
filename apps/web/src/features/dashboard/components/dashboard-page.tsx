'use client';

import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Server,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { TaskStatusBadge } from '@/features/agent/components/task-status-badge';
import { useAiTasks } from '@/features/agent/hooks';
import { useAuditLogs } from '@/features/audit/hooks';
import { useDevices } from '@/features/devices/hooks';
import { useAuthStore } from '@/lib/auth-store';
import { calculateAvailability } from '../metrics';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const allDevices = useDevices({ page: 1, limit: 1 });
  const onlineDevices = useDevices({ page: 1, limit: 1, status: 'online' });
  const offlineDevices = useDevices({ page: 1, limit: 1, status: 'offline' });

  const recentTasks = useAiTasks({ page: 1, limit: 5 });
  const pendingTasks = useAiTasks({ page: 1, limit: 1, status: 'PENDING' });
  const processingTasks = useAiTasks({
    page: 1,
    limit: 1,
    status: 'PROCESSING',
  });
  const completedTasks = useAiTasks({
    page: 1,
    limit: 1,
    status: 'COMPLETED',
  });
  const failedTasks = useAiTasks({ page: 1, limit: 1, status: 'FAILED' });

  const recentAudit = useAuditLogs({ page: 1, limit: 5 }, isAdmin);

  const totalDevices = allDevices.data?.pagination.total ?? null;
  const onlineCount = onlineDevices.data?.pagination.total ?? null;
  const offlineCount = offlineDevices.data?.pagination.total ?? null;
  const taskTotal = recentTasks.data?.pagination.total ?? null;
  const runningCount =
    pendingTasks.data && processingTasks.data
      ? pendingTasks.data.pagination.total +
        processingTasks.data.pagination.total
      : null;
  const completedCount = completedTasks.data?.pagination.total ?? null;
  const failedCount = failedTasks.data?.pagination.total ?? null;
  const availability =
    totalDevices !== null && onlineCount !== null
      ? calculateAvailability(onlineCount, totalDevices)
      : null;

  const hasError = [
    allDevices,
    onlineDevices,
    offlineDevices,
    recentTasks,
    pendingTasks,
    processingTasks,
    completedTasks,
    failedTasks,
  ].some((query) => query.isError);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-cyan-400">Overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Network Agent Console
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Live operational totals from your device inventory and persisted Agent
          tasks.
        </p>
      </div>

      {hasError ? (
        <Card className="border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          Some dashboard metrics could not be loaded. Available sections are
          still shown below.
        </Card>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Devices"
          description="Inventory availability for the devices visible to this account."
          href="/devices"
          linkLabel="View devices"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total" value={formatCount(totalDevices)} icon={Boxes} />
          <MetricCard
            label="Online"
            value={formatCount(onlineCount)}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Offline"
            value={formatCount(offlineCount)}
            icon={CircleAlert}
          />
          <MetricCard
            label="Availability"
            value={availability === null ? '—' : `${availability.toFixed(1)}%`}
            icon={Server}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Agent Tasks"
          description="Current execution state across queued and completed Agent work."
          href="/tasks"
          linkLabel="View tasks"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total" value={formatCount(taskTotal)} icon={Bot} />
          <MetricCard
            label="Running"
            value={formatCount(runningCount)}
            icon={Activity}
          />
          <MetricCard
            label="Completed"
            value={formatCount(completedCount)}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Failed"
            value={formatCount(failedCount)}
            icon={CircleAlert}
          />
        </div>
      </section>

      <div className={isAdmin ? 'grid gap-6 xl:grid-cols-2' : ''}>
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="font-medium text-zinc-100">Recent Agent tasks</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Most recently created tasks and their current status.
            </p>
          </div>

          <div className="divide-y divide-zinc-900">
            {recentTasks.isLoading ? (
              <EmptyState>Loading recent tasks…</EmptyState>
            ) : null}

            {recentTasks.isError ? (
              <EmptyState tone="error">Unable to load recent tasks.</EmptyState>
            ) : null}

            {!recentTasks.isLoading &&
            !recentTasks.isError &&
            (recentTasks.data?.items.length ?? 0) === 0 ? (
              <EmptyState>No Agent tasks have been created yet.</EmptyState>
            ) : null}

            {recentTasks.data?.items.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${encodeURIComponent(task.id)}`}
                className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {task.prompt}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                    <span>{formatDate(task.createdAt)}</span>
                    <span>{task.stepCount} steps</span>
                    <span>{task.retryCount} retries</span>
                  </div>
                </div>
                <TaskStatusBadge status={task.status} />
              </Link>
            ))}
          </div>
        </Card>

        {isAdmin ? (
          <Card className="overflow-hidden">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h2 className="font-medium text-zinc-100">
                Recent audit activity
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Latest authentication and device-operation events.
              </p>
            </div>

            <div className="divide-y divide-zinc-900">
              {recentAudit.isLoading ? (
                <EmptyState>Loading audit activity…</EmptyState>
              ) : null}

              {recentAudit.isError ? (
                <EmptyState tone="error">
                  Unable to load audit activity.
                </EmptyState>
              ) : null}

              {!recentAudit.isLoading &&
              !recentAudit.isError &&
              (recentAudit.data?.items.length ?? 0) === 0 ? (
                <EmptyState>No audit activity has been recorded yet.</EmptyState>
              ) : null}

              {recentAudit.data?.items.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-300">
                      {formatAction(log.action)}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {log.resourceType}
                      {log.resourceId ? ` #${log.resourceId}` : ''} · actor{' '}
                      {log.actorId ?? 'system'} · {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 px-5 py-3">
              <Link
                href="/audit"
                className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                View audit logs
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-cyan-300 hover:text-cyan-200"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-zinc-600" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-zinc-100">
        {value}
      </p>
    </Card>
  );
}

function EmptyState({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'error';
}) {
  return (
    <div
      className={`px-5 py-8 text-sm ${
        tone === 'error' ? 'text-red-300' : 'text-zinc-500'
      }`}
    >
      {children}
    </div>
  );
}

function formatCount(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function formatAction(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

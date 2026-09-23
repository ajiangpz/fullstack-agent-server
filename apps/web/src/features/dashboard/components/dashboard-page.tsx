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
import type { AuditAction } from '@/features/audit/types';
import { useDevices } from '@/features/devices/hooks';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { useAuthStore } from '@/lib/auth-store';
import { calculateAvailability } from '../metrics';

const auditActionKeys: Record<AuditAction, TranslationKey> = {
  USER_REGISTERED: 'audit.action.USER_REGISTERED',
  USER_LOGGED_IN: 'audit.action.USER_LOGGED_IN',
  DEVICE_CREATED: 'audit.action.DEVICE_CREATED',
  DEVICE_UPDATED: 'audit.action.DEVICE_UPDATED',
  DEVICE_DELETED: 'audit.action.DEVICE_DELETED',
};

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { t, intlLocale } = useTranslation();

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

  const recentAudit = useAuditLogs({ page: 1, limit: 5 }, Boolean(user));

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
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          {t('dashboard.description')}
        </p>
      </div>

      {hasError ? (
        <Card className="border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          {t('dashboard.partialError')}
        </Card>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title={t('dashboard.devices.title')}
          description={t('dashboard.devices.description')}
          href="/devices"
          linkLabel={t('dashboard.devices.view')}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.metric.total')}
            value={formatCount(totalDevices, intlLocale)}
            icon={Boxes}
          />
          <MetricCard
            label={t('dashboard.metric.online')}
            value={formatCount(onlineCount, intlLocale)}
            icon={CheckCircle2}
          />
          <MetricCard
            label={t('dashboard.metric.offline')}
            value={formatCount(offlineCount, intlLocale)}
            icon={CircleAlert}
          />
          <MetricCard
            label={t('dashboard.metric.availability')}
            value={availability === null ? '—' : `${availability.toFixed(1)}%`}
            icon={Server}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title={t('dashboard.tasks.title')}
          description={t('dashboard.tasks.description')}
          href="/tasks"
          linkLabel={t('dashboard.tasks.view')}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.metric.total')}
            value={formatCount(taskTotal, intlLocale)}
            icon={Bot}
          />
          <MetricCard
            label={t('dashboard.metric.running')}
            value={formatCount(runningCount, intlLocale)}
            icon={Activity}
          />
          <MetricCard
            label={t('dashboard.metric.completed')}
            value={formatCount(completedCount, intlLocale)}
            icon={CheckCircle2}
          />
          <MetricCard
            label={t('dashboard.metric.failed')}
            value={formatCount(failedCount, intlLocale)}
            icon={CircleAlert}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="font-medium text-zinc-100">
              {t('dashboard.recentTasks.title')}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t('dashboard.recentTasks.description')}
            </p>
          </div>

          <div className="divide-y divide-zinc-900">
            {recentTasks.isLoading ? (
              <EmptyState>{t('dashboard.recentTasks.loading')}</EmptyState>
            ) : null}

            {recentTasks.isError ? (
              <EmptyState tone="error">
                {t('dashboard.recentTasks.error')}
              </EmptyState>
            ) : null}

            {!recentTasks.isLoading &&
            !recentTasks.isError &&
            (recentTasks.data?.items.length ?? 0) === 0 ? (
              <EmptyState>{t('dashboard.recentTasks.empty')}</EmptyState>
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
                    <span>{formatDate(task.createdAt, intlLocale)}</span>
                    <span>
                      {t('dashboard.recentTasks.steps', {
                        count: task.stepCount,
                      })}
                    </span>
                    <span>
                      {t('dashboard.recentTasks.retries', {
                        count: task.retryCount,
                      })}
                    </span>
                  </div>
                </div>
                <TaskStatusBadge status={task.status} />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="font-medium text-zinc-100">
              {t('dashboard.audit.title')}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t('dashboard.audit.description')}
            </p>
          </div>

          <div className="divide-y divide-zinc-900">
            {recentAudit.isLoading ? (
              <EmptyState>{t('dashboard.audit.loading')}</EmptyState>
            ) : null}

            {recentAudit.isError ? (
              <EmptyState tone="error">
                {t('dashboard.audit.error')}
              </EmptyState>
            ) : null}

            {!recentAudit.isLoading &&
            !recentAudit.isError &&
            (recentAudit.data?.items.length ?? 0) === 0 ? (
              <EmptyState>{t('dashboard.audit.empty')}</EmptyState>
            ) : null}

            {recentAudit.data?.items.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-300">
                    {t(auditActionKeys[log.action])}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {log.resourceType}
                    {log.resourceId ? ` #${log.resourceId}` : ''} ·{' '}
                    {t('dashboard.audit.actor', {
                      actor: log.actorId ?? t('common.system'),
                    })}{' '}
                    · {formatDate(log.createdAt, intlLocale)}
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
              {t('dashboard.audit.view')}
            </Link>
          </div>
        </Card>
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

function formatCount(value: number | null, locale: string) {
  return value === null ? '—' : new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

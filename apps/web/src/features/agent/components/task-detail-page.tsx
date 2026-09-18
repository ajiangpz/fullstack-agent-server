'use client';

import { ArrowLeft, LoaderCircle, Radio, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import { useAiTaskRealtime } from '../hooks';
import { ExecutionTrace } from './execution-trace';
import { TaskStatusBadge } from './task-status-badge';

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const taskQuery = useAiTaskRealtime(taskId);
  const task = taskQuery.data;
  const { t } = useTranslation();

  if (taskQuery.isLoading) {
    return (
      <Card className="mx-auto max-w-6xl p-8 text-sm text-zinc-400">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
          {t('task.detail.loading')}
        </div>
      </Card>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <Card className="mx-auto max-w-6xl border-red-500/20 p-8 text-sm text-red-300">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {taskQuery.error instanceof Error
              ? taskQuery.error.message
              : t('task.detail.loadError')}
          </span>
        </div>
      </Card>
    );
  }

  const active = task.status === 'PENDING' || task.status === 'PROCESSING';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"
        href="/agent"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('task.detail.back')}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-cyan-400">{t('task.detail.section')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t('task.detail.title')}
          </h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {task.prompt}
          </p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t('task.detail.steps')} value={String(task.steps.length)} />
        <Metric label={t('task.detail.attempts')} value={String(task.attempts)} />
        <Metric label={t('task.detail.retries')} value={String(task.retryCount)} />
        <Metric
          label={t('task.detail.duration')}
          value={taskDuration(task.startedAt, task.completedAt, t)}
        />
      </div>

      {active ? (
        <Card className="border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
          <div className="flex items-center gap-3">
            {taskQuery.streamStatus === 'connected' ? (
              <Radio className="h-4 w-4" />
            ) : (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            )}
            {taskQuery.streamStatus === 'connected'
              ? t('agent.live.connected')
              : t('agent.live.fallback')}
          </div>
        </Card>
      ) : null}

      {task.status === 'FAILED' && task.errorMessage ? (
        <Card className="border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {task.errorMessage}
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-100">
            {t('task.detail.traceTitle')}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t('task.detail.traceDescription')}
          </p>
        </div>
        <ExecutionTrace steps={task.steps} />
      </Card>

      <p className="break-all font-mono text-[11px] text-zinc-700">
        {t('task.detail.taskId', { id: task.id })}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 text-lg font-medium text-zinc-200">{value}</p>
    </Card>
  );
}

function taskDuration(
  startedAt: string | null,
  completedAt: string | null,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (!startedAt) return t('common.notStarted');
  if (!completedAt) return t('common.status.running');
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) return '—';
  if (duration < 1_000) return `${duration} ms`;
  return `${(duration / 1_000).toFixed(2)} s`;
}

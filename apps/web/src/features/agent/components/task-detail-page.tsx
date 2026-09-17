'use client';

import { ArrowLeft, LoaderCircle, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAiTask } from '../hooks';
import { ExecutionTrace } from './execution-trace';
import { TaskStatusBadge } from './task-status-badge';

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const taskQuery = useAiTask(taskId);
  const task = taskQuery.data;

  if (taskQuery.isLoading) {
    return (
      <Card className="mx-auto max-w-6xl p-8 text-sm text-zinc-400">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
          Loading Agent task…
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
              : 'Unable to load Agent task.'}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"
        href="/agent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agent
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-cyan-400">Agent Execution Trace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Task detail</h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {task.prompt}
          </p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Steps" value={String(task.steps.length)} />
        <Metric label="Attempts" value={String(task.attempts)} />
        <Metric label="Retries" value={String(task.retryCount)} />
        <Metric label="Duration" value={taskDuration(task.startedAt, task.completedAt)} />
      </div>

      {(task.status === 'PENDING' || task.status === 'PROCESSING') ? (
        <Card className="border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            The task is still running. This trace refreshes every second.
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
          <h2 className="text-lg font-semibold text-zinc-100">Execution trace</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Persisted runtime facts only. This view does not expose private model reasoning.
          </p>
        </div>
        <ExecutionTrace steps={task.steps} />
      </Card>

      <p className="break-all font-mono text-[11px] text-zinc-700">Task ID: {task.id}</p>
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

function taskDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt) return 'Not started';
  if (!completedAt) return 'Running';
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) return '—';
  if (duration < 1_000) return `${duration} ms`;
  return `${(duration / 1_000).toFixed(2)} s`;
}

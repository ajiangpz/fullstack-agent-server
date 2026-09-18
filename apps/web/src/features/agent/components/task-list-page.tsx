'use client';

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { useAiTasks } from '../hooks';
import type {
  AiTaskListItem,
  AiTaskQuery,
  AiTaskStatus,
} from '../types';
import { TaskStatusBadge } from './task-status-badge';

const INITIAL_QUERY: AiTaskQuery = { page: 1, limit: 20 };

export function TaskListPage() {
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState<AiTaskQuery>(INITIAL_QUERY);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AiTaskStatus | ''>('');
  const tasksQuery = useAiTasks(query);
  const data = tasksQuery.data;
  const tasks = data?.items ?? [];

  function applyFilters() {
    setQuery({
      page: 1,
      limit: query.limit,
      search: search.trim() || undefined,
      status: status || undefined,
    });
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setQuery(INITIAL_QUERY);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm text-cyan-400">Agent Operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Review Agent task history, execution status, retries and persisted traces.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input
              className="pl-9"
              placeholder="Search task prompts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
            />
          </div>

          <select
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500"
            value={status}
            onChange={(event) => setStatus(event.target.value as AiTaskStatus | '')}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetFilters}>
              Reset
            </Button>
            <Button onClick={applyFilters}>Apply</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {tasksQuery.isLoading ? <StateMessage>Loading Agent tasks…</StateMessage> : null}
        {tasksQuery.isError ? (
          <StateMessage tone="error">
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : 'Unable to load Agent tasks.'}
          </StateMessage>
        ) : null}
        {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 ? (
          <StateMessage>No Agent tasks match the current filters.</StateMessage>
        ) : null}

        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Prompt</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Steps</th>
                  <th className="px-5 py-3 font-medium">Retries</th>
                  {user?.role === 'ADMIN' ? (
                    <th className="px-5 py-3 font-medium">Owner</th>
                  ) : null}
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showOwner={user?.role === 'ADMIN'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data.pagination.total} task{data.pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                aria-label="Previous task page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center">
                Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  data.pagination.totalPages === 0 ||
                  query.page >= data.pagination.totalPages
                }
                onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
                aria-label="Next task page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function TaskRow({
  task,
  showOwner,
}: {
  task: AiTaskListItem;
  showOwner: boolean;
}) {
  return (
    <tr className="hover:bg-zinc-900/40">
      <td className="max-w-xl px-5 py-4">
        <Link
          href={`/tasks/${encodeURIComponent(task.id)}`}
          className="block truncate font-medium text-zinc-200 hover:text-cyan-300"
          title={task.prompt}
        >
          {task.prompt}
        </Link>
        {task.status === 'FAILED' && task.errorMessage ? (
          <p className="mt-1 truncate text-xs text-red-400/80" title={task.errorMessage}>
            {task.errorMessage}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <TaskStatusBadge status={task.status} />
      </td>
      <td className="px-5 py-4 text-zinc-400">{task.stepCount}</td>
      <td className="px-5 py-4 text-zinc-400">{task.retryCount}</td>
      {showOwner ? (
        <td className="px-5 py-4 font-mono text-xs text-zinc-500">{task.ownerId}</td>
      ) : null}
      <td className="px-5 py-4 text-zinc-500">{formatDate(task.createdAt)}</td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/tasks/${encodeURIComponent(task.id)}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          Open
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

function StateMessage({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'error';
}) {
  return (
    <div
      className={`px-6 py-12 text-center text-sm ${
        tone === 'error' ? 'text-red-300' : 'text-zinc-500'
      }`}
    >
      {children}
    </div>
  );
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

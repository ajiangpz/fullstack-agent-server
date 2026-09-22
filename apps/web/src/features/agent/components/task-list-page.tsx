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
import { useTranslation } from '@/i18n/use-translation';
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
  const { t, intlLocale } = useTranslation();
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
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('tasks.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          {t('tasks.description')}
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input
              className="pl-9"
              placeholder={t('tasks.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && applyFilters()
              }
            />
          </div>

          <select
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AiTaskStatus | '')
            }
          >
            <option value="">{t('tasks.allStatuses')}</option>
            <option value="PENDING">{t('common.status.pending')}</option>
            <option value="PROCESSING">
              {t('common.status.processing')}
            </option>
            <option value="COMPLETED">{t('common.status.completed')}</option>
            <option value="FAILED">{t('common.status.failed')}</option>
          </select>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetFilters}>
              {t('common.reset')}
            </Button>
            <Button onClick={applyFilters}>{t('common.apply')}</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {tasksQuery.isLoading ? (
          <StateMessage>{t('tasks.loading')}</StateMessage>
        ) : null}
        {tasksQuery.isError ? (
          <StateMessage tone="error">
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : t('tasks.loadError')}
          </StateMessage>
        ) : null}
        {!tasksQuery.isLoading &&
        !tasksQuery.isError &&
        tasks.length === 0 ? (
          <StateMessage>{t('tasks.empty')}</StateMessage>
        ) : null}

        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    {t('tasks.table.prompt')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('tasks.table.status')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('tasks.table.steps')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('tasks.table.retries')}
                  </th>
                  {user?.role === 'ADMIN' ? (
                    <th className="px-5 py-3 font-medium">
                      {t('tasks.table.owner')}
                    </th>
                  ) : null}
                  <th className="px-5 py-3 font-medium">
                    {t('tasks.table.created')}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t('tasks.table.trace')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showOwner={user?.role === 'ADMIN'}
                    locale={intlLocale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('tasks.count', { count: data.pagination.total })}</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
                aria-label={t('tasks.previousAria')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center">
                {t('common.pageOf', {
                  page: data.pagination.page,
                  total: Math.max(data.pagination.totalPages, 1),
                })}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  data.pagination.totalPages === 0 ||
                  query.page >= data.pagination.totalPages
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                aria-label={t('tasks.nextAria')}
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
  locale,
}: {
  task: AiTaskListItem;
  showOwner: boolean;
  locale: string;
}) {
  const { t } = useTranslation();

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
          <p
            className="mt-1 truncate text-xs text-red-400/80"
            title={task.errorMessage}
          >
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
        <td className="px-5 py-4 font-mono text-xs text-zinc-500">
          {task.ownerId}
        </td>
      ) : null}
      <td className="px-5 py-4 text-zinc-500">
        {formatDate(task.createdAt, locale)}
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/tasks/${encodeURIComponent(task.id)}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          {t('common.open')}
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

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { useAuthStore } from '@/lib/auth-store';
import { useAuditLogs } from '../hooks';
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditLog,
  type AuditQuery,
} from '../types';

const INITIAL_QUERY: AuditQuery = { page: 1, limit: 20 };

const actionKeys: Record<AuditAction, TranslationKey> = {
  USER_REGISTERED: 'audit.action.USER_REGISTERED',
  USER_LOGGED_IN: 'audit.action.USER_LOGGED_IN',
  DEVICE_CREATED: 'audit.action.DEVICE_CREATED',
  DEVICE_UPDATED: 'audit.action.DEVICE_UPDATED',
  DEVICE_DELETED: 'audit.action.DEVICE_DELETED',
};

export function AuditPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [query, setQuery] = useState<AuditQuery>(INITIAL_QUERY);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [resourceType, setResourceType] = useState('');
  const [actorId, setActorId] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const auditQuery = useAuditLogs(query, Boolean(user));
  const { t, intlLocale } = useTranslation();

  function applyFilters() {
    const parsedActorId = isAdmin ? parseActorId(actorId) : undefined;
    if (parsedActorId === null) {
      setFilterError(t('audit.actorInvalid'));
      return;
    }

    setFilterError(null);
    setQuery({
      page: 1,
      limit: query.limit,
      action: action || undefined,
      resourceType: resourceType.trim() || undefined,
      actorId: isAdmin ? parsedActorId : undefined,
    });
  }

  function resetFilters() {
    setAction('');
    setResourceType('');
    setActorId('');
    setFilterError(null);
    setQuery(INITIAL_QUERY);
  }

  const data = auditQuery.data;
  const logs = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm text-cyan-400">{t('audit.section')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t('audit.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          {t(isAdmin ? 'audit.descriptionAdmin' : 'audit.descriptionUser')}
        </p>
      </div>

      <Card className="p-4">
        <div
          className={
            isAdmin
              ? 'grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)_160px_auto]'
              : 'grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)_auto]'
          }
        >
          <select
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500"
            value={action}
            onChange={(event) =>
              setAction(event.target.value as AuditAction | '')
            }
          >
            <option value="">{t('audit.allActions')}</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {t(actionKeys[item])}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input
              className="pl-9"
              placeholder={t('audit.resourcePlaceholder')}
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && applyFilters()
              }
            />
          </div>

          {isAdmin ? (
            <Input
              type="number"
              min={1}
              placeholder={t('audit.actorPlaceholder')}
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && applyFilters()
              }
            />
          ) : null}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetFilters}>
              {t('common.reset')}
            </Button>
            <Button onClick={applyFilters}>{t('common.apply')}</Button>
          </div>
        </div>
        {filterError ? (
          <p className="mt-3 text-sm text-red-400">{filterError}</p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {auditQuery.isLoading ? (
          <StateMessage>{t('audit.loading')}</StateMessage>
        ) : null}
        {auditQuery.isError ? (
          <StateMessage tone="error">
            {auditQuery.error instanceof Error
              ? auditQuery.error.message
              : t('audit.loadError')}
          </StateMessage>
        ) : null}
        {!auditQuery.isLoading &&
        !auditQuery.isError &&
        logs.length === 0 ? (
          <StateMessage>{t('audit.empty')}</StateMessage>
        ) : null}

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    {t('audit.table.action')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('audit.table.resource')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('audit.table.actor')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('audit.table.time')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('audit.table.metadata')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {logs.map((log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    locale={intlLocale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('audit.count', { count: data.pagination.total })}</span>
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
                aria-label={t('audit.previousAria')}
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
                aria-label={t('audit.nextAria')}
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

function AuditRow({ log, locale }: { log: AuditLog; locale: string }) {
  const { t } = useTranslation();

  return (
    <tr className="align-top hover:bg-zinc-900/40">
      <td className="px-5 py-4">
        <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
          {t(actionKeys[log.action])}
        </span>
      </td>
      <td className="px-5 py-4">
        <p className="text-zinc-300">{log.resourceType}</p>
        <p className="mt-1 font-mono text-xs text-zinc-600">
          {log.resourceId ?? t('audit.noResourceId')}
        </p>
      </td>
      <td className="px-5 py-4 font-mono text-xs text-zinc-400">
        {log.actorId ?? t('common.system')}
      </td>
      <td className="px-5 py-4 text-zinc-500">
        {formatDate(log.createdAt, locale)}
      </td>
      <td className="px-5 py-4">
        <MetadataDetails value={log.metadata} />
      </td>
    </tr>
  );
}

function MetadataDetails({ value }: { value: unknown }) {
  const { t } = useTranslation();

  if (value === null || value === undefined) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  return (
    <details className="max-w-sm">
      <summary className="cursor-pointer text-xs font-medium text-cyan-300 hover:text-cyan-200">
        {t('audit.viewJson')}
      </summary>
      <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
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

function parseActorId(value: string) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

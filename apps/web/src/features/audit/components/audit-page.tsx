'use client';

import { ChevronLeft, ChevronRight, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { useAuditLogs } from '../hooks';
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditLog,
  type AuditQuery,
} from '../types';

const INITIAL_QUERY: AuditQuery = { page: 1, limit: 20 };

export function AuditPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [query, setQuery] = useState<AuditQuery>(INITIAL_QUERY);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [resourceType, setResourceType] = useState('');
  const [actorId, setActorId] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const auditQuery = useAuditLogs(query, isAdmin);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-cyan-400">Security</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit Logs</h1>
        <Card className="mt-6 border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-medium text-amber-200">Administrator access required</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Audit logs contain account and device-operation history and are only available to administrators.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function applyFilters() {
    const parsedActorId = parseActorId(actorId);
    if (parsedActorId === null) {
      setFilterError('Actor ID must be a positive whole number.');
      return;
    }

    setFilterError(null);
    setQuery({
      page: 1,
      limit: query.limit,
      action: action || undefined,
      resourceType: resourceType.trim() || undefined,
      actorId: parsedActorId,
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
        <p className="text-sm text-cyan-400">Security</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Review authentication events and device changes recorded by the backend audit domain.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)_160px_auto]">
          <select
            className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500"
            value={action}
            onChange={(event) => setAction(event.target.value as AuditAction | '')}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {formatAction(item)}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input
              className="pl-9"
              placeholder="Resource type, e.g. device"
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
            />
          </div>

          <Input
            type="number"
            min={1}
            placeholder="Actor ID"
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
          />

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetFilters}>
              Reset
            </Button>
            <Button onClick={applyFilters}>Apply</Button>
          </div>
        </div>
        {filterError ? (
          <p className="mt-3 text-sm text-red-400">{filterError}</p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {auditQuery.isLoading ? <StateMessage>Loading audit logs…</StateMessage> : null}
        {auditQuery.isError ? (
          <StateMessage tone="error">
            {auditQuery.error instanceof Error
              ? auditQuery.error.message
              : 'Unable to load audit logs.'}
          </StateMessage>
        ) : null}
        {!auditQuery.isLoading && !auditQuery.isError && logs.length === 0 ? (
          <StateMessage>No audit logs match the current filters.</StateMessage>
        ) : null}

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Resource</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {logs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data.pagination.total} log{data.pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                aria-label="Previous audit page"
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
                aria-label="Next audit page"
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

function AuditRow({ log }: { log: AuditLog }) {
  return (
    <tr className="align-top hover:bg-zinc-900/40">
      <td className="px-5 py-4">
        <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
          {formatAction(log.action)}
        </span>
      </td>
      <td className="px-5 py-4">
        <p className="text-zinc-300">{log.resourceType}</p>
        <p className="mt-1 font-mono text-xs text-zinc-600">
          {log.resourceId ?? 'No resource ID'}
        </p>
      </td>
      <td className="px-5 py-4 font-mono text-xs text-zinc-400">
        {log.actorId ?? 'system'}
      </td>
      <td className="px-5 py-4 text-zinc-500">{formatDate(log.createdAt)}</td>
      <td className="px-5 py-4">
        <MetadataDetails value={log.metadata} />
      </td>
    </tr>
  );
}

function MetadataDetails({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  return (
    <details className="max-w-sm">
      <summary className="cursor-pointer text-xs font-medium text-cyan-300 hover:text-cyan-200">
        View JSON
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

function formatAction(action: AuditAction) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

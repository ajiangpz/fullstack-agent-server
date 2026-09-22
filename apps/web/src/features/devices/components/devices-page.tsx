'use client';

import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/use-translation';
import { useDevices } from '../hooks';
import type { Device, DeviceQuery, DeviceStatus } from '../types';
import { DeleteDeviceModal } from './delete-device-modal';
import { DeviceFormModal } from './device-form-modal';
import { DeviceStatusBadge } from './device-status-badge';

const INITIAL_QUERY: DeviceQuery = { page: 1, limit: 20 };

export function DevicesPage() {
  const [query, setQuery] = useState<DeviceQuery>(INITIAL_QUERY);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeviceStatus | ''>('');
  const [minPorts, setMinPorts] = useState('');
  const [maxPorts, setMaxPorts] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const devicesQuery = useDevices(query);
  const { t, intlLocale } = useTranslation();

  function applyFilters() {
    const minPortCount = parsePortCount(minPorts);
    const maxPortCount = parsePortCount(maxPorts);
    if (minPortCount === null || maxPortCount === null) {
      setFilterError(t('devices.filter.invalidPort'));
      return;
    }
    if (
      minPortCount !== undefined &&
      maxPortCount !== undefined &&
      minPortCount > maxPortCount
    ) {
      setFilterError(t('devices.filter.invalidRange'));
      return;
    }

    setFilterError(null);
    setQuery({
      page: 1,
      limit: query.limit,
      search: search.trim() || undefined,
      status: status || undefined,
      minPortCount,
      maxPortCount,
    });
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setMinPorts('');
    setMaxPorts('');
    setFilterError(null);
    setQuery(INITIAL_QUERY);
  }

  const data = devicesQuery.data;
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('devices.title')}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {t('devices.description')}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('devices.add')}
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_130px_130px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input
              className="pl-9"
              placeholder={t('devices.search')}
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
              setStatus(event.target.value as DeviceStatus | '')
            }
          >
            <option value="">{t('devices.allStatuses')}</option>
            <option value="online">{t('common.status.online')}</option>
            <option value="offline">{t('common.status.offline')}</option>
          </select>
          <Input
            type="number"
            min={1}
            max={128}
            placeholder={t('devices.minPorts')}
            value={minPorts}
            onChange={(event) => setMinPorts(event.target.value)}
          />
          <Input
            type="number"
            min={1}
            max={128}
            placeholder={t('devices.maxPorts')}
            value={maxPorts}
            onChange={(event) => setMaxPorts(event.target.value)}
          />
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
        {devicesQuery.isLoading ? (
          <StateMessage>{t('devices.loading')}</StateMessage>
        ) : null}
        {devicesQuery.isError ? (
          <StateMessage tone="error">
            {devicesQuery.error instanceof Error
              ? devicesQuery.error.message
              : t('devices.loadError')}
          </StateMessage>
        ) : null}
        {!devicesQuery.isLoading &&
        !devicesQuery.isError &&
        items.length === 0 ? (
          <StateMessage>{t('devices.empty')}</StateMessage>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    {t('devices.table.name')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('devices.table.ip')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('devices.table.ports')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('devices.table.status')}
                  </th>
                  <th className="px-5 py-3 font-medium">
                    {t('devices.table.updated')}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t('devices.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {items.map((device) => (
                  <tr key={device.id} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-4">
                      <Link
                        className="font-medium text-zinc-100 hover:text-cyan-300"
                        href={`/devices/${device.id}`}
                      >
                        {device.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                      {device.ip}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {device.portCount}
                    </td>
                    <td className="px-5 py-4">
                      <DeviceStatusBadge status={device.status} />
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {formatDate(device.updatedAt, intlLocale)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('devices.editAria', {
                            name: device.name,
                          })}
                          onClick={() => setEditing(device)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-300 hover:text-red-200"
                          aria-label={t('devices.deleteAria', {
                            name: device.name,
                          })}
                          onClick={() => setDeleting(device)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data && data.pagination.totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t('devices.pagination', {
                count: data.pagination.total,
                page: data.pagination.page,
                total: data.pagination.totalPages,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={query.page <= 1 || devicesQuery.isFetching}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                {t('common.previous')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  query.page >= data.pagination.totalPages ||
                  devicesQuery.isFetching
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <DeviceFormModal open={creating} onClose={() => setCreating(false)} />
      <DeviceFormModal
        open={Boolean(editing)}
        device={editing}
        onClose={() => setEditing(null)}
      />
      <DeleteDeviceModal
        device={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function parsePortCount(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 128) return null;
  return parsed;
}

function StateMessage({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <div
      className={`px-5 py-12 text-center text-sm ${
        tone === 'error' ? 'text-red-300' : 'text-zinc-500'
      }`}
    >
      {children}
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

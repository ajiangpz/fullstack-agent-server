'use client';

import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

  function applyFilters() {
    const minPortCount = parsePortCount(minPorts);
    const maxPortCount = parsePortCount(maxPorts);
    if (minPortCount === null || maxPortCount === null) {
      setFilterError('Port filters must be whole numbers between 1 and 128.');
      return;
    }
    if (
      minPortCount !== undefined &&
      maxPortCount !== undefined &&
      minPortCount > maxPortCount
    ) {
      setFilterError('Minimum ports cannot be greater than maximum ports.');
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
          <p className="text-sm text-cyan-400">Inventory</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Devices</h1>
          <p className="mt-2 text-sm text-zinc-500">Manage the network devices available to your account.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add device</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_130px_130px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input className="pl-9" placeholder="Search name or exact IP" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyFilters()} />
          </div>
          <select className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500" value={status} onChange={(event) => setStatus(event.target.value as DeviceStatus | '')}>
            <option value="">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <Input type="number" min={1} max={128} placeholder="Min ports" value={minPorts} onChange={(event) => setMinPorts(event.target.value)} />
          <Input type="number" min={1} max={128} placeholder="Max ports" value={maxPorts} onChange={(event) => setMaxPorts(event.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetFilters}>Reset</Button>
            <Button onClick={applyFilters}>Apply</Button>
          </div>
        </div>
        {filterError ? <p className="mt-3 text-sm text-red-400">{filterError}</p> : null}
      </Card>

      <Card className="overflow-hidden">
        {devicesQuery.isLoading ? <StateMessage>Loading devices…</StateMessage> : null}
        {devicesQuery.isError ? <StateMessage tone="error">{devicesQuery.error instanceof Error ? devicesQuery.error.message : 'Unable to load devices.'}</StateMessage> : null}
        {!devicesQuery.isLoading && !devicesQuery.isError && items.length === 0 ? <StateMessage>No devices match the current filters.</StateMessage> : null}

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">IP address</th>
                  <th className="px-5 py-3 font-medium">Ports</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {items.map((device) => (
                  <tr key={device.id} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-4"><Link className="font-medium text-zinc-100 hover:text-cyan-300" href={`/devices/${device.id}`}>{device.name}</Link></td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-400">{device.ip}</td>
                    <td className="px-5 py-4 text-zinc-400">{device.portCount}</td>
                    <td className="px-5 py-4"><DeviceStatusBadge status={device.status} /></td>
                    <td className="px-5 py-4 text-zinc-500">{formatDate(device.updatedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Edit ${device.name}`} onClick={() => setEditing(device)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" aria-label={`Delete ${device.name}`} onClick={() => setDeleting(device)}><Trash2 className="h-4 w-4" /></Button>
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
            <span>{data.pagination.total} devices · Page {data.pagination.page} of {data.pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={query.page <= 1 || devicesQuery.isFetching} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={query.page >= data.pagination.totalPages || devicesQuery.isFetching} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Next</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <DeviceFormModal open={creating} onClose={() => setCreating(false)} />
      <DeviceFormModal open={Boolean(editing)} device={editing} onClose={() => setEditing(null)} />
      <DeleteDeviceModal device={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function parsePortCount(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 128) return null;
  return parsed;
}

function StateMessage({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return <div className={`px-5 py-12 text-center text-sm ${tone === 'error' ? 'text-red-300' : 'text-zinc-500'}`}>{children}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

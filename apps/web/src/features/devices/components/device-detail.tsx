'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import { useDevice, useDevicePorts } from '../hooks';
import { DeleteDeviceModal } from './delete-device-modal';
import { DeviceFormModal } from './device-form-modal';
import { DeviceStatusBadge } from './device-status-badge';

export function DeviceDetail({ deviceId }: { deviceId: number }) {
  const router = useRouter();
  const deviceQuery = useDevice(deviceId);
  const portsQuery = useDevicePorts(deviceId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t, intlLocale } = useTranslation();

  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    return (
      <Message
        title={t('device.invalid.title')}
        description={t('device.invalid.description')}
      />
    );
  }

  if (deviceQuery.isLoading) {
    return (
      <Message
        title={t('device.loading.title')}
        description={t('device.loading.description')}
      />
    );
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    return (
      <Message
        title={t('device.unavailable.title')}
        description={
          deviceQuery.error instanceof Error
            ? deviceQuery.error.message
            : t('device.unavailable.description')
        }
      />
    );
  }

  const device = deviceQuery.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/devices"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('device.back')}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {device.name}
            </h1>
            <DeviceStatusBadge status={device.status} />
          </div>
          <p className="mt-2 font-mono text-sm text-zinc-500">{device.ip}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit')}
          </Button>
          <Button
            className="bg-red-500 text-white hover:bg-red-400"
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="font-medium text-zinc-100">
          {t('device.information')}
        </h2>
        <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Info label={t('device.field.name')} value={device.name} />
          <Info label={t('device.field.ip')} value={device.ip} mono />
          <Info
            label={t('device.field.portCount')}
            value={String(device.portCount)}
          />
          <Info
            label={t('device.field.status')}
            value={
              device.status === 'online'
                ? t('common.status.online')
                : t('common.status.offline')
            }
          />
          <Info
            label={t('device.field.ownerId')}
            value={String(device.ownerId)}
          />
          <Info
            label={t('device.field.deviceId')}
            value={String(device.id)}
          />
          <Info
            label={t('device.field.created')}
            value={formatDate(device.createdAt, intlLocale)}
          />
          <Info
            label={t('device.field.updated')}
            value={formatDate(device.updatedAt, intlLocale)}
          />
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-medium text-zinc-100">
                {t('device.ports.title')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {t('device.ports.description')}
              </p>
            </div>
            {portsQuery.data ? (
              <span className="text-xs text-zinc-600">
                {t('device.ports.count', { count: portsQuery.data.total })}
              </span>
            ) : null}
          </div>
        </div>

        {portsQuery.isLoading ? (
          <div className="px-6 py-8 text-sm text-zinc-500">
            {t('device.ports.loading')}
          </div>
        ) : null}

        {portsQuery.isError ? (
          <div className="px-6 py-8 text-sm text-red-300">
            {portsQuery.error instanceof Error
              ? portsQuery.error.message
              : t('device.ports.error')}
          </div>
        ) : null}

        {!portsQuery.isLoading &&
        !portsQuery.isError &&
        (portsQuery.data?.items.length ?? 0) === 0 ? (
          <div className="px-6 py-8 text-sm text-zinc-500">
            {t('device.ports.empty')}
          </div>
        ) : null}

        {(portsQuery.data?.items.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-medium">
                    {t('device.ports.table.port')}
                  </th>
                  <th className="px-6 py-3 font-medium">
                    {t('device.ports.table.status')}
                  </th>
                  <th className="px-6 py-3 font-medium">
                    {t('device.ports.table.updated')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {portsQuery.data?.items.map((port) => (
                  <tr key={port.id} className="hover:bg-zinc-900/40">
                    <td className="px-6 py-4 font-mono text-zinc-300">
                      {port.portNumber}
                    </td>
                    <td className="px-6 py-4">
                      <PortStatusBadge status={port.status} />
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {formatDate(port.updatedAt, intlLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="border-dashed p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
          {t('device.boundary.title')}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          {t('device.boundary.description')}
        </p>
      </Card>

      <DeviceFormModal
        open={editing}
        device={device}
        onClose={() => setEditing(false)}
      />
      <DeleteDeviceModal
        device={deleting ? device : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => router.replace('/devices')}
      />
    </div>
  );
}

function PortStatusBadge({ status }: { status: 'up' | 'down' }) {
  const { t } = useTranslation();
  const up = status === 'up';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
        up
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-zinc-700 bg-zinc-900 text-zinc-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          up ? 'bg-emerald-400' : 'bg-zinc-600'
        }`}
      />
      {up ? t('device.ports.status.up') : t('device.ports.status.down')}
    </span>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd
        className={`mt-1.5 text-sm text-zinc-300 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Message({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
        <Link
          href="/devices"
          className="mt-6 inline-flex text-sm text-cyan-400 hover:text-cyan-300"
        >
          {t('device.return')}
        </Link>
      </Card>
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

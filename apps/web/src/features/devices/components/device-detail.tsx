'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDevice } from '../hooks';
import { DeleteDeviceModal } from './delete-device-modal';
import { DeviceFormModal } from './device-form-modal';
import { DeviceStatusBadge } from './device-status-badge';

export function DeviceDetail({ deviceId }: { deviceId: number }) {
  const router = useRouter();
  const deviceQuery = useDevice(deviceId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    return <Message title="Invalid device" description="The device ID in the URL is invalid." />;
  }

  if (deviceQuery.isLoading) {
    return <Message title="Loading device" description="Fetching the latest device information…" />;
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    return <Message title="Device unavailable" description={deviceQuery.error instanceof Error ? deviceQuery.error.message : 'Unable to load this device.'} />;
  }

  const device = deviceQuery.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/devices" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200"><ArrowLeft className="h-4 w-4" />Back to devices</Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{device.name}</h1><DeviceStatusBadge status={device.status} /></div>
          <p className="mt-2 font-mono text-sm text-zinc-500">{device.ip}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
          <Button className="bg-red-500 text-white hover:bg-red-400" onClick={() => setDeleting(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="font-medium text-zinc-100">Device information</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Info label="Name" value={device.name} />
          <Info label="IP address" value={device.ip} mono />
          <Info label="Port count" value={String(device.portCount)} />
          <Info label="Status" value={device.status === 'online' ? 'Online' : 'Offline'} />
          <Info label="Owner ID" value={String(device.ownerId)} />
          <Info label="Device ID" value={String(device.id)} />
          <Info label="Created" value={formatDate(device.createdAt)} />
          <Info label="Updated" value={formatDate(device.updatedAt)} />
        </dl>
      </Card>

      <Card className="border-dashed p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">Phase 2 boundary</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">CPU, memory, VLAN, PoE, traffic and topology are intentionally not displayed until the backend exposes real device telemetry.</p>
      </Card>

      <DeviceFormModal open={editing} device={device} onClose={() => setEditing(false)} />
      <DeleteDeviceModal device={deleting ? device : null} onClose={() => setDeleting(false)} onDeleted={() => router.replace('/devices')} />
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs uppercase tracking-wide text-zinc-600">{label}</dt><dd className={`mt-1.5 text-sm text-zinc-300 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>;
}

function Message({ title, description }: { title: string; description: string }) {
  return <div className="mx-auto max-w-3xl"><Card className="p-8"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-zinc-500">{description}</p><Link href="/devices" className="mt-6 inline-flex text-sm text-cyan-400 hover:text-cyan-300">Return to devices</Link></Card></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useCreateDevice, useUpdateDevice } from '../hooks';
import { deviceSchema, type DeviceFormValues } from '../schema';
import type { Device } from '../types';

const EMPTY_VALUES: DeviceFormValues = {
  name: '',
  ip: '',
  portCount: 24,
  status: 'offline',
};

interface DeviceFormModalProps {
  open: boolean;
  device?: Device | null;
  onClose: () => void;
}

export function DeviceFormModal({ open, device, onClose }: DeviceFormModalProps) {
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      device
        ? {
            name: device.name,
            ip: device.ip,
            portCount: device.portCount,
            status: device.status,
          }
        : EMPTY_VALUES,
    );
    setSubmitError(null);
  }, [device, open, reset]);

  if (!open) return null;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (device) {
        await updateMutation.mutateAsync({ id: device.id, payload: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'Unable to save device.',
      );
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="presentation">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="device-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Device</p>
            <h2 id="device-dialog-title" className="mt-2 text-xl font-semibold text-zinc-100">
              {device ? 'Edit device' : 'Add device'}
            </h2>
          </div>
          <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200" type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <Field label="Name" error={errors.name?.message}>
            <Input placeholder="SW-Core-01" {...register('name')} />
          </Field>
          <Field label="IPv4 address" error={errors.ip?.message}>
            <Input placeholder="192.168.1.10" inputMode="decimal" {...register('ip')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Port count" error={errors.portCount?.message}>
              <Input type="number" min={1} max={128} {...register('portCount', { valueAsNumber: true })} />
            </Field>
            <Field label="Status" error={errors.status?.message}>
              <select className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-cyan-500" {...register('status')}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </Field>
          </div>

          {submitError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{submitError}</div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save device'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-400">{error}</span> : null}
    </label>
  );
}

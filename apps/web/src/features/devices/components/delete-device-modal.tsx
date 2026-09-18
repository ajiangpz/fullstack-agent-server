'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useDeleteDevice } from '../hooks';
import type { Device } from '../types';

interface DeleteDeviceModalProps {
  device: Device | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteDeviceModal({ device, onClose, onDeleted }: DeleteDeviceModalProps) {
  const mutation = useDeleteDevice();
  const [error, setError] = useState<string | null>(null);

  if (!device) return null;

  async function remove() {
    setError(null);
    try {
      await mutation.mutateAsync(device.id);
      onDeleted?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to delete device.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="presentation">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="delete-device-title">
        <h2 id="delete-device-title" className="text-xl font-semibold text-zinc-100">Delete device?</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          <span className="font-medium text-zinc-200">{device.name}</span> ({device.ip}) will be permanently removed.
        </p>
        {error ? <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-red-500 text-white hover:bg-red-400" disabled={mutation.isPending}
            onClick={() => {
              void remove();
            }}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

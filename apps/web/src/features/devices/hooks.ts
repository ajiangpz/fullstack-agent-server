'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  updateDevice,
} from './api';
import type { DevicePayload, DeviceQuery } from './types';

export function useDevices(query: DeviceQuery) {
  return useQuery({
    queryKey: ['devices', query],
    queryFn: () => listDevices(query),
  });
}

export function useDevice(id: number) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => getDevice(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DevicePayload }) =>
      updateDevice(id, payload),
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['device', device.id] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDevice,
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.removeQueries({ queryKey: ['device', device.id] });
    },
  });
}

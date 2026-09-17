import { apiRequest } from '@/lib/api-client';
import { buildDeviceQuery } from './query';
import type {
  Device,
  DevicePayload,
  DeviceQuery,
  PaginatedDevices,
} from './types';

export function listDevices(query: DeviceQuery) {
  return apiRequest<PaginatedDevices>(`/devices?${buildDeviceQuery(query)}`);
}

export function getDevice(id: number) {
  return apiRequest<Device>(`/devices/${id}`);
}

export function createDevice(payload: DevicePayload) {
  return apiRequest<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDevice(id: number, payload: Partial<DevicePayload>) {
  return apiRequest<Device>(`/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDevice(id: number) {
  return apiRequest<Device>(`/devices/${id}`, { method: 'DELETE' });
}

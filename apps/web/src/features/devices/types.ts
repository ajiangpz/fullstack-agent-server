export const DEVICE_STATUSES = ['online', 'offline'] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export type DevicePortStatus = 'up' | 'down';

export interface Device {
  id: number;
  name: string;
  ip: string;
  portCount: number;
  status: DeviceStatus;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DevicePort {
  id: number;
  deviceId: number;
  portNumber: number;
  status: DevicePortStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DevicePortsResult {
  device: Pick<Device, 'id' | 'name' | 'ip'>;
  items: DevicePort[];
  total: number;
}

export interface DevicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedDevices {
  items: Device[];
  pagination: DevicePagination;
}

export interface DeviceQuery {
  page: number;
  limit: number;
  search?: string;
  status?: DeviceStatus;
  minPortCount?: number;
  maxPortCount?: number;
}

export interface DevicePayload {
  name: string;
  ip: string;
  portCount: number;
  status: DeviceStatus;
}

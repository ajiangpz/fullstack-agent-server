export const DEVICE_STATUSES = ['online', 'offline'] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

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

import type { DeviceQuery } from './types';

export function buildDeviceQuery(query: DeviceQuery) {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));

  const search = query.search?.trim();
  if (search) params.set('search', search);
  if (query.status) params.set('status', query.status);
  if (query.minPortCount !== undefined) {
    params.set('minPortCount', String(query.minPortCount));
  }
  if (query.maxPortCount !== undefined) {
    params.set('maxPortCount', String(query.maxPortCount));
  }

  return params.toString();
}

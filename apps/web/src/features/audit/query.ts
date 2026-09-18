import type { AuditQuery } from './types';

export function buildAuditQuery(query: AuditQuery) {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));

  if (query.action) params.set('action', query.action);

  const resourceType = query.resourceType?.trim();
  if (resourceType) params.set('resourceType', resourceType);

  if (query.actorId !== undefined) {
    params.set('actorId', String(query.actorId));
  }

  return params.toString();
}

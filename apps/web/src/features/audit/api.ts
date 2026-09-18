import { apiRequest } from '@/lib/api-client';
import { buildAuditQuery } from './query';
import type { AuditQuery, PaginatedAuditLogs } from './types';

export function listAuditLogs(query: AuditQuery) {
  return apiRequest<PaginatedAuditLogs>(
    `/audit-logs?${buildAuditQuery(query)}`,
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from './api';
import type { AuditQuery } from './types';

export function useAuditLogs(query: AuditQuery, enabled: boolean) {
  return useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => listAuditLogs(query),
    enabled,
  });
}

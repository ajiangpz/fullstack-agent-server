export const AUDIT_ACTIONS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'DEVICE_CREATED',
  'DEVICE_UPDATED',
  'DEVICE_DELETED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  id: number;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  actorId: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditQuery {
  page: number;
  limit: number;
  action?: AuditAction;
  resourceType?: string;
  actorId?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

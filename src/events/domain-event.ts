import type { AuditAction } from '../generated/prisma/enums';

export const DOMAIN_EVENT_NAME = 'domain.audit';

export interface DomainEventPayload {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  actorId?: number;
  metadata?: Record<string, unknown>;
}

export class DomainEvent {
  constructor(readonly payload: DomainEventPayload) {}
}

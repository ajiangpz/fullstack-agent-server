import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AuditLog, Prisma } from '../generated/prisma/client';
import { DOMAIN_EVENT_NAME, DomainEvent } from '../events/domain-event';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

export interface PaginatedAuditLogs {
  items: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(DOMAIN_EVENT_NAME, { async: true })
  async record(event: DomainEvent): Promise<void> {
    const { action, resourceType, resourceId, actorId, metadata } =
      event.payload;

    await this.prisma.auditLog.create({
      data: {
        action,
        resourceType,
        resourceId,
        actorId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findAll(query = new QueryAuditLogsDto()): Promise<PaginatedAuditLogs> {
    const { page, limit, action, resourceType, actorId } = query;
    const where: Prisma.AuditLogWhereInput = {
      action,
      resourceType: resourceType?.trim() || undefined,
      actorId,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

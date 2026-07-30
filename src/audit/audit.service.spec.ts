import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '../generated/prisma/enums';
import { DomainEvent } from '../events/domain-event';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('should persist a domain event as an audit log', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 1 });
    const event = new DomainEvent({
      action: AuditAction.DEVICE_UPDATED,
      resourceType: 'device',
      resourceId: '8',
      actorId: 2,
      metadata: { changedFields: ['name'] },
    });

    await service.record(event);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: event.payload,
    });
  });

  it('should return filtered and paginated audit logs', async () => {
    const items = [{ id: 1, action: AuditAction.USER_LOGGED_IN }];
    prisma.auditLog.findMany.mockResolvedValue(items);
    prisma.auditLog.count.mockResolvedValue(21);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        action: AuditAction.USER_LOGGED_IN,
        resourceType: ' user ',
        actorId: 3,
      }),
    ).resolves.toEqual({
      items,
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    });
    const where = {
      action: AuditAction.USER_LOGGED_IN,
      resourceType: 'user',
      actorId: 3,
    };
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where,
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where });
  });
});

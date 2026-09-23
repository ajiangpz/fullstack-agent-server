import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { AuditAction, UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT_NAME, DomainEvent } from '../events/domain-event';
import { TopologyRealtimeCoordinator } from '../topology/topology-realtime.coordinator';

describe('DevicesService', () => {
  let service: DevicesService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let topologyRealtime: { recordSiteChange: jest.Mock };

  const device = {
    id: 1,
    name: 'Office Switch',
    ip: '192.168.1.10',
    portCount: 8,
    status: 'online',
    type: 'SWITCH',
    macAddress: null,
    serialNumber: null,
    vendor: null,
    model: null,
    lastSeenAt: null,
    metadata: null,
    ownerId: 2,
    siteId: 'site-2',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const user: AuthenticatedUser = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  const admin: AuthenticatedUser = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const knownRequestError = (code: string, meta?: Record<string, unknown>) =>
    new Prisma.PrismaClientKnownRequestError('Database request failed', {
      code,
      clientVersion: '7.9.0',
      meta,
    });

  beforeEach(async () => {
    prisma = {
      device: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(device),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      networkSite: {
        findFirst: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'site-2' }),
        update: jest.fn().mockResolvedValue({ topologyRevision: 1 }),
      },
      topologyLink: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    prisma.$transaction = jest.fn(
      async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    eventEmitter = { emit: jest.fn() };
    topologyRealtime = {
      recordSiteChange: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: TopologyRealtimeCoordinator, useValue: topologyRealtime },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('returns paginated devices scoped to a regular user', async () => {
    prisma.device.findMany.mockResolvedValue([device]);
    prisma.device.count.mockResolvedValue(1);

    const result = await service.findAll(user);

    expect(result.pagination.total).toBe(1);
    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: user.id }),
      }),
    );
  });

  it('rejects an invalid port range', async () => {
    await expect(
      service.findAll(user, {
        page: 1,
        limit: 20,
        minPortCount: 48,
        maxPortCount: 8,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows administrators to find any device', async () => {
    await service.findOne(1, admin);
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('creates a device and increments the site topology revision atomically', async () => {
    const dto = {
      name: 'Core Switch',
      ip: '192.168.1.30',
      portCount: 24,
      status: 'online' as const,
    };
    const created = { ...device, id: 3, ...dto };
    prisma.device.create.mockResolvedValue(created);

    await expect(service.create(dto, user)).resolves.toEqual(created);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.networkSite.update).toHaveBeenCalledWith({
      where: { id: 'site-2' },
      data: { topologyRevision: { increment: 1 } },
      select: { topologyRevision: true },
    });
    expect(topologyRealtime.recordSiteChange).toHaveBeenCalledWith(
      'site-2',
      0,
      1,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DOMAIN_EVENT_NAME,
      new DomainEvent({
        action: AuditAction.DEVICE_CREATED,
        resourceType: 'device',
        resourceId: '3',
        actorId: user.id,
        metadata: {
          name: created.name,
          ip: created.ip,
          siteId: created.siteId,
        },
      }),
    );
  });

  it('updates a device and publishes the next revision', async () => {
    const updated = { ...device, portCount: 24 };
    prisma.device.update.mockResolvedValue(updated);
    prisma.networkSite.update.mockResolvedValue({ topologyRevision: 8 });

    await service.update(1, { portCount: 24 }, user);

    expect(topologyRealtime.recordSiteChange).toHaveBeenCalledWith(
      'site-2',
      7,
      8,
    );
  });

  it('rejects moving a device that still has topology links', async () => {
    prisma.networkSite.findFirst.mockResolvedValue({ id: 'site-3' });
    prisma.topologyLink.count.mockResolvedValue(1);

    await expect(
      service.update(1, { siteId: 'site-3' }, user),
    ).rejects.toThrow(ConflictException);
    expect(prisma.device.update).not.toHaveBeenCalled();
  });

  it('deletes a device and publishes the next revision', async () => {
    prisma.device.delete.mockResolvedValue(device);
    prisma.networkSite.update.mockResolvedValue({ topologyRevision: 4 });

    await service.remove(1, user);

    expect(topologyRealtime.recordSiteChange).toHaveBeenCalledWith(
      'site-2',
      3,
      4,
    );
  });

  it('maps site-scoped uniqueness errors to ConflictException', async () => {
    prisma.device.create.mockRejectedValue(
      knownRequestError('P2002', { target: ['siteId', 'name'] }),
    );

    await expect(
      service.create(
        {
          name: 'Core Switch',
          ip: '192.168.1.30',
          portCount: 24,
          status: 'online',
        },
        user,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('hides devices that are not owned by the caller', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    await expect(service.findOne(99, user)).rejects.toThrow(NotFoundException);
  });
});

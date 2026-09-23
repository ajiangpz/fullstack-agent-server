import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TopologyQueryService } from './topology-query.service';
import { TopologyRealtimeBus } from './topology-realtime-bus';

describe('TopologyQueryService', () => {
  let service: TopologyQueryService;
  let prisma: any;
  let tx: any;
  let realtimeBus: {
    getSnapshot: jest.Mock;
    cacheSnapshot: jest.Mock;
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

  beforeEach(async () => {
    tx = {
      networkSite: { findUnique: jest.fn() },
      device: { findMany: jest.fn() },
      topologyLink: { findMany: jest.fn() },
    };
    prisma = {
      networkSite: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      ),
    };
    realtimeBus = {
      getSnapshot: jest.fn().mockResolvedValue(null),
      cacheSnapshot: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: TopologyRealtimeBus, useValue: realtimeBus },
      ],
    }).compile();

    service = module.get(TopologyQueryService);
  });

  it('lists only sites owned by a regular user', async () => {
    prisma.networkSite.findMany.mockResolvedValue([]);
    await service.listSites(user);
    expect(prisma.networkSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: user.id } }),
    );
  });

  it('allows administrators to list all sites', async () => {
    prisma.networkSite.findMany.mockResolvedValue([]);
    await service.listSites(admin);
    expect(prisma.networkSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('returns a Redis snapshot when its revision matches PostgreSQL', async () => {
    const cached = {
      schemaVersion: 1 as const,
      site: { id: 'site-2', name: 'Default Site' },
      revision: 7,
      generatedAt: new Date(),
      nodes: [],
      edges: [],
    };
    prisma.networkSite.findFirst.mockResolvedValue({
      id: 'site-2',
      topologyRevision: 7,
    });
    realtimeBus.getSnapshot.mockResolvedValue(cached);

    await expect(service.getTopology('site-2', user)).resolves.toBe(cached);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rebuilds and caches a snapshot when Redis is missing or stale', async () => {
    const lastSeenAt = new Date('2026-09-23T00:00:00.000Z');
    prisma.networkSite.findFirst.mockResolvedValue({
      id: 'site-2',
      topologyRevision: 7,
    });
    tx.networkSite.findUnique.mockResolvedValue({
      id: 'site-2',
      name: 'Default Site',
      topologyRevision: 7,
    });
    tx.device.findMany.mockResolvedValue([
      {
        id: 12,
        name: 'Core Switch',
        ip: '192.168.1.2',
        status: 'online',
        type: 'SWITCH',
        portCount: 24,
        vendor: 'Tenda',
        model: 'SW-24',
        macAddress: null,
        lastSeenAt,
      },
    ]);
    tx.topologyLink.findMany.mockResolvedValue([]);

    const result = await service.getTopology('site-2', user);

    expect(result.revision).toBe(7);
    expect(result.nodes[0].id).toBe('device:12');
    expect(realtimeBus.cacheSnapshot).toHaveBeenCalledWith(result);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  });

  it('hides inaccessible sites', async () => {
    prisma.networkSite.findFirst.mockResolvedValue(null);
    await expect(service.getTopology('foreign-site', user)).rejects.toThrow(
      NotFoundException,
    );
    expect(realtimeBus.getSnapshot).not.toHaveBeenCalled();
  });

  it('lets administrators access any site', async () => {
    prisma.networkSite.findFirst.mockResolvedValue({
      id: 'site-9',
      topologyRevision: 0,
    });
    realtimeBus.getSnapshot.mockResolvedValue({
      schemaVersion: 1,
      site: { id: 'site-9', name: 'Branch' },
      revision: 0,
      generatedAt: new Date(),
      nodes: [],
      edges: [],
    });

    await service.getTopology('site-9', admin);

    expect(prisma.networkSite.findFirst).toHaveBeenCalledWith({
      where: { id: 'site-9' },
      select: { id: true, topologyRevision: true },
    });
  });
});

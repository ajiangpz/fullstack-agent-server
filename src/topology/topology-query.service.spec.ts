import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TopologyQueryService } from './topology-query.service';

describe('TopologyQueryService', () => {
  let service: TopologyQueryService;
  let prisma: {
    networkSite: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    networkSite: {
      findFirst: jest.Mock;
    };
    device: {
      findMany: jest.Mock;
    };
    topologyLink: {
      findMany: jest.Mock;
    };
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
      networkSite: {
        findFirst: jest.fn(),
      },
      device: {
        findMany: jest.fn(),
      },
      topologyLink: {
        findMany: jest.fn(),
      },
    };

    prisma = {
      networkSite: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyQueryService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TopologyQueryService>(TopologyQueryService);
  });

  it('should list only sites owned by a regular user', async () => {
    prisma.networkSite.findMany.mockResolvedValue([]);

    await service.listSites(user);

    expect(prisma.networkSite.findMany).toHaveBeenCalledWith({
      where: { ownerId: user.id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        topologyRevision: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('should allow administrators to list all sites', async () => {
    prisma.networkSite.findMany.mockResolvedValue([]);

    await service.listSites(admin);

    expect(prisma.networkSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('should return a namespaced topology snapshot', async () => {
    const lastSeenAt = new Date('2026-09-23T00:00:00.000Z');
    tx.networkSite.findFirst.mockResolvedValue({
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
        macAddress: '00:11:22:33:44:55',
        lastSeenAt,
      },
      {
        id: 18,
        name: 'AP-01',
        ip: '192.168.1.18',
        status: 'online',
        type: 'ACCESS_POINT',
        portCount: 1,
        vendor: 'Tenda',
        model: 'AP-01',
        macAddress: '00:11:22:33:44:66',
        lastSeenAt,
      },
    ]);
    tx.topologyLink.findMany.mockResolvedValue([
      {
        id: 'link-1',
        aDeviceId: 12,
        zDeviceId: 18,
        linkType: 'ETHERNET',
        status: 'UP',
        discoverySource: 'LLDP',
        speedMbps: 1000,
        confidence: 1,
        lastSeenAt,
        aPort: { id: 1, name: 'GE1/0/1', ifIndex: 1 },
        zPort: { id: 2, name: 'eth0', ifIndex: 1 },
      },
    ]);

    const result = await service.getTopology('site-2', user);

    expect(tx.networkSite.findFirst).toHaveBeenCalledWith({
      where: { id: 'site-2', ownerId: user.id },
      select: {
        id: true,
        name: true,
        topologyRevision: true,
      },
    });
    expect(result.schemaVersion).toBe(1);
    expect(result.revision).toBe(7);
    expect(result.nodes.map((node) => node.id)).toEqual([
      'device:12',
      'device:18',
    ]);
    expect(result.edges[0]).toEqual({
      id: 'link:link-1',
      linkId: 'link-1',
      source: 'device:12',
      target: 'device:18',
      sourcePort: { id: 1, name: 'GE1/0/1', ifIndex: 1 },
      targetPort: { id: 2, name: 'eth0', ifIndex: 1 },
      linkType: 'ETHERNET',
      status: 'UP',
      discoverySource: 'LLDP',
      speedMbps: 1000,
      confidence: 1,
      lastSeenAt,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  });

  it('should hide a site not owned by a regular user', async () => {
    tx.networkSite.findFirst.mockResolvedValue(null);

    await expect(service.getTopology('foreign-site', user)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.device.findMany).not.toHaveBeenCalled();
    expect(tx.topologyLink.findMany).not.toHaveBeenCalled();
  });

  it('should allow an administrator to read any site', async () => {
    tx.networkSite.findFirst.mockResolvedValue({
      id: 'site-9',
      name: 'Branch',
      topologyRevision: 0,
    });
    tx.device.findMany.mockResolvedValue([]);
    tx.topologyLink.findMany.mockResolvedValue([]);

    await service.getTopology('site-9', admin);

    expect(tx.networkSite.findFirst).toHaveBeenCalledWith({
      where: { id: 'site-9' },
      select: {
        id: true,
        name: true,
        topologyRevision: true,
      },
    });
  });
});

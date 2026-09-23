import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { DiscoverySource, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TOPOLOGY_QUEUE } from './topology.constants';
import { getQueueToken } from '@nestjs/bullmq';
import { TopologyDiscoveryProviderRegistry } from './topology-discovery-provider.registry';
import { TopologyDiscoveryService } from './topology-discovery.service';

describe('TopologyDiscoveryService', () => {
  let service: TopologyDiscoveryService;
  const prisma = {
    networkSite: { findFirst: jest.fn() },
    discoveryRun: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const providers = { get: jest.fn() };
  const queue = { add: jest.fn() };

  const user: AuthenticatedUser = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  const run = {
    id: 'run-1',
    siteId: 'site-1',
    requestedById: 2,
    source: DiscoverySource.MANUAL,
    status: 'PENDING',
    observationCount: 0,
    resolvedObservationCount: 0,
    reconciledLinkCount: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.networkSite.findFirst.mockResolvedValue({ id: 'site-1' });
    prisma.discoveryRun.create.mockResolvedValue(run);
    providers.get.mockReturnValue({ source: DiscoverySource.MANUAL });
    queue.add.mockResolvedValue({ id: 'job-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyDiscoveryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TopologyDiscoveryProviderRegistry,
          useValue: providers,
        },
        { provide: getQueueToken(TOPOLOGY_QUEUE), useValue: queue as Queue },
      ],
    }).compile();

    service = module.get(TopologyDiscoveryService);
  });

  it('creates a durable run before enqueueing discovery', async () => {
    const result = await service.create(
      'site-1',
      {
        source: DiscoverySource.MANUAL,
        observations: [
          { localDeviceId: 1, remoteDeviceId: 2 },
        ],
      },
      user,
    );

    expect(prisma.discoveryRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        siteId: 'site-1',
        requestedById: user.id,
        source: DiscoverySource.MANUAL,
      }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'discover-site-topology',
      { runId: 'run-1' },
      expect.objectContaining({ attempts: 3 }),
    );
    expect(result.id).toBe('run-1');
  });

  it('rejects discovery for an inaccessible site', async () => {
    prisma.networkSite.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        'foreign-site',
        {
          source: DiscoverySource.MANUAL,
          observations: [{ localDeviceId: 1, remoteDeviceId: 2 }],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.discoveryRun.create).not.toHaveBeenCalled();
  });

  it('rejects a discovery source without a configured provider', async () => {
    providers.get.mockImplementation(() => {
      throw new BadRequestException('not configured');
    });

    await expect(
      service.create(
        'site-1',
        { source: DiscoverySource.LLDP },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

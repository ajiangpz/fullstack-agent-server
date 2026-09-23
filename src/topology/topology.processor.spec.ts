import type { Job, Queue } from 'bullmq';
import { DiscoverySource } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOPOLOGY_DISCOVERY_JOB,
  TOPOLOGY_RECONCILE_JOB,
} from './topology.constants';
import { TopologyDiscoveryProviderRegistry } from './topology-discovery-provider.registry';
import { TopologyObservationResolver } from './topology-observation-resolver';
import { TopologyProcessor } from './topology.processor';
import { TopologyReconciler } from './topology-reconciler';

describe('TopologyProcessor', () => {
  const prisma: any = {
    discoveryRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    topologyObservation: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  const providers = { get: jest.fn() };
  const resolver = { resolve: jest.fn() };
  const reconciler = { reconcile: jest.fn() };
  const queue = { add: jest.fn() };
  let processor: TopologyProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TopologyProcessor(
      prisma as PrismaService,
      providers as unknown as TopologyDiscoveryProviderRegistry,
      resolver as unknown as TopologyObservationResolver,
      reconciler as unknown as TopologyReconciler,
      queue as unknown as Queue,
    );
  });

  it('collects observations durably before enqueueing reconciliation', async () => {
    prisma.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-1',
      siteId: 'site-1',
      source: DiscoverySource.MANUAL,
      status: 'PENDING',
      requestPayload: { observations: [] },
      startedAt: null,
    });
    providers.get.mockReturnValue({
      discover: jest.fn().mockResolvedValue([{ localDeviceId: 1 }]),
    });
    resolver.resolve.mockResolvedValue([
      {
        runId: 'run-1',
        source: DiscoverySource.MANUAL,
        localDeviceId: 1,
        canonicalKey: 'device:1--device:2',
        resolutionError: null,
        observedAt: new Date(),
        confidence: 1,
        linkType: 'ETHERNET',
        linkStatus: 'UP',
      },
    ]);

    await processor.process(job(TOPOLOGY_DISCOVERY_JOB));

    expect(prisma.topologyObservation.createMany).toHaveBeenCalled();
    expect(prisma.discoveryRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECONCILING',
          observationCount: 1,
          resolvedObservationCount: 1,
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      TOPOLOGY_RECONCILE_JOB,
      { runId: 'run-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('delegates reconcile jobs to the reconciler', async () => {
    prisma.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'RECONCILING',
    });
    reconciler.reconcile.mockResolvedValue({});

    await processor.process(job(TOPOLOGY_RECONCILE_JOB));

    expect(reconciler.reconcile).toHaveBeenCalledWith('run-1');
  });

  it('returns discovery runs to PENDING before a retry', async () => {
    prisma.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-1',
      siteId: 'site-1',
      source: DiscoverySource.MANUAL,
      status: 'PENDING',
      requestPayload: {},
      startedAt: null,
    });
    providers.get.mockReturnValue({
      discover: jest.fn().mockRejectedValue(new Error('temporary')),
    });
    prisma.discoveryRun.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      processor.process(job(TOPOLOGY_DISCOVERY_JOB, 0)),
    ).rejects.toThrow('temporary');

    expect(prisma.discoveryRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
  });

  function job(name: string, attemptsMade = 0) {
    return {
      name,
      data: { runId: 'run-1' },
      attemptsMade,
      opts: { attempts: 3 },
    } as Job<{ runId: string }, void, string>;
  }
});

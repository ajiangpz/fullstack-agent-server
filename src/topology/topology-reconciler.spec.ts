import { PrismaService } from '../prisma/prisma.service';
import { DiscoverySource } from '../generated/prisma/enums';
import { TopologyRealtimeCoordinator } from './topology-realtime.coordinator';
import { TopologyReconciler } from './topology-reconciler';

describe('TopologyReconciler', () => {
  let tx: any;
  let prisma: any;
  const realtime = { recordSiteChange: jest.fn() };
  let reconciler: TopologyReconciler;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      discoveryRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      topologyLink: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      networkSite: {
        update: jest.fn().mockResolvedValue({ topologyRevision: 6 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          topologyRevision: 5,
        }),
      },
      device: { findMany: jest.fn() },
      devicePort: { findMany: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => unknown) => callback(tx),
      ),
    };
    reconciler = new TopologyReconciler(
      prisma as PrismaService,
      realtime as unknown as TopologyRealtimeCoordinator,
    );
  });

  it('chooses the strongest duplicate evidence and increments revision once', async () => {
    tx.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-1',
      siteId: 'site-1',
      source: DiscoverySource.MANUAL,
      status: 'RECONCILING',
      observations: [
        observation('obs-1', 0.6),
        observation('obs-2', 0.9),
      ],
    });
    tx.device.findMany.mockResolvedValue([{ id: 2 }, { id: 9 }]);
    tx.devicePort.findMany.mockResolvedValue([
      { id: 20, deviceId: 2 },
      { id: 90, deviceId: 9 },
    ]);

    const result = await reconciler.reconcile('run-1');

    expect(tx.topologyLink.upsert).toHaveBeenCalledTimes(1);
    expect(tx.topologyLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ confidence: 0.9 }),
      }),
    );
    expect(tx.networkSite.update).toHaveBeenCalledTimes(1);
    expect(result.revision).toBe(6);
    expect(realtime.recordSiteChange).toHaveBeenCalledWith(
      'site-1',
      5,
      6,
    );
  });

  it('drops stale resolved endpoints that no longer belong to the site', async () => {
    tx.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-1',
      siteId: 'site-1',
      source: DiscoverySource.MANUAL,
      status: 'RECONCILING',
      observations: [observation('obs-1', 1)],
    });
    tx.device.findMany.mockResolvedValue([{ id: 2 }]);
    tx.devicePort.findMany.mockResolvedValue([
      { id: 20, deviceId: 2 },
      { id: 90, deviceId: 9 },
    ]);

    const result = await reconciler.reconcile('run-1');

    expect(tx.topologyLink.upsert).not.toHaveBeenCalled();
    expect(tx.networkSite.update).not.toHaveBeenCalled();
    expect(result.revisionChanged).toBe(false);
  });

  it('does not let automatic evidence overwrite a manual canonical link', async () => {
    tx.discoveryRun.findUnique.mockResolvedValue({
      id: 'run-2',
      siteId: 'site-1',
      source: DiscoverySource.LLDP,
      status: 'RECONCILING',
      observations: [observation('obs-3', 1, DiscoverySource.LLDP)],
    });
    tx.device.findMany.mockResolvedValue([{ id: 2 }, { id: 9 }]);
    tx.devicePort.findMany.mockResolvedValue([
      { id: 20, deviceId: 2 },
      { id: 90, deviceId: 9 },
    ]);
    tx.topologyLink.findMany.mockResolvedValue([
      {
        id: 'link-1',
        canonicalKey: 'device:2:port:20--device:9:port:90',
        discoverySource: DiscoverySource.MANUAL,
        expiresAt: null,
      },
    ]);

    await reconciler.reconcile('run-2');

    expect(tx.topologyLink.upsert).not.toHaveBeenCalled();
  });

  function observation(
    id: string,
    confidence: number,
    source = DiscoverySource.MANUAL,
  ) {
    return {
      id,
      source,
      aDeviceId: 2,
      aPortId: 20,
      zDeviceId: 9,
      zPortId: 90,
      canonicalKey: 'device:2:port:20--device:9:port:90',
      linkType: 'ETHERNET',
      linkStatus: 'UP',
      speedMbps: 1000,
      confidence,
      observedAt: new Date('2026-09-23T00:00:00.000Z'),
      expiresAt: null,
    };
  }
});

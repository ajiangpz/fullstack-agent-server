import { TopologyQueryService } from './topology-query.service';
import { TopologyRealtimeBus } from './topology-realtime-bus';
import { TopologyRealtimeCoordinator } from './topology-realtime.coordinator';

describe('TopologyRealtimeCoordinator', () => {
  const previous = {
    schemaVersion: 1 as const,
    site: { id: 'site-1', name: 'Default Site' },
    revision: 1,
    generatedAt: new Date(),
    nodes: [],
    edges: [],
  };
  const next = {
    ...previous,
    revision: 2,
    generatedAt: new Date(),
  };

  it('publishes a patch when the cached base revision is available', async () => {
    const query = {
      buildSiteSnapshot: jest.fn().mockResolvedValue(next),
    } as unknown as TopologyQueryService;
    const bus = {
      getSnapshot: jest.fn().mockResolvedValue(previous),
      publishSnapshotAndEvent: jest.fn().mockResolvedValue(true),
    } as unknown as TopologyRealtimeBus;
    const coordinator = new TopologyRealtimeCoordinator(query, bus);

    await coordinator.recordSiteChange('site-1', 1, 2);

    expect(bus.publishSnapshotAndEvent).toHaveBeenCalledWith(
      next,
      expect.objectContaining({
        type: 'patch',
        baseRevision: 1,
        revision: 2,
      }),
    );
  });

  it('requests resync when the previous snapshot is unavailable', async () => {
    const query = {
      buildSiteSnapshot: jest.fn().mockResolvedValue(next),
    } as unknown as TopologyQueryService;
    const bus = {
      getSnapshot: jest.fn().mockResolvedValue(null),
      publishSnapshotAndEvent: jest.fn().mockResolvedValue(true),
    } as unknown as TopologyRealtimeBus;
    const coordinator = new TopologyRealtimeCoordinator(query, bus);

    await coordinator.recordSiteChange('site-1', 1, 2);

    expect(bus.publishSnapshotAndEvent).toHaveBeenCalledWith(
      next,
      expect.objectContaining({ type: 'resync', reason: 'snapshot-miss' }),
    );
  });
});

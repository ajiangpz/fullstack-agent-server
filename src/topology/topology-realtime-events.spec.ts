import type { TopologySnapshotDto } from './dto/topology.dto';
import {
  createTopologyPatch,
  createTopologyResync,
  isTopologyRealtimeEvent,
} from './topology-realtime-events';

function snapshot(revision: number): TopologySnapshotDto {
  return {
    schemaVersion: 1,
    site: { id: 'site-1', name: 'Default Site' },
    revision,
    generatedAt: new Date(),
    nodes: [
      {
        id: 'device:1',
        deviceId: 1,
        name: revision === 2 ? 'Core Switch' : 'Switch',
        ip: '10.0.0.1',
        status: 'online',
        type: 'SWITCH',
        portCount: 24,
        vendor: null,
        model: null,
        macAddress: null,
        lastSeenAt: null,
      },
    ],
    edges: [],
  };
}

describe('topology realtime events', () => {
  it('creates a minimal patch for sequential revisions', () => {
    const patch = createTopologyPatch(snapshot(1), snapshot(2));
    expect(patch).toEqual(
      expect.objectContaining({
        type: 'patch',
        siteId: 'site-1',
        baseRevision: 1,
        revision: 2,
      }),
    );
    expect(patch?.changes.nodes.upsert.map((node) => node.id)).toEqual([
      'device:1',
    ]);
  });

  it('refuses to create a patch across a revision gap', () => {
    expect(createTopologyPatch(snapshot(1), snapshot(3))).toBeNull();
  });

  it('validates resync events consumed from Redis', () => {
    const event = createTopologyResync('site-1', 4, 'revision-gap');
    expect(isTopologyRealtimeEvent(event)).toBe(true);
    expect(isTopologyRealtimeEvent({ ...event, type: 'unknown' })).toBe(false);
  });
});

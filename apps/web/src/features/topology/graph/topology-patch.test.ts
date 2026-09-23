import { describe, expect, it } from 'vitest';
import { applyTopologyPatch } from './topology-patch';
import type { TopologyPatchEvent, TopologySnapshot } from '../types';

const snapshot: TopologySnapshot = {
  schemaVersion: 1,
  site: { id: 'site-1', name: 'Default Site' },
  revision: 4,
  generatedAt: '2026-09-23T00:00:00.000Z',
  nodes: [
    {
      id: 'device:1',
      deviceId: 1,
      name: 'Switch',
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

function patch(): TopologyPatchEvent {
  return {
    schemaVersion: 1,
    type: 'patch',
    siteId: 'site-1',
    baseRevision: 4,
    revision: 5,
    emittedAt: '2026-09-23T00:01:00.000Z',
    changes: {
      nodes: {
        upsert: [{ ...snapshot.nodes[0], status: 'offline' }],
        remove: [],
      },
      edges: { upsert: [], remove: [] },
    },
  };
}

describe('applyTopologyPatch', () => {
  it('applies sequential non-structural patches', () => {
    const result = applyTopologyPatch(snapshot, patch());
    expect(result?.snapshot.revision).toBe(5);
    expect(result?.snapshot.nodes[0].status).toBe('offline');
    expect(result?.structural).toBe(false);
  });

  it('rejects a revision gap', () => {
    expect(
      applyTopologyPatch(snapshot, { ...patch(), baseRevision: 3 }),
    ).toBeNull();
  });

  it('marks node additions as structural', () => {
    const event = patch();
    event.changes.nodes.upsert.push({
      ...snapshot.nodes[0],
      id: 'device:2',
      deviceId: 2,
      name: 'AP',
      type: 'ACCESS_POINT',
    });
    expect(applyTopologyPatch(snapshot, event)?.structural).toBe(true);
  });
});

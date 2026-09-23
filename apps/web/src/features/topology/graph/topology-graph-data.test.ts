import { describe, expect, it } from 'vitest';
import { edgeVisual, nodeVisual, toG6GraphData } from './topology-graph-data';
import type { TopologySnapshot } from '../types';

const snapshot: TopologySnapshot = {
  schemaVersion: 1,
  site: { id: 'site-1', name: 'Default Site' },
  revision: 3,
  generatedAt: '2026-09-23T00:00:00.000Z',
  nodes: [
    { id: 'device:1', deviceId: 1, name: 'Core Switch', ip: '192.168.1.2', status: 'online', type: 'SWITCH', portCount: 24, vendor: null, model: null, macAddress: null, lastSeenAt: null },
    { id: 'device:2', deviceId: 2, name: 'AP-01', ip: '192.168.1.3', status: 'offline', type: 'ACCESS_POINT', portCount: 1, vendor: null, model: null, macAddress: null, lastSeenAt: null },
  ],
  edges: [
    { id: 'link:1', linkId: '1', source: 'device:1', target: 'device:2', sourcePort: null, targetPort: null, linkType: 'ETHERNET', status: 'UP', discoverySource: 'LLDP', speedMbps: 1000, confidence: 1, lastSeenAt: '2026-09-23T00:00:00.000Z' },
  ],
};

describe('topology graph data', () => {
  it('preserves namespaced node and edge identities', () => {
    const graphData = toG6GraphData(snapshot);
    expect(graphData.nodes?.map((node) => node.id)).toEqual(['device:1', 'device:2']);
    expect(graphData.edges?.[0]).toMatchObject({ id: 'link:1', source: 'device:1', target: 'device:2' });
  });

  it('maps health to stable visual semantics', () => {
    expect(nodeVisual('online').stroke).toBe('#22c55e');
    expect(nodeVisual('offline').stroke).toBe('#ef4444');
    expect(edgeVisual('DOWN').stroke).toBe('#ef4444');
    expect(edgeVisual('DEGRADED').stroke).toBe('#f59e0b');
  });
});

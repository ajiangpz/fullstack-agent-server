import { describe, expect, it } from 'vitest';
import {
  buildTopologyHierarchy,
  computeTopologyVisibility,
  findTopologyNode,
} from './topology-view';
import type { TopologySnapshot } from '../types';

const snapshot: TopologySnapshot = {
  schemaVersion: 1,
  site: { id: 'site-1', name: 'Default Site' },
  revision: 1,
  generatedAt: '2026-09-23T00:00:00.000Z',
  nodes: [
    { id: 'device:1', deviceId: 1, name: 'Access Switch', ip: '10.0.0.2', status: 'online', type: 'SWITCH', portCount: 24, vendor: null, model: null, macAddress: null, lastSeenAt: null },
    { id: 'device:2', deviceId: 2, name: 'Lobby AP', ip: '10.0.0.3', status: 'offline', type: 'ACCESS_POINT', portCount: 1, vendor: null, model: null, macAddress: null, lastSeenAt: null },
    { id: 'device:9', deviceId: 9, name: 'Gateway', ip: '10.0.0.1', status: 'online', type: 'GATEWAY', portCount: 4, vendor: null, model: null, macAddress: null, lastSeenAt: null },
  ],
  edges: [
    { id: 'link:1', linkId: '1', source: 'device:1', target: 'device:9', sourcePort: null, targetPort: null, linkType: 'ETHERNET', status: 'UP', discoverySource: 'LLDP', speedMbps: 1000, confidence: 1, lastSeenAt: '2026-09-23T00:00:00.000Z' },
    { id: 'link:2', linkId: '2', source: 'device:1', target: 'device:2', sourcePort: null, targetPort: null, linkType: 'ETHERNET', status: 'UP', discoverySource: 'LLDP', speedMbps: 1000, confidence: 1, lastSeenAt: '2026-09-23T00:00:00.000Z' },
  ],
};

describe('topology view projection', () => {
  it('uses gateway semantics instead of canonical A/Z ordering for hierarchy', () => {
    const hierarchy = buildTopologyHierarchy(snapshot);
    expect(hierarchy.parentByNode['device:9']).toBeNull();
    expect(hierarchy.parentByNode['device:1']).toBe('device:9');
    expect(hierarchy.edgeDirection['link:1']).toEqual({
      source: 'device:9',
      target: 'device:1',
    });
  });

  it('hides descendants when a branch is collapsed', () => {
    const hierarchy = buildTopologyHierarchy(snapshot);
    const visibility = computeTopologyVisibility(snapshot, hierarchy, {
      status: 'all',
      type: 'ALL',
      collapsedNodeIds: ['device:1'],
    });
    expect([...visibility.visibleNodeIds].sort()).toEqual([
      'device:1',
      'device:9',
    ]);
    expect([...visibility.visibleEdgeIds]).toEqual(['link:1']);
  });

  it('combines status and device-type filters', () => {
    const hierarchy = buildTopologyHierarchy(snapshot);
    const visibility = computeTopologyVisibility(snapshot, hierarchy, {
      status: 'offline',
      type: 'ACCESS_POINT',
      collapsedNodeIds: [],
    });
    expect([...visibility.visibleNodeIds]).toEqual(['device:2']);
    expect([...visibility.visibleEdgeIds]).toEqual([]);
  });

  it('searches by exact IP and partial name', () => {
    expect(findTopologyNode(snapshot, '10.0.0.1')?.id).toBe('device:9');
    expect(findTopologyNode(snapshot, 'lobby')?.id).toBe('device:2');
  });
});

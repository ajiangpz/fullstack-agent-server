import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { UserRole } from '../generated/prisma/enums';
import { TopologyMetricsRange } from './dto/topology-metrics.dto';
import { TopologyAgentService } from './topology-agent.service';
import { TopologyMetricsService } from './topology-metrics.service';
import { TopologyQueryService } from './topology-query.service';

describe('TopologyAgentService', () => {
  const user: AuthenticatedUser = {
    id: 7,
    username: 'john',
    email: 'john@example.com',
    role: UserRole.USER,
  };

  const snapshot = {
    schemaVersion: 1 as const,
    site: { id: 'site-1', name: 'Default Site' },
    revision: 5,
    generatedAt: new Date(),
    nodes: [
      node(1, 'Gateway'),
      node(2, 'Switch'),
      node(3, 'AP'),
      node(4, 'Client'),
    ],
    edges: [
      edge('l1', 1, 2, 'UP'),
      edge('l2', 2, 3, 'UP'),
      edge('l3', 3, 4, 'DEGRADED'),
    ],
  };

  const query = {
    listSites: jest.fn(),
    getTopology: jest.fn(),
  };
  const metrics = {
    getDeviceSeries: jest.fn(),
    getLinkSeries: jest.fn(),
  };
  let service: TopologyAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    query.getTopology.mockResolvedValue(snapshot);
    service = new TopologyAgentService(
      query as unknown as TopologyQueryService,
      metrics as unknown as TopologyMetricsService,
    );
  });

  it('returns only direct neighbors with link context', async () => {
    const result = await service.getNeighbors('site-1', 2, user);

    expect(result.totalNeighbors).toBe(2);
    expect(result.neighbors.map((item) => item.device.deviceId)).toEqual([
      3,
      1,
    ]);
    expect(result.neighbors[0].link.linkId).toBe('l2');
  });

  it('accepts namespaced topology link IDs from snapshot results', async () => {
    const result = await service.getLink('site-1', 'link:l2', user);

    expect(result.link.linkId).toBe('l2');
  });

  it('finds the shortest observed topology path by hop count', async () => {
    const result = await service.findPath('site-1', 1, 4, user);

    expect(result.found).toBe(true);
    expect(result.hopCount).toBe(3);
    expect(result.nodes.map((item) => item.deviceId)).toEqual([1, 2, 3, 4]);
    expect(result.steps.map((item) => item.link.linkId)).toEqual([
      'l1',
      'l2',
      'l3',
    ]);
    expect(result.semantics).toContain('not an L3 routing path');
  });

  it('returns a normal not-found path result for disconnected devices', async () => {
    query.getTopology.mockResolvedValue({
      ...snapshot,
      edges: [edge('l1', 1, 2, 'UP')],
    });

    const result = await service.findPath('site-1', 1, 4, user);

    expect(result.found).toBe(false);
    expect(result.hopCount).toBeNull();
  });

  it('rejects devices that are not in the authorized topology snapshot', async () => {
    await expect(
      service.getNeighbors('site-1', 99, user),
    ).rejects.toThrow(NotFoundException);
  });

  it('summarizes downsampled device metrics for agent context', async () => {
    metrics.getDeviceSeries.mockResolvedValue({
      deviceId: 2,
      range: TopologyMetricsRange.ONE_HOUR,
      from: '2026-09-24T00:00:00.000Z',
      to: '2026-09-24T01:00:00.000Z',
      points: [
        {
          sampledAt: '2026-09-24T00:00:00.000Z',
          rxBitsPerSecond: 100,
          txBitsPerSecond: 200,
          cpuPercent: 20,
          memoryPercent: 40,
          temperatureCelsius: 50,
        },
        {
          sampledAt: '2026-09-24T00:01:00.000Z',
          rxBitsPerSecond: 300,
          txBitsPerSecond: 400,
          cpuPercent: 60,
          memoryPercent: 50,
          temperatureCelsius: 52,
        },
      ],
    });

    const result = await service.getDeviceMetrics(
      'site-1',
      2,
      TopologyMetricsRange.ONE_HOUR,
      user,
    );

    expect(metrics.getDeviceSeries).toHaveBeenCalledWith(
      'site-1',
      2,
      { range: TopologyMetricsRange.ONE_HOUR, points: 30 },
      user,
    );
    expect(result.summary.average.rxBitsPerSecond).toBe(200);
    expect(result.summary.peak.cpuPercent).toBe(60);
  });

  function node(deviceId: number, name: string) {
    return {
      id: 'device:' + deviceId,
      deviceId,
      name,
      ip: '10.0.0.' + deviceId,
      status: 'online' as const,
      type: 'SWITCH' as const,
      portCount: 8,
      vendor: null,
      model: null,
      macAddress: null,
      lastSeenAt: null,
    };
  }

  function edge(
    linkId: string,
    sourceId: number,
    targetId: number,
    status: 'UP' | 'DEGRADED',
  ) {
    return {
      id: 'link:' + linkId,
      linkId,
      source: 'device:' + sourceId,
      target: 'device:' + targetId,
      sourcePort: null,
      targetPort: null,
      linkType: 'ETHERNET' as const,
      status,
      discoverySource: 'MANUAL' as const,
      speedMbps: 1000,
      confidence: 1,
      lastSeenAt: new Date(),
    };
  }
});

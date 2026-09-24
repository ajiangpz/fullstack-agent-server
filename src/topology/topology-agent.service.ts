import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import type {
  DeviceMetricPointDto,
  TopologyLinkMetricPointDto,
} from './dto/topology-metrics.dto';
import { TopologyMetricsRange } from './dto/topology-metrics.dto';
import type {
  TopologyEdgeDto,
  TopologyNodeDto,
} from './dto/topology.dto';
import { TopologyMetricsService } from './topology-metrics.service';
import { TopologyQueryService } from './topology-query.service';

@Injectable()
export class TopologyAgentService {
  constructor(
    private readonly topologyQuery: TopologyQueryService,
    private readonly topologyMetrics: TopologyMetricsService,
  ) {}

  async listSites(user: AuthenticatedUser, limit = 50) {
    const sites = await this.topologyQuery.listSites(user);
    return {
      total: sites.length,
      sites: sites.slice(0, limit).map((site) => ({
        id: site.id,
        name: site.name,
        topologyRevision: site.topologyRevision,
      })),
    };
  }

  async getNeighbors(
    siteId: string,
    deviceId: number,
    user: AuthenticatedUser,
    limit = 25,
  ) {
    const snapshot = await this.topologyQuery.getTopology(siteId, user);
    const node = this.requireNode(snapshot.nodes, deviceId);
    const incident = snapshot.edges
      .filter(
        (edge) => edge.source === node.id || edge.target === node.id,
      )
      .map((edge) => {
        const neighborId =
          edge.source === node.id ? edge.target : edge.source;
        const neighbor = snapshot.nodes.find(
          (candidate) => candidate.id === neighborId,
        );
        return neighbor ? { edge, neighbor } : null;
      })
      .filter(
        (
          item,
        ): item is { edge: TopologyEdgeDto; neighbor: TopologyNodeDto } =>
          item !== null,
      )
      .sort(
        (left, right) =>
          left.neighbor.name.localeCompare(right.neighbor.name) ||
          left.edge.linkId.localeCompare(right.edge.linkId),
      );

    return {
      site: snapshot.site,
      revision: snapshot.revision,
      device: node,
      totalNeighbors: incident.length,
      neighbors: incident.slice(0, limit).map(({ edge, neighbor }) => ({
        device: neighbor,
        link: edge,
        traversalDirection:
          edge.source === node.id ? 'A_TO_Z' : 'Z_TO_A',
      })),
    };
  }

  async getLink(
    siteId: string,
    linkId: string,
    user: AuthenticatedUser,
  ) {
    const snapshot = await this.topologyQuery.getTopology(siteId, user);
    const rawLinkId = this.rawLinkId(linkId);
    const edge = snapshot.edges.find(
      (candidate) => candidate.linkId === rawLinkId,
    );

    if (!edge) {
      throw new NotFoundException(
        'Topology link ' + rawLinkId + ' not found',
      );
    }

    return {
      site: snapshot.site,
      revision: snapshot.revision,
      link: edge,
      sourceDevice:
        snapshot.nodes.find((node) => node.id === edge.source) ?? null,
      targetDevice:
        snapshot.nodes.find((node) => node.id === edge.target) ?? null,
    };
  }

  async findPath(
    siteId: string,
    fromDeviceId: number,
    toDeviceId: number,
    user: AuthenticatedUser,
  ) {
    const snapshot = await this.topologyQuery.getTopology(siteId, user);
    const start = this.requireNode(snapshot.nodes, fromDeviceId);
    const target = this.requireNode(snapshot.nodes, toDeviceId);

    if (start.id === target.id) {
      return {
        site: snapshot.site,
        revision: snapshot.revision,
        found: true,
        hopCount: 0,
        nodes: [start],
        steps: [],
        semantics:
          'Shortest path by hop count over observed topology links; not an L3 routing path.',
      };
    }

    const adjacency = new Map<
      string,
      Array<{ edge: TopologyEdgeDto; nextId: string }>
    >();
    for (const edge of [...snapshot.edges].sort((a, b) =>
      a.linkId.localeCompare(b.linkId),
    )) {
      this.addAdjacency(adjacency, edge.source, edge.target, edge);
      this.addAdjacency(adjacency, edge.target, edge.source, edge);
    }

    const queue = [start.id];
    const visited = new Set<string>([start.id]);
    const previous = new Map<
      string,
      { nodeId: string; edge: TopologyEdgeDto }
    >();

    while (queue.length > 0 && !visited.has(target.id)) {
      const current = queue.shift()!;
      for (const item of adjacency.get(current) ?? []) {
        if (visited.has(item.nextId)) continue;
        visited.add(item.nextId);
        previous.set(item.nextId, {
          nodeId: current,
          edge: item.edge,
        });
        queue.push(item.nextId);
      }
    }

    if (!visited.has(target.id)) {
      return {
        site: snapshot.site,
        revision: snapshot.revision,
        found: false,
        hopCount: null,
        nodes: [start, target],
        steps: [],
        semantics:
          'No path exists in the currently observed topology graph. This is not an L3 routing calculation.',
      };
    }

    const nodeIds = [target.id];
    const reversedSteps: Array<{
      fromId: string;
      toId: string;
      edge: TopologyEdgeDto;
    }> = [];
    let cursor = target.id;

    while (cursor !== start.id) {
      const item = previous.get(cursor);
      if (!item) break;
      reversedSteps.push({
        fromId: item.nodeId,
        toId: cursor,
        edge: item.edge,
      });
      nodeIds.push(item.nodeId);
      cursor = item.nodeId;
    }

    nodeIds.reverse();
    reversedSteps.reverse();
    const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));

    return {
      site: snapshot.site,
      revision: snapshot.revision,
      found: true,
      hopCount: reversedSteps.length,
      nodes: nodeIds
        .map((id) => nodesById.get(id))
        .filter((node): node is TopologyNodeDto => Boolean(node)),
      steps: reversedSteps.map((step) => ({
        fromDevice: nodesById.get(step.fromId) ?? null,
        toDevice: nodesById.get(step.toId) ?? null,
        link: step.edge,
        traversalDirection:
          step.edge.source === step.fromId ? 'A_TO_Z' : 'Z_TO_A',
      })),
      semantics:
        'Shortest path by hop count over observed topology links; not an L3 routing path.',
    };
  }

  async getDeviceMetrics(
    siteId: string,
    deviceId: number,
    range: TopologyMetricsRange,
    user: AuthenticatedUser,
  ) {
    const series = await this.topologyMetrics.getDeviceSeries(
      siteId,
      deviceId,
      { range, points: 30 },
      user,
    );

    return {
      ...series,
      summary: this.summarizeDeviceMetrics(series.points),
    };
  }

  async getLinkMetrics(
    siteId: string,
    linkId: string,
    range: TopologyMetricsRange,
    user: AuthenticatedUser,
  ) {
    const series = await this.topologyMetrics.getLinkSeries(
      siteId,
      this.rawLinkId(linkId),
      { range, points: 30 },
      user,
    );

    return {
      ...series,
      summary: this.summarizeLinkMetrics(series.points),
    };
  }

  private rawLinkId(linkId: string): string {
    return linkId.startsWith('link:') ? linkId.slice(5) : linkId;
  }

  private requireNode(nodes: TopologyNodeDto[], deviceId: number) {
    const node = nodes.find((candidate) => candidate.deviceId === deviceId);
    if (!node) {
      throw new NotFoundException('Device ' + deviceId + ' not found');
    }
    return node;
  }

  private addAdjacency(
    adjacency: Map<
      string,
      Array<{ edge: TopologyEdgeDto; nextId: string }>
    >,
    fromId: string,
    nextId: string,
    edge: TopologyEdgeDto,
  ): void {
    const items = adjacency.get(fromId) ?? [];
    items.push({ edge, nextId });
    adjacency.set(fromId, items);
  }

  private summarizeDeviceMetrics(points: DeviceMetricPointDto[]) {
    return {
      sampleCount: points.length,
      latest: points.at(-1) ?? null,
      average: {
        rxBitsPerSecond: this.average(
          points.map((point) => point.rxBitsPerSecond),
        ),
        txBitsPerSecond: this.average(
          points.map((point) => point.txBitsPerSecond),
        ),
        cpuPercent: this.average(points.map((point) => point.cpuPercent)),
        memoryPercent: this.average(
          points.map((point) => point.memoryPercent),
        ),
        temperatureCelsius: this.average(
          points.map((point) => point.temperatureCelsius),
        ),
      },
      peak: {
        rxBitsPerSecond: this.max(
          points.map((point) => point.rxBitsPerSecond),
        ),
        txBitsPerSecond: this.max(
          points.map((point) => point.txBitsPerSecond),
        ),
        cpuPercent: this.max(points.map((point) => point.cpuPercent)),
        memoryPercent: this.max(
          points.map((point) => point.memoryPercent),
        ),
        temperatureCelsius: this.max(
          points.map((point) => point.temperatureCelsius),
        ),
      },
    };
  }

  private summarizeLinkMetrics(points: TopologyLinkMetricPointDto[]) {
    return {
      sampleCount: points.length,
      latest: points.at(-1) ?? null,
      average: {
        aToZBitsPerSecond: this.average(
          points.map((point) => point.aToZBitsPerSecond),
        ),
        zToABitsPerSecond: this.average(
          points.map((point) => point.zToABitsPerSecond),
        ),
        utilizationPercent: this.average(
          points.map((point) => point.utilizationPercent),
        ),
        errorRatePercent: this.average(
          points.map((point) => point.errorRatePercent),
        ),
        packetLossPercent: this.average(
          points.map((point) => point.packetLossPercent),
        ),
      },
      peak: {
        aToZBitsPerSecond: this.max(
          points.map((point) => point.aToZBitsPerSecond),
        ),
        zToABitsPerSecond: this.max(
          points.map((point) => point.zToABitsPerSecond),
        ),
        utilizationPercent: this.max(
          points.map((point) => point.utilizationPercent),
        ),
        errorRatePercent: this.max(
          points.map((point) => point.errorRatePercent),
        ),
        packetLossPercent: this.max(
          points.map((point) => point.packetLossPercent),
        ),
      },
    };
  }

  private average(values: Array<number | null>): number | null {
    const present = values.filter((value): value is number => value !== null);
    if (present.length === 0) return null;
    return present.reduce((sum, value) => sum + value, 0) / present.length;
  }

  private max(values: Array<number | null>): number | null {
    const present = values.filter((value): value is number => value !== null);
    return present.length === 0 ? null : Math.max(...present);
  }
}

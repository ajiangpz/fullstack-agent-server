import { TopologyMetricsRange } from '../../topology/dto/topology-metrics.dto';
import type { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext } from './agent-tool.interface';
import {
  FindTopologyPathTool,
  findTopologyPathSchema,
} from './find-topology-path.tool';
import {
  GetDeviceTopologyMetricsTool,
  getDeviceTopologyMetricsSchema,
} from './get-device-topology-metrics.tool';
import {
  GetLinkTopologyMetricsTool,
  getLinkTopologyMetricsSchema,
} from './get-link-topology-metrics.tool';
import {
  GetTopologyLinkTool,
  getTopologyLinkSchema,
} from './get-topology-link.tool';
import {
  GetTopologyNeighborsTool,
  getTopologyNeighborsSchema,
} from './get-topology-neighbors.tool';
import {
  ListNetworkSitesTool,
  listNetworkSitesSchema,
} from './list-network-sites.tool';

describe('topology agent tools', () => {
  const user = {
    id: 7,
    username: 'john',
    email: 'john@example.com',
    role: 'USER',
  } as AgentContext['user'];

  const context: AgentContext = {
    user,
    taskId: 'task-1',
    leaseToken: 'lease-1',
    signal: new AbortController().signal,
  };

  const topology = {
    listSites: jest.fn(),
    getNeighbors: jest.fn(),
    getLink: jest.fn(),
    findPath: jest.fn(),
    getDeviceMetrics: jest.fn(),
    getLinkMetrics: jest.fn(),
  } as unknown as TopologyAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only sites resolved from the authenticated context', async () => {
    const tool = new ListNetworkSitesTool(topology);
    (topology.listSites as jest.Mock).mockResolvedValue({
      total: 0,
      sites: [],
    });

    await tool.execute({}, context);

    expect(topology.listSites).toHaveBeenCalledWith(user, 50);
    expect(listNetworkSitesSchema.safeParse({ extra: true }).success).toBe(
      false,
    );
  });

  it('forwards topology neighbor requests with a bounded limit', async () => {
    const tool = new GetTopologyNeighborsTool(topology);
    (topology.getNeighbors as jest.Mock).mockResolvedValue({
      totalNeighbors: 0,
      neighbors: [],
    });

    await tool.execute(
      { siteId: 'site-1', deviceId: 12, limit: 20 },
      context,
    );

    expect(topology.getNeighbors).toHaveBeenCalledWith(
      'site-1',
      12,
      user,
      20,
    );
    expect(
      getTopologyNeighborsSchema.safeParse({
        siteId: 'site-1',
        deviceId: 12,
        limit: 51,
      }).success,
    ).toBe(false);
  });

  it('forwards raw topology link IDs through the authorized facade', async () => {
    const tool = new GetTopologyLinkTool(topology);
    (topology.getLink as jest.Mock).mockResolvedValue({});

    await tool.execute({ siteId: 'site-1', linkId: 'link-db-id' }, context);

    expect(topology.getLink).toHaveBeenCalledWith(
      'site-1',
      'link-db-id',
      user,
    );
    expect(
      getTopologyLinkSchema.safeParse({
        siteId: '',
        linkId: 'link-db-id',
      }).success,
    ).toBe(false);
  });

  it('forwards shortest-topology-path requests without L3 parameters', async () => {
    const tool = new FindTopologyPathTool(topology);
    (topology.findPath as jest.Mock).mockResolvedValue({ found: true });

    await tool.execute(
      {
        siteId: 'site-1',
        fromDeviceId: 1,
        toDeviceId: 9,
      },
      context,
    );

    expect(topology.findPath).toHaveBeenCalledWith(
      'site-1',
      1,
      9,
      user,
    );
    expect(
      findTopologyPathSchema.safeParse({
        siteId: 'site-1',
        fromDeviceId: 0,
        toDeviceId: 9,
      }).success,
    ).toBe(false);
  });

  it('uses a safe metrics range default for device telemetry', async () => {
    const tool = new GetDeviceTopologyMetricsTool(topology);
    (topology.getDeviceMetrics as jest.Mock).mockResolvedValue({});

    await tool.execute({ siteId: 'site-1', deviceId: 2 }, context);

    expect(topology.getDeviceMetrics).toHaveBeenCalledWith(
      'site-1',
      2,
      TopologyMetricsRange.SIX_HOURS,
      user,
    );
    expect(
      getDeviceTopologyMetricsSchema.safeParse({
        siteId: 'site-1',
        deviceId: 2,
        range: '30d',
      }).success,
    ).toBe(false);
  });

  it('forwards explicit link telemetry ranges', async () => {
    const tool = new GetLinkTopologyMetricsTool(topology);
    (topology.getLinkMetrics as jest.Mock).mockResolvedValue({});

    await tool.execute(
      {
        siteId: 'site-1',
        linkId: 'link-db-id',
        range: TopologyMetricsRange.ONE_HOUR,
      },
      context,
    );

    expect(topology.getLinkMetrics).toHaveBeenCalledWith(
      'site-1',
      'link-db-id',
      TopologyMetricsRange.ONE_HOUR,
      user,
    );
    expect(
      getLinkTopologyMetricsSchema.safeParse({
        siteId: 'site-1',
        linkId: '',
      }).success,
    ).toBe(false);
  });
});

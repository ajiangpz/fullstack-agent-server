import { NotFoundException } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { TopologyAgentService } from '../topology/topology-agent.service';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';
import { ListNetworkSitesTool } from './tools/list-network-sites.tool';
import { GetTopologyNeighborsTool } from './tools/get-topology-neighbors.tool';
import { GetTopologyLinkTool } from './tools/get-topology-link.tool';
import { FindTopologyPathTool } from './tools/find-topology-path.tool';
import { GetDeviceTopologyMetricsTool } from './tools/get-device-topology-metrics.tool';
import { GetLinkTopologyMetricsTool } from './tools/get-link-topology-metrics.tool';
import { ToolRegistry } from './tool-registry';

describe('ToolRegistry', () => {
  const devicesService = {} as DevicesService;
  const getDeviceTool = new GetDeviceTool(devicesService);
  const listDevicesTool = new ListDevicesTool(devicesService);
  const searchDevicesTool = new SearchDevicesTool(devicesService);
  const topology = {} as TopologyAgentService;
  const listNetworkSitesTool = new ListNetworkSitesTool(topology);
  const getTopologyNeighborsTool = new GetTopologyNeighborsTool(topology);
  const getTopologyLinkTool = new GetTopologyLinkTool(topology);
  const findTopologyPathTool = new FindTopologyPathTool(topology);
  const getDeviceTopologyMetricsTool = new GetDeviceTopologyMetricsTool(topology);
  const getLinkTopologyMetricsTool = new GetLinkTopologyMetricsTool(topology);
  const registry = new ToolRegistry(
    getDeviceTool,
    listDevicesTool,
    searchDevicesTool,
    listNetworkSitesTool,
    getTopologyNeighborsTool,
    getTopologyLinkTool,
    findTopologyPathTool,
    getDeviceTopologyMetricsTool,
    getLinkTopologyMetricsTool,
  );

  it('gets registered tools by name', () => {
    expect(registry.get('get_device')).toBe(getDeviceTool);
    expect(registry.get('list_devices')).toBe(listDevicesTool);
    expect(registry.get('search_devices')).toBe(searchDevicesTool);
    expect(registry.get('list_network_sites')).toBe(listNetworkSitesTool);
    expect(registry.get('get_topology_neighbors')).toBe(
      getTopologyNeighborsTool,
    );
    expect(registry.get('find_topology_path')).toBe(findTopologyPathTool);
  });

  it('lists registered tools', () => {
    expect(registry.list()).toEqual([
      getDeviceTool,
      listDevicesTool,
      searchDevicesTool,
      listNetworkSitesTool,
      getTopologyNeighborsTool,
      getTopologyLinkTool,
      findTopologyPathTool,
      getDeviceTopologyMetricsTool,
      getLinkTopologyMetricsTool,
    ]);
  });

  it('rejects unknown tools', () => {
    expect(() => registry.get('unknown')).toThrow(
      new NotFoundException('Unknown tool: unknown'),
    );
  });
});

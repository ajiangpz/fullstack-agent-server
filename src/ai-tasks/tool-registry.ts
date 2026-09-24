import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentTool } from './tools/agent-tool.interface';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';
import { ListNetworkSitesTool } from './tools/list-network-sites.tool';
import { GetTopologyNeighborsTool } from './tools/get-topology-neighbors.tool';
import { GetTopologyLinkTool } from './tools/get-topology-link.tool';
import { FindTopologyPathTool } from './tools/find-topology-path.tool';
import { GetDeviceTopologyMetricsTool } from './tools/get-device-topology-metrics.tool';
import { GetLinkTopologyMetricsTool } from './tools/get-link-topology-metrics.tool';

@Injectable()
export class ToolRegistry {
  // Registry 是 Agent 可执行能力的白名单，模型返回的任意名称都必须先经过这里。
  private readonly tools = new Map<string, AgentTool>();

  constructor(
    private readonly getDeviceTool: GetDeviceTool,
    private readonly listDevicesTool: ListDevicesTool,
    private readonly searchDevicesTool: SearchDevicesTool,
    private readonly listNetworkSitesTool: ListNetworkSitesTool,
    private readonly getTopologyNeighborsTool: GetTopologyNeighborsTool,
    private readonly getTopologyLinkTool: GetTopologyLinkTool,
    private readonly findTopologyPathTool: FindTopologyPathTool,
    private readonly getDeviceTopologyMetricsTool: GetDeviceTopologyMetricsTool,
    private readonly getLinkTopologyMetricsTool: GetLinkTopologyMetricsTool,
  ) {
    this.register(getDeviceTool);
    this.register(listDevicesTool);
    this.register(searchDevicesTool);
    this.register(listNetworkSitesTool);
    this.register(getTopologyNeighborsTool);
    this.register(getTopologyLinkTool);
    this.register(findTopologyPathTool);
    this.register(getDeviceTopologyMetricsTool);
    this.register(getLinkTopologyMetricsTool);
  }

  private register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new NotFoundException(`Unknown tool: ${name}`);
    }

    return tool;
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }
}

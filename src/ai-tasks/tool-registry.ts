import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentTool } from './tools/agent-tool.interface';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicePortsTool } from './tools/list-device-ports.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';

@Injectable()
export class ToolRegistry {
  // Registry 是 Agent 可执行能力的白名单，模型返回的任意名称都必须先经过这里。
  private readonly tools = new Map<string, AgentTool>();

  constructor(
    private readonly getDeviceTool: GetDeviceTool,
    private readonly listDevicePortsTool: ListDevicePortsTool,
    private readonly listDevicesTool: ListDevicesTool,
    private readonly searchDevicesTool: SearchDevicesTool,
  ) {
    this.register(getDeviceTool);
    this.register(listDevicePortsTool);
    this.register(listDevicesTool);
    this.register(searchDevicesTool);
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

import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentTool } from './tools/agent-tool.interface';
import { GetDeviceTool } from './tools/get-device.tool';

@Injectable()
export class ToolRegistry {
  // Registry 是 Agent 可执行能力的白名单，模型返回的任意名称都必须先经过这里。
  private readonly tools = new Map<string, AgentTool>();

  constructor(private readonly getDeviceTool: GetDeviceTool) {
    this.register(getDeviceTool);
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

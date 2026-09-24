import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const findTopologyPathSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  fromDeviceId: z.number().int().positive(),
  toDeviceId: z.number().int().positive(),
});

@Injectable()
export class FindTopologyPathTool
  implements AgentTool<typeof findTopologyPathSchema>
{
  readonly name = 'find_topology_path';

  readonly description =
    'Find the shortest path by hop count between two devices in the currently observed topology graph. This is a topology connectivity path, not an L3 routing-table or packet-forwarding path. Link states are returned so the model can identify degraded or down segments.';

  readonly schema = findTopologyPathSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      siteId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'Network site ID.',
      },
      fromDeviceId: {
        type: 'integer',
        minimum: 1,
        description: 'Starting device ID.',
      },
      toDeviceId: {
        type: 'integer',
        minimum: 1,
        description: 'Destination device ID.',
      },
    },
    required: ['siteId', 'fromDeviceId', 'toDeviceId'],
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    input: z.infer<typeof findTopologyPathSchema>,
    context: AgentContext,
  ) {
    return this.topology.findPath(
      input.siteId,
      input.fromDeviceId,
      input.toDeviceId,
      context.user,
    );
  }
}

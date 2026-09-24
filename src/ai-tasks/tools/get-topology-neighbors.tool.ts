import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const getTopologyNeighborsSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  deviceId: z.number().int().positive(),
  limit: z.number().int().min(1).max(50).optional(),
});

@Injectable()
export class GetTopologyNeighborsTool
  implements AgentTool<typeof getTopologyNeighborsSchema>
{
  readonly name = 'get_topology_neighbors';

  readonly description =
    'Get directly connected neighbors of a device in an observed topology, including the connecting link status, ports, speed, discovery source, and traversal direction. The current user must have access to the site.';

  readonly schema = getTopologyNeighborsSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      siteId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'Network site ID.',
      },
      deviceId: {
        type: 'integer',
        minimum: 1,
        description: 'Device ID whose direct topology neighbors are needed.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Maximum neighbors to return. Defaults to 25.',
      },
    },
    required: ['siteId', 'deviceId'],
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    input: z.infer<typeof getTopologyNeighborsSchema>,
    context: AgentContext,
  ) {
    return this.topology.getNeighbors(
      input.siteId,
      input.deviceId,
      context.user,
      input.limit ?? 25,
    );
  }
}

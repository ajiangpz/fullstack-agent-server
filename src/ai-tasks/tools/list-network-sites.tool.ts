import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const listNetworkSitesSchema = z.object({}).strict();

@Injectable()
export class ListNetworkSitesTool
  implements AgentTool<typeof listNetworkSitesSchema>
{
  readonly name = 'list_network_sites';

  readonly description =
    'List network sites the current user can access. Use this when a topology question does not already provide a site ID. Returns at most 50 sites.';

  readonly schema = listNetworkSitesSchema;

  readonly parameters = {
    type: 'object',
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    _input: z.infer<typeof listNetworkSitesSchema>,
    context: AgentContext,
  ) {
    return this.topology.listSites(context.user, 50);
  }
}

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const getTopologyLinkSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  linkId: z.string().trim().min(1).max(128),
});

@Injectable()
export class GetTopologyLinkTool
  implements AgentTool<typeof getTopologyLinkSchema>
{
  readonly name = 'get_topology_link';

  readonly description =
    'Get one observed topology link and its canonical A/Z endpoint devices, ports, status, speed, confidence, and discovery source. Accepts either the raw linkId or the namespaced id such as "link:abc" returned by topology results.';

  readonly schema = getTopologyLinkSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      siteId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'Network site ID.',
      },
      linkId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        description: 'Raw topology link ID or namespaced ID such as "link:abc".',
      },
    },
    required: ['siteId', 'linkId'],
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    input: z.infer<typeof getTopologyLinkSchema>,
    context: AgentContext,
  ) {
    return this.topology.getLink(input.siteId, input.linkId, context.user);
  }
}

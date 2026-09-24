import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopologyMetricsRange } from '../../topology/dto/topology-metrics.dto';
import { TopologyAgentService } from '../../topology/topology-agent.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

const metricRanges = [
  TopologyMetricsRange.ONE_HOUR,
  TopologyMetricsRange.SIX_HOURS,
  TopologyMetricsRange.TWENTY_FOUR_HOURS,
  TopologyMetricsRange.SEVEN_DAYS,
] as const;

export const getLinkTopologyMetricsSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  linkId: z.string().trim().min(1).max(128),
  range: z.enum(metricRanges).optional(),
});

@Injectable()
export class GetLinkTopologyMetricsTool
  implements AgentTool<typeof getLinkTopologyMetricsSchema>
{
  readonly name = 'get_link_topology_metrics';

  readonly description =
    'Get downsampled real telemetry for one canonical topology link, including A-to-Z and Z-to-A bits per second, utilization, error rate, and packet loss when samples exist. Returns about 30 time buckets plus latest, average, and peak summaries.';

  readonly schema = getLinkTopologyMetricsSchema;

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
      range: {
        type: 'string',
        enum: metricRanges,
        description: 'Metrics time range. Defaults to 6h.',
      },
    },
    required: ['siteId', 'linkId'],
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    input: z.infer<typeof getLinkTopologyMetricsSchema>,
    context: AgentContext,
  ) {
    return this.topology.getLinkMetrics(
      input.siteId,
      input.linkId,
      input.range ?? TopologyMetricsRange.SIX_HOURS,
      context.user,
    );
  }
}

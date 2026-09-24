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

export const getDeviceTopologyMetricsSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  deviceId: z.number().int().positive(),
  range: z.enum(metricRanges).optional(),
});

@Injectable()
export class GetDeviceTopologyMetricsTool
  implements AgentTool<typeof getDeviceTopologyMetricsSchema>
{
  readonly name = 'get_device_topology_metrics';

  readonly description =
    'Get downsampled real telemetry for a device, including RX/TX bits per second, CPU, memory, and temperature when samples exist. Returns about 30 time buckets plus latest, average, and peak summaries.';

  readonly schema = getDeviceTopologyMetricsSchema;

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
        description: 'Device ID.',
      },
      range: {
        type: 'string',
        enum: metricRanges,
        description: 'Metrics time range. Defaults to 6h.',
      },
    },
    required: ['siteId', 'deviceId'],
    additionalProperties: false,
  };

  constructor(private readonly topology: TopologyAgentService) {}

  execute(
    input: z.infer<typeof getDeviceTopologyMetricsSchema>,
    context: AgentContext,
  ) {
    return this.topology.getDeviceMetrics(
      input.siteId,
      input.deviceId,
      input.range ?? TopologyMetricsRange.SIX_HOURS,
      context.user,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DevicesService } from '../../devices/devices.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const listDevicePortsSchema = z.object({
  deviceId: z.number().int().positive(),
});

@Injectable()
export class ListDevicePortsTool
  implements AgentTool<typeof listDevicePortsSchema>
{
  readonly name = 'list_device_ports';

  readonly description =
    'List interface and port status for a device that the current user is allowed to access.';

  readonly schema = listDevicePortsSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      deviceId: {
        type: 'integer',
        description: 'Device ID whose ports should be listed.',
      },
    },
    required: ['deviceId'],
    additionalProperties: false,
  };

  constructor(private readonly devicesService: DevicesService) {}

  execute(
    input: z.infer<typeof listDevicePortsSchema>,
    context: AgentContext,
  ) {
    return this.devicesService.findPorts(input.deviceId, context.user);
  }
}

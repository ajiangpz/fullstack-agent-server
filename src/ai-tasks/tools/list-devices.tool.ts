import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DevicesService } from '../../devices/devices.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const listDevicesSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

@Injectable()
export class ListDevicesTool implements AgentTool<typeof listDevicesSchema> {
  readonly name = 'list_devices';

  readonly description =
    'List network devices that the current user is allowed to access. Use this for inventory or overview questions.';

  readonly schema = listDevicesSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        description: 'Page number. Defaults to 1.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Devices per page. Defaults to 20.',
      },
    },
    additionalProperties: false,
  };

  constructor(private readonly devicesService: DevicesService) {}

  execute(input: z.infer<typeof listDevicesSchema>, context: AgentContext) {
    return this.devicesService.findAll(context.user, {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
    });
  }
}

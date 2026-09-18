import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DevicesService } from '../../devices/devices.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

const deviceStatuses = ['online', 'offline'] as const;

export const searchDevicesSchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(deviceStatuses).optional(),
    minPortCount: z.number().int().min(1).max(128).optional(),
    maxPortCount: z.number().int().min(1).max(128).optional(),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .refine(
    (value) =>
      value.minPortCount === undefined ||
      value.maxPortCount === undefined ||
      value.minPortCount <= value.maxPortCount,
    {
      message: 'minPortCount cannot be greater than maxPortCount',
      path: ['maxPortCount'],
    },
  );

@Injectable()
export class SearchDevicesTool
  implements AgentTool<typeof searchDevicesSchema>
{
  readonly name = 'search_devices';

  readonly description =
    'Search network devices that the current user is allowed to access by name, exact IP, status, or port-count range.';

  readonly schema = searchDevicesSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Device name keyword or exact IP address.',
      },
      status: {
        type: 'string',
        enum: deviceStatuses,
        description: 'Filter by online or offline status.',
      },
      minPortCount: {
        type: 'integer',
        minimum: 1,
        maximum: 128,
        description: 'Minimum number of device ports.',
      },
      maxPortCount: {
        type: 'integer',
        minimum: 1,
        maximum: 128,
        description: 'Maximum number of device ports.',
      },
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

  execute(input: z.infer<typeof searchDevicesSchema>, context: AgentContext) {
    return this.devicesService.findAll(context.user, {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      search: input.search,
      status: input.status,
      minPortCount: input.minPortCount,
      maxPortCount: input.maxPortCount,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DevicesService } from '../../devices/devices.service';
import type { AgentContext, AgentTool } from './agent-tool.interface';

export const getDeviceSchema = z.object({
  deviceId: z.number().int().positive(),
});

@Injectable()
export class GetDeviceTool implements AgentTool<typeof getDeviceSchema> {
  readonly name = 'get_device';

  readonly description =
    'Get device information that the current user is allowed to access.';

  readonly schema = getDeviceSchema;

  readonly parameters = {
    type: 'object',
    properties: {
      deviceId: {
        type: 'integer',
        description: 'Device ID',
      },
    },
    required: ['deviceId'],
    additionalProperties: false,
  };

  constructor(private readonly devicesService: DevicesService) {}

  execute(input: z.infer<typeof getDeviceSchema>, context: AgentContext) {
    // 复用领域服务中的所有权过滤，避免 Agent 绕过现有设备访问控制。
    return this.devicesService.findOne(input.deviceId, context.user);
  }
}

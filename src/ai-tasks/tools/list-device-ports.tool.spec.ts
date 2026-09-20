import type { DevicesService } from '../../devices/devices.service';
import type { AgentContext } from './agent-tool.interface';
import {
  ListDevicePortsTool,
  listDevicePortsSchema,
} from './list-device-ports.tool';

describe('ListDevicePortsTool', () => {
  const user = {
    id: 7,
    username: 'john',
    email: 'john@example.com',
    role: 'USER',
  } as AgentContext['user'];

  const context: AgentContext = {
    user,
    taskId: 'task-1',
    leaseToken: 'lease-1',
    signal: new AbortController().signal,
  };

  it('queries ports through DevicesService ownership rules', async () => {
    const findPorts = jest.fn().mockResolvedValue({
      device: { id: 3, name: 'Core Switch', ip: '192.168.1.3' },
      items: [],
      total: 0,
    });
    const tool = new ListDevicePortsTool({
      findPorts,
    } as unknown as DevicesService);

    await tool.execute({ deviceId: 3 }, context);

    expect(findPorts).toHaveBeenCalledWith(3, user);
  });

  it('rejects an invalid device id', () => {
    expect(listDevicePortsSchema.safeParse({ deviceId: 0 }).success).toBe(
      false,
    );
  });
});

import type { DevicesService } from '../../devices/devices.service';
import type { AgentContext } from './agent-tool.interface';
import { ListDevicesTool, listDevicesSchema } from './list-devices.tool';

describe('ListDevicesTool', () => {
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

  it('uses safe defaults when pagination is omitted', async () => {
    const findAll = jest.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const tool = new ListDevicesTool({
      findAll,
    } as unknown as DevicesService);

    await tool.execute({}, context);

    expect(findAll).toHaveBeenCalledWith(user, { page: 1, limit: 20 });
  });

  it('forwards explicit pagination to DevicesService', async () => {
    const findAll = jest.fn().mockResolvedValue({
      items: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    });
    const tool = new ListDevicesTool({
      findAll,
    } as unknown as DevicesService);

    await tool.execute({ page: 2, limit: 10 }, context);

    expect(findAll).toHaveBeenCalledWith(user, { page: 2, limit: 10 });
  });

  it('rejects an excessive page size', () => {
    expect(listDevicesSchema.safeParse({ limit: 51 }).success).toBe(false);
  });
});

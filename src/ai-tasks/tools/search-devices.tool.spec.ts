import type { DevicesService } from '../../devices/devices.service';
import type { AgentContext } from './agent-tool.interface';
import { SearchDevicesTool, searchDevicesSchema } from './search-devices.tool';

describe('SearchDevicesTool', () => {
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

  it('forwards device filters with safe pagination defaults', async () => {
    const findAll = jest.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const tool = new SearchDevicesTool({
      findAll,
    } as unknown as DevicesService);

    await tool.execute(
      {
        search: 'core',
        status: 'offline',
        minPortCount: 24,
        maxPortCount: 48,
      },
      context,
    );

    expect(findAll).toHaveBeenCalledWith(user, {
      page: 1,
      limit: 20,
      search: 'core',
      status: 'offline',
      minPortCount: 24,
      maxPortCount: 48,
    });
  });

  it('rejects an invalid port range before tool execution', () => {
    expect(
      searchDevicesSchema.safeParse({
        minPortCount: 48,
        maxPortCount: 24,
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported device status', () => {
    expect(searchDevicesSchema.safeParse({ status: 'unknown' }).success).toBe(
      false,
    );
  });
});

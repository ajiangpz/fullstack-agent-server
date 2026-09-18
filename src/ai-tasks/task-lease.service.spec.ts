/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaService } from '../prisma/prisma.service';
import { AiTaskEventBus } from './ai-task-event-bus';
import { TaskLeaseService } from './task-lease.service';

describe('TaskLeaseService', () => {
  const prisma = { aiTask: { updateMany: jest.fn() } };
  const events = { publish: jest.fn().mockResolvedValue(true) };
  let service: TaskLeaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    events.publish.mockResolvedValue(true);
    service = new TaskLeaseService(
      prisma as unknown as PrismaService,
      events as unknown as AiTaskEventBus,
    );
  });

  it('claims pending tasks or processing tasks with an expired lease', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    const lease = await service.acquire('task-1');
    expect(lease).toEqual({ taskId: 'task-1', token: expect.any(String) });
    expect(prisma.aiTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'task-1',
          OR: expect.arrayContaining([
            { status: 'PENDING' },
            { status: 'PROCESSING', leaseExpiresAt: { lt: expect.any(Date) } },
          ]),
        }),
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      'task-1',
      'task.updated',
      expect.objectContaining({ status: 'PROCESSING' }),
    );
  });

  it('renews only the current ownership token', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.heartbeat({ taskId: 'task-1', token: 'stale-token' }),
    ).resolves.toBe(false);
    expect(prisma.aiTask.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        leaseToken: 'stale-token',
        status: 'PROCESSING',
      },
      data: { leaseExpiresAt: expect.any(Date) },
    });
  });
});

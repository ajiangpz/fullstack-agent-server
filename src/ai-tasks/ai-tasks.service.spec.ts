/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ServiceUnavailableException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import { AiTasksService } from './ai-tasks.service';

describe('AiTasksService', () => {
  const user: AuthenticatedUser = {
    id: 7,
    username: 'user',
    email: 'user@example.com',
    role: UserRole.USER,
  };
  const prisma = {
    aiTask: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const queue: Pick<Queue, 'add'> = { add: jest.fn() };
  let service: AiTasksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AiTasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(AI_TASK_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(AiTasksService);
  });

  it('persists a pending task before enqueueing a deterministic job', async () => {
    prisma.aiTask.create.mockResolvedValue({ id: 'task-1' });
    (queue.add as jest.Mock).mockResolvedValue({ id: 'task-1' });

    await expect(service.create({ prompt: 'hello' }, user)).resolves.toEqual({
      taskId: 'task-1',
    });

    expect(prisma.aiTask.create).toHaveBeenCalledWith({
      data: {
        prompt: 'hello',
        owner: { connect: { id: user.id } },
      },
      select: { id: true },
    });
    expect(queue.add).toHaveBeenCalledWith(
      AI_TASK_JOB,
      { taskId: 'task-1' },
      expect.objectContaining({ jobId: 'task-1', attempts: 3 }),
    );
  });

  it('marks the database task failed when enqueueing fails', async () => {
    prisma.aiTask.create.mockResolvedValue({ id: 'task-1' });
    (queue.add as jest.Mock).mockRejectedValue(new Error('redis unavailable'));
    prisma.aiTask.update.mockResolvedValue({});

    await expect(service.create({ prompt: 'hello' }, user)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(prisma.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'Task could not be queued',
      }),
    });
  });

  it('limits task lookup to the current user', async () => {
    prisma.aiTask.findFirst.mockResolvedValue({ id: 'task-1' });
    await service.findOne('task-1', user);
    expect(prisma.aiTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', ownerId: user.id },
        select: expect.objectContaining({
          steps: { orderBy: { sequence: 'asc' } },
        }),
      }),
    );
  });
});

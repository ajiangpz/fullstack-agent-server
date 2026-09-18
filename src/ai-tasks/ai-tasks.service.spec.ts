/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { getQueueToken } from '@nestjs/bullmq';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import {
  AiTaskStatus,
  ConversationMessageRole,
  UserRole,
} from '../generated/prisma/enums';
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

  const tx = {
    conversation: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    conversationMessage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    aiTask: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
    aiTask: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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

  it('claims the conversation and creates the task with a user message', async () => {
    tx.conversation.updateMany.mockResolvedValue({ count: 1 });
    tx.conversationMessage.findFirst.mockResolvedValue({ sequence: 2 });
    tx.aiTask.create.mockResolvedValue({
      id: 'task-1',
      conversationId: 'conv-1',
    });
    tx.conversationMessage.create.mockResolvedValue({});
    (queue.add as jest.Mock).mockResolvedValue({ id: 'task-1' });

    await expect(
      service.create({ conversationId: 'conv-1', prompt: 'hello' }, user),
    ).resolves.toEqual({ taskId: 'task-1' });

    expect(tx.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        ownerId: user.id,
        busy: false,
      },
      data: { busy: true },
    });
    expect(tx.aiTask.create).toHaveBeenCalledWith({
      data: {
        prompt: 'hello',
        ownerId: user.id,
        conversationId: 'conv-1',
      },
      select: {
        id: true,
        conversationId: true,
      },
    });
    expect(tx.conversationMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        taskId: 'task-1',
        role: ConversationMessageRole.USER,
        content: 'hello',
        sequence: 3,
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      AI_TASK_JOB,
      { taskId: 'task-1' },
      expect.objectContaining({ jobId: 'task-1', attempts: 3 }),
    );
  });

  it('rejects another task while the conversation is busy', async () => {
    tx.conversation.updateMany.mockResolvedValue({ count: 0 });
    tx.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });

    await expect(
      service.create({ conversationId: 'conv-1', prompt: 'hello' }, user),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.aiTask.create).not.toHaveBeenCalled();
  });

  it('hides conversations owned by another user', async () => {
    tx.conversation.updateMany.mockResolvedValue({ count: 0 });
    tx.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ conversationId: 'conv-other', prompt: 'hello' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'conv-other',
        ownerId: user.id,
      },
      select: { id: true },
    });
  });

  it('marks the task failed and releases the conversation when enqueueing fails', async () => {
    tx.conversation.updateMany.mockResolvedValue({ count: 1 });
    tx.conversationMessage.findFirst.mockResolvedValue(null);
    tx.aiTask.create.mockResolvedValue({
      id: 'task-1',
      conversationId: 'conv-1',
    });
    tx.conversationMessage.create.mockResolvedValue({});
    tx.aiTask.update.mockResolvedValue({});
    tx.conversation.update.mockResolvedValue({});
    (queue.add as jest.Mock).mockRejectedValue(new Error('redis unavailable'));

    await expect(
      service.create({ conversationId: 'conv-1', prompt: 'hello' }, user),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(tx.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'Task could not be queued',
      }),
    });
    expect(tx.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { busy: false },
    });
  });

  it('lists only the current users tasks with filters and step counts', async () => {
    prisma.aiTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        prompt: 'offline devices',
        status: AiTaskStatus.COMPLETED,
        errorMessage: null,
        attempts: 1,
        retryCount: 0,
        ownerId: user.id,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { steps: 5 },
      },
    ]);
    prisma.aiTask.count.mockResolvedValue(1);

    const result = await service.findAll(user, {
      page: 2,
      limit: 10,
      status: AiTaskStatus.COMPLETED,
      search: ' offline ',
    });

    expect(prisma.aiTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: user.id,
          status: AiTaskStatus.COMPLETED,
          prompt: {
            contains: 'offline',
            mode: 'insensitive',
          },
        },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.aiTask.count).toHaveBeenCalledWith({
      where: {
        ownerId: user.id,
        status: AiTaskStatus.COMPLETED,
        prompt: {
          contains: 'offline',
          mode: 'insensitive',
        },
      },
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'task-1', stepCount: 5 }),
    );
  });

  it('does not apply an owner filter for administrators', async () => {
    prisma.aiTask.findMany.mockResolvedValue([]);
    prisma.aiTask.count.mockResolvedValue(0);

    await service.findAll(
      { ...user, role: UserRole.ADMIN },
      { page: 1, limit: 20 },
    );

    expect(prisma.aiTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: undefined, prompt: undefined },
      }),
    );
  });

  it('limits task lookup to the current user and returns trace context', async () => {
    prisma.aiTask.findFirst.mockResolvedValue({ id: 'task-1' });
    await service.findOne('task-1', user);
    expect(prisma.aiTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', ownerId: user.id },
        select: expect.objectContaining({
          prompt: true,
          steps: { orderBy: { sequence: 'asc' } },
        }),
      }),
    );
  });
});

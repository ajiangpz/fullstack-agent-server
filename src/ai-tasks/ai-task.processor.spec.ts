/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { AiClient } from './ai-client';
import { AI_TASK_JOB } from './ai-task.constants';
import { AiTaskProcessor } from './ai-task.processor';

describe('AiTaskProcessor', () => {
  const prisma = {
    aiTask: {
      update: jest.fn(),
    },
  };
  const aiClient: AiClient = { generate: jest.fn() };
  let processor: AiTaskProcessor;

  const createJob = (
    overrides: Partial<Job<{ taskId: string }, void, string>> = {},
  ) =>
    ({
      name: AI_TASK_JOB,
      data: { taskId: 'task-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
      ...overrides,
    }) as Job<{ taskId: string }, void, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new AiTaskProcessor(
      prisma as unknown as PrismaService,
      aiClient,
    );
  });

  it('moves a task from processing to completed', async () => {
    prisma.aiTask.update
      .mockResolvedValueOnce({ prompt: 'hello' })
      .mockResolvedValueOnce({});
    (aiClient.generate as jest.Mock).mockResolvedValue('answer');

    await processor.process(createJob());

    expect(prisma.aiTask.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PROCESSING',
          attempts: { increment: 1 },
        }),
      }),
    );
    expect(prisma.aiTask.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        result: 'answer',
      }),
    });
  });

  it('leaves a retryable failure in processing state', async () => {
    prisma.aiTask.update.mockResolvedValueOnce({ prompt: 'hello' });
    (aiClient.generate as jest.Mock).mockRejectedValue(new Error('temporary'));

    await expect(processor.process(createJob())).rejects.toThrow('temporary');
    expect(prisma.aiTask.update).toHaveBeenCalledTimes(1);
  });

  it('marks a task failed after the final attempt', async () => {
    prisma.aiTask.update
      .mockResolvedValueOnce({ prompt: 'hello' })
      .mockResolvedValueOnce({});
    (aiClient.generate as jest.Mock).mockRejectedValue(new Error('permanent'));

    await expect(
      processor.process(createJob({ attemptsMade: 2 })),
    ).rejects.toThrow('permanent');
    expect(prisma.aiTask.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'permanent',
      }),
    });
  });
});

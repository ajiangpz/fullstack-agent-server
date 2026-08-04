/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AI_TASK_JOB } from './ai-task.constants';
import { AiTaskProcessor } from './ai-task.processor';
import type { AiProvider } from './providers/ai-provider';
import { AiProviderError } from './providers/ai-provider';

describe('AiTaskProcessor', () => {
  const prisma = {
    aiTask: {
      update: jest.fn(),
    },
  };
  const aiProvider: AiProvider = { generateText: jest.fn() };
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
      aiProvider,
    );
  });

  it('moves a task from processing to completed', async () => {
    prisma.aiTask.update
      .mockResolvedValueOnce({ prompt: 'hello' })
      .mockResolvedValueOnce({});
    (aiProvider.generateText as jest.Mock).mockResolvedValue({
      answer: 'answer',
      keyPoints: ['point'],
    });

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
        result: '{"answer":"answer","keyPoints":["point"]}',
      }),
    });
  });

  it('leaves a retryable failure in processing state', async () => {
    prisma.aiTask.update.mockResolvedValueOnce({ prompt: 'hello' });
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new Error('temporary'),
    );

    await expect(processor.process(createJob())).rejects.toThrow('temporary');
    expect(prisma.aiTask.update).toHaveBeenCalledTimes(1);
  });

  it('does not save a provider result that fails runtime validation', async () => {
    prisma.aiTask.update.mockResolvedValueOnce({ prompt: 'hello' });
    (aiProvider.generateText as jest.Mock).mockResolvedValue({
      answer: '',
      keyPoints: [],
    });

    await expect(processor.process(createJob())).rejects.toThrow(
      'AI response validation failed',
    );
    expect(prisma.aiTask.update).toHaveBeenCalledTimes(1);
  });

  it('marks a task failed after the final attempt', async () => {
    prisma.aiTask.update
      .mockResolvedValueOnce({ prompt: 'hello' })
      .mockResolvedValueOnce({});
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new Error('permanent'),
    );

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

  it('marks a non-retryable provider failure immediately', async () => {
    prisma.aiTask.update
      .mockResolvedValueOnce({ prompt: 'hello' })
      .mockResolvedValueOnce({});
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new AiProviderError('OpenAI authentication failed', false),
    );

    await expect(processor.process(createJob())).rejects.toThrow(
      'OpenAI authentication failed',
    );
    expect(prisma.aiTask.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'OpenAI authentication failed',
      }),
    });
  });
});

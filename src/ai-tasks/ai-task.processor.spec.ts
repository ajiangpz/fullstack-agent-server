/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import type { Job } from 'bullmq';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AgentStepService } from './agent-step.service';
import { AI_TASK_JOB } from './ai-task.constants';
import { AiTaskProcessor } from './ai-task.processor';
import type { AiProvider } from './providers/ai-provider';

describe('AiTaskProcessor', () => {
  const prisma = {
    aiTask: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const agentSteps = {
    createRunning: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
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
      agentSteps as unknown as AgentStepService,
      aiProvider,
    );
  });

  it('claims a pending task and completes its model-call step', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({ prompt: 'hello' });
    agentSteps.createRunning.mockResolvedValue({ id: 'step-1' });
    (aiProvider.generateText as jest.Mock).mockResolvedValue({
      answer: 'answer',
      keyPoints: ['point'],
    });

    await processor.process(createJob());

    expect(prisma.aiTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      }),
    );
    expect(agentSteps.createRunning).toHaveBeenCalledWith(
      'task-1',
      AgentStepType.MODEL_CALL,
    );
    expect(agentSteps.complete).toHaveBeenCalledWith(
      'step-1',
      'task-1',
      '{"answer":"answer","keyPoints":["point"]}',
    );
  });

  it('does nothing when another worker already claimed the task', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 0 });

    await processor.process(createJob());

    expect(prisma.aiTask.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(agentSteps.createRunning).not.toHaveBeenCalled();
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  it('fails the step, restores the task, and rethrows model errors', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({ prompt: 'hello' });
    agentSteps.createRunning.mockResolvedValue({ id: 'step-1' });
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new Error('temporary'),
    );

    await expect(processor.process(createJob())).rejects.toThrow('temporary');
    expect(agentSteps.fail).toHaveBeenCalledWith(
      'step-1',
      'task-1',
      'temporary',
      false,
    );
  });

  it('marks the task as final failure when attempts are exhausted', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({ prompt: 'hello' });
    agentSteps.createRunning.mockResolvedValue({ id: 'step-3' });
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new Error('permanent'),
    );

    await expect(
      processor.process(createJob({ attemptsMade: 2 })),
    ).rejects.toThrow('permanent');
    expect(agentSteps.fail).toHaveBeenCalledWith(
      'step-3',
      'task-1',
      'permanent',
      true,
    );
  });
});

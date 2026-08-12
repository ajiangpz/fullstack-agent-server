import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from './agent.service';
import { AI_TASK_JOB } from './ai-task.constants';
import { AiTaskProcessor } from './ai-task.processor';
import { AgentStepService } from './agent-step.service';

describe('AiTaskProcessor', () => {
  const prisma = {
    aiTask: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  };
  const agent = { run: jest.fn() };
  const agentSteps = { failTask: jest.fn() };
  let processor: AiTaskProcessor;

  const createJob = (attemptsMade = 0) =>
    ({
      name: AI_TASK_JOB,
      data: { taskId: 'task-1' },
      attemptsMade,
      opts: { attempts: 3 },
    }) as Job<{ taskId: string }, void, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new AiTaskProcessor(
      prisma as unknown as PrismaService,
      agent as unknown as AgentService,
      agentSteps as unknown as AgentStepService,
    );
  });

  it('loads trusted task context and delegates execution to AgentService', async () => {
    const owner = {
      id: 7,
      username: 'user',
      email: 'user@example.com',
      role: 'USER',
    };
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      prompt: 'Analyze device 1',
      owner,
    });

    await processor.process(createJob());

    expect(agent.run).toHaveBeenCalledWith(
      expect.arrayContaining([{ role: 'user', content: 'Analyze device 1' }]),
      { taskId: 'task-1', user: owner },
    );
  });

  it('does nothing when another worker claimed the task', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 0 });
    await processor.process(createJob());
    expect(agent.run).not.toHaveBeenCalled();
  });

  it('marks final task failure and rethrows agent errors', async () => {
    prisma.aiTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      prompt: 'device?',
      owner: { id: 7, username: 'user', email: 'u@example.com', role: 'USER' },
    });
    agent.run.mockRejectedValue(new Error('down'));

    await expect(processor.process(createJob(2))).rejects.toThrow('down');
    expect(agentSteps.failTask).toHaveBeenCalledWith('task-1', 'down', true);
  });
});

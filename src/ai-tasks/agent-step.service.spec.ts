/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AgentStepService } from './agent-step.service';

describe('AgentStepService', () => {
  const transactionClient = {
    agentStep: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    agentStep: { update: jest.fn() },
    aiTask: { update: jest.fn() },
  };
  let service: AgentStepService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((value) =>
      typeof value === 'function'
        ? value(transactionClient)
        : Promise.all(value),
    );
    service = new AgentStepService(prisma as unknown as PrismaService);
  });

  it('calculates the next sequence from the latest task step', async () => {
    transactionClient.agentStep.findFirst.mockResolvedValue({ sequence: 2 });
    transactionClient.agentStep.create.mockResolvedValue({ id: 'step-3' });

    await service.createRunning('task-1', AgentStepType.MODEL_CALL);

    expect(transactionClient.agentStep.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-1',
        type: AgentStepType.MODEL_CALL,
        status: 'RUNNING',
        sequence: 3,
      },
    });
  });

  it('marks a failed step and restores the task for retry', async () => {
    prisma.agentStep.update.mockResolvedValue({});
    prisma.aiTask.update.mockResolvedValue({});

    await service.fail('step-1', 'task-1', 'temporary', false);

    expect(prisma.agentStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'temporary',
      }),
    });
    expect(prisma.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        retryCount: { increment: 1 },
      }),
    });
  });

  it('marks the task failed after the final attempt', async () => {
    prisma.agentStep.update.mockResolvedValue({});
    prisma.aiTask.update.mockResolvedValue({});

    await service.fail('step-3', 'task-1', 'permanent', true);

    expect(prisma.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'permanent',
        retryCount: { increment: 1 },
        completedAt: expect.any(Date),
      }),
    });
  });
});

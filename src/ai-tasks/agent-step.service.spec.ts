/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AiTaskEventBus } from './ai-task-event-bus';
import { AgentStepService } from './agent-step.service';
import { LeaseLostError } from './task-lease.service';

describe('AgentStepService', () => {
  const tx = {
    agentStep: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiTask: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    conversationMessage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  const events = { publish: jest.fn().mockResolvedValue(true) };
  const ownership = { taskId: 'task-1', leaseToken: 'token-1' };
  let service: AgentStepService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.aiTask.findFirst.mockResolvedValue({ id: 'task-1' });
    tx.conversationMessage.findFirst.mockResolvedValue({ sequence: 1 });
    tx.conversationMessage.create.mockResolvedValue({});
    tx.conversation.update.mockResolvedValue({});
    events.publish.mockResolvedValue(true);

    service = new AgentStepService(
      prisma as unknown as PrismaService,
      events as unknown as AiTaskEventBus,
    );
  });

  it('creates the next step only while the lease token is owned', async () => {
    tx.agentStep.findFirst.mockResolvedValue({ sequence: 2 });
    tx.agentStep.create.mockResolvedValue({ id: 'step-3' });

    await service.createRunning(ownership, AgentStepType.MODEL_CALL);

    expect(tx.aiTask.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-1', leaseToken: 'token-1', status: 'PROCESSING' },
      select: { id: true },
    });
    expect(tx.agentStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ taskId: 'task-1', sequence: 3 }),
    });
    expect(events.publish).toHaveBeenCalledWith('task-1', 'step.created', {
      id: 'step-3',
    });
  });

  it('stops writes after ownership is lost', async () => {
    tx.aiTask.findFirst.mockResolvedValue(null);

    await expect(
      service.createRunning(ownership, AgentStepType.MODEL_CALL),
    ).rejects.toBeInstanceOf(LeaseLostError);

    expect(tx.agentStep.create).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('completes the task, writes the assistant message, and releases the conversation atomically', async () => {
    tx.agentStep.update.mockResolvedValue({
      id: 'step-1',
      status: 'COMPLETED',
    });
    tx.aiTask.update.mockResolvedValue({
      id: 'task-1',
      conversationId: 'conv-1',
      status: 'COMPLETED',
    });

    await service.completeTask(
      'step-1',
      ownership,
      '{"answer":"offline","keyPoints":[]}',
    );

    expect(tx.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        lockedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
      }),
      select: expect.objectContaining({
        conversationId: true,
        status: true,
      }),
    });
    expect(tx.conversationMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        taskId: 'task-1',
        role: 'ASSISTANT',
        content: 'offline',
        sequence: 2,
      },
    });
    expect(tx.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { busy: false },
    });
    expect(events.publish).toHaveBeenCalledWith(
      'task-1',
      'task.completed',
      expect.objectContaining({
        id: 'task-1',
        status: 'COMPLETED',
      }),
    );
  });

  it('releases the conversation when the final task attempt fails', async () => {
    tx.aiTask.updateMany.mockResolvedValue({ count: 1 });
    tx.aiTask.findUnique.mockResolvedValue({
      id: 'task-1',
      conversationId: 'conv-1',
      status: 'FAILED',
    });

    await expect(
      service.failTask(
        { taskId: 'task-1', token: 'token-1' },
        'provider down',
        true,
      ),
    ).resolves.toBe(true);

    expect(tx.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { busy: false },
    });
    expect(events.publish).toHaveBeenCalledWith(
      'task-1',
      'task.failed',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('keeps the conversation busy while BullMQ will retry the task', async () => {
    tx.aiTask.updateMany.mockResolvedValue({ count: 1 });
    tx.aiTask.findUnique.mockResolvedValue({
      id: 'task-1',
      conversationId: 'conv-1',
      status: 'PENDING',
    });

    await expect(
      service.failTask(
        { taskId: 'task-1', token: 'token-1' },
        'provider down',
        false,
      ),
    ).resolves.toBe(true);

    expect(tx.conversation.update).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      'task-1',
      'task.updated',
      expect.objectContaining({ status: 'PENDING' }),
    );
  });
});

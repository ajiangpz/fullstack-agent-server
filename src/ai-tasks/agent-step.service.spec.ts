/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AgentStepService } from './agent-step.service';
import { LeaseLostError } from './task-lease.service';

describe('AgentStepService', () => {
  const tx = {
    agentStep: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    aiTask: { findFirst: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    aiTask: { updateMany: jest.fn() },
  };
  const ownership = { taskId: 'task-1', leaseToken: 'token-1' };
  let service: AgentStepService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.aiTask.findFirst.mockResolvedValue({ id: 'task-1' });
    service = new AgentStepService(prisma as unknown as PrismaService);
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
  });

  it('stops writes after ownership is lost', async () => {
    tx.aiTask.findFirst.mockResolvedValue(null);
    await expect(
      service.createRunning(ownership, AgentStepType.MODEL_CALL),
    ).rejects.toBeInstanceOf(LeaseLostError);
    expect(tx.agentStep.create).not.toHaveBeenCalled();
  });

  it('clears the lease when a task completes', async () => {
    await service.completeTask('step-1', ownership, '{"answer":"ok"}');
    expect(tx.aiTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        lockedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
      }),
    });
  });
});

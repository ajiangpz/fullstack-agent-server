import { Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { LeaseLostError, type TaskLease } from './task-lease.service';

type Ownership = TaskLease | { taskId: string; leaseToken: string };

@Injectable()
export class AgentStepService {
  constructor(private readonly prisma: PrismaService) {}

  async createRunning(
    ownership: Ownership,
    type: AgentStepType,
    input?: unknown,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);
      const lastStep = await tx.agentStep.findFirst({
        where: { taskId: ownership.taskId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      return tx.agentStep.create({
        data: {
          taskId: ownership.taskId,
          type,
          status: 'RUNNING',
          sequence: (lastStep?.sequence ?? 0) + 1,
          input: input === undefined ? null : JSON.stringify(input),
        },
      });
    });
  }

  async completeStep(stepId: string, ownership: Ownership, output?: unknown) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);
      return tx.agentStep.update({
        where: { id: stepId, taskId: ownership.taskId },
        data: {
          status: 'COMPLETED',
          output: output === undefined ? null : JSON.stringify(output),
          completedAt: new Date(),
          errorMessage: null,
        },
      });
    });
  }

  async completeTask(stepId: string, ownership: Ownership, result: string) {
    const completedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);
      await tx.agentStep.update({
        where: { id: stepId, taskId: ownership.taskId },
        data: {
          status: 'COMPLETED',
          output: result,
          completedAt,
          errorMessage: null,
        },
      });
      return tx.aiTask.update({
        where: { id: ownership.taskId },
        data: {
          status: 'COMPLETED',
          result,
          errorMessage: null,
          completedAt,
          lockedBy: null,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
    });
  }

  async failStep(stepId: string, ownership: Ownership, errorMessage: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);
      return tx.agentStep.update({
        where: { id: stepId, taskId: ownership.taskId },
        data: { status: 'FAILED', errorMessage, completedAt: new Date() },
      });
    });
  }

  async failTask(
    lease: TaskLease,
    errorMessage: string,
    isFinalAttempt: boolean,
  ) {
    const failed = await this.prisma.aiTask.updateMany({
      where: {
        id: lease.taskId,
        leaseToken: lease.token,
        status: 'PROCESSING',
      },
      data: {
        status: isFinalAttempt ? 'FAILED' : 'PENDING',
        errorMessage,
        retryCount: { increment: 1 },
        completedAt: isFinalAttempt ? new Date() : null,
        lockedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    return failed.count === 1;
  }

  private async assertOwnership(
    tx: Pick<PrismaService, 'aiTask'>,
    ownership: Ownership,
  ): Promise<void> {
    const token = 'token' in ownership ? ownership.token : ownership.leaseToken;
    const task = await tx.aiTask.findFirst({
      where: { id: ownership.taskId, leaseToken: token, status: 'PROCESSING' },
      select: { id: true },
    });
    if (!task) throw new LeaseLostError();
  }
}

import { Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AiTaskEventBus } from './ai-task-event-bus';
import { parseAiTaskResult } from './ai-task-result';
import { LeaseLostError, type TaskLease } from './task-lease.service';

type Ownership = TaskLease | { taskId: string; leaseToken: string };

@Injectable()
export class AgentStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AiTaskEventBus,
  ) {}

  async createRunning(
    ownership: Ownership,
    type: AgentStepType,
    input?: unknown,
  ) {
    const step = await this.prisma.$transaction(async (tx) => {
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

    await this.events.publish(ownership.taskId, 'step.created', step);
    return step;
  }

  async completeStep(stepId: string, ownership: Ownership, output?: unknown) {
    const step = await this.prisma.$transaction(async (tx) => {
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

    await this.events.publish(ownership.taskId, 'step.updated', step);
    return step;
  }

  async completeTask(stepId: string, ownership: Ownership, result: string) {
    const parsedResult = parseAiTaskResult(result);
    const completedAt = new Date();

    const completed = await this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);

      const step = await tx.agentStep.update({
        where: { id: stepId, taskId: ownership.taskId },
        data: {
          status: 'COMPLETED',
          output: result,
          completedAt,
          errorMessage: null,
        },
      });

      const task = await tx.aiTask.update({
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
        select: {
          id: true,
          conversationId: true,
          status: true,
          result: true,
          errorMessage: true,
          attempts: true,
          retryCount: true,
          startedAt: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      const lastMessage = await tx.conversationMessage.findFirst({
        where: { conversationId: task.conversationId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });

      await tx.conversationMessage.create({
        data: {
          conversationId: task.conversationId,
          taskId: task.id,
          role: 'ASSISTANT',
          content: parsedResult.answer,
          sequence: (lastMessage?.sequence ?? 0) + 1,
        },
      });

      await tx.conversation.update({
        where: { id: task.conversationId },
        data: { busy: false },
      });

      return { step, task };
    });

    await this.events.publish(ownership.taskId, 'step.updated', completed.step);
    await this.events.publish(
      ownership.taskId,
      'task.completed',
      completed.task,
    );
    return completed.task;
  }

  async failStep(stepId: string, ownership: Ownership, errorMessage: string) {
    const step = await this.prisma.$transaction(async (tx) => {
      await this.assertOwnership(tx, ownership);
      return tx.agentStep.update({
        where: { id: stepId, taskId: ownership.taskId },
        data: { status: 'FAILED', errorMessage, completedAt: new Date() },
      });
    });

    await this.events.publish(ownership.taskId, 'step.updated', step);
    return step;
  }

  async failTask(
    lease: TaskLease,
    errorMessage: string,
    isFinalAttempt: boolean,
  ) {
    const task = await this.prisma.$transaction(async (tx) => {
      const failed = await tx.aiTask.updateMany({
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

      if (failed.count !== 1) return null;

      const updated = await tx.aiTask.findUnique({
        where: { id: lease.taskId },
        select: {
          id: true,
          conversationId: true,
          status: true,
          result: true,
          errorMessage: true,
          attempts: true,
          retryCount: true,
          startedAt: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      if (!updated) return null;

      if (isFinalAttempt) {
        await tx.conversation.update({
          where: { id: updated.conversationId },
          data: { busy: false },
        });
      }

      return updated;
    });

    if (!task) return false;

    await this.events.publish(
      lease.taskId,
      isFinalAttempt ? 'task.failed' : 'task.updated',
      task,
    );
    return true;
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

import { Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentStepService {
  constructor(private readonly prisma: PrismaService) {}

  async createRunning(taskId: string, type: AgentStepType, input?: unknown) {
    // sequence 的读取和创建放在同一事务中，保持单个任务步骤顺序连续。
    return this.prisma.$transaction(async (tx) => {
      const lastStep = await tx.agentStep.findFirst({
        where: { taskId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });

      return tx.agentStep.create({
        data: {
          taskId,
          type,
          status: 'RUNNING',
          sequence: (lastStep?.sequence ?? 0) + 1,
          input: input === undefined ? null : JSON.stringify(input),
        },
      });
    });
  }

  async completeStep(stepId: string, output?: unknown) {
    return this.prisma.agentStep.update({
      where: { id: stepId },
      data: {
        status: 'COMPLETED',
        output: output === undefined ? null : JSON.stringify(output),
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async completeTask(stepId: string, taskId: string, result: string) {
    const completedAt = new Date();
    return this.prisma.$transaction([
      this.prisma.agentStep.update({
        where: { id: stepId },
        data: {
          status: 'COMPLETED',
          output: result,
          completedAt,
          errorMessage: null,
        },
      }),
      this.prisma.aiTask.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          result,
          errorMessage: null,
          completedAt,
        },
      }),
    ]);
  }

  async failStep(stepId: string, errorMessage: string) {
    return this.prisma.agentStep.update({
      where: { id: stepId },
      data: { status: 'FAILED', errorMessage, completedAt: new Date() },
    });
  }

  async failTask(
    taskId: string,
    errorMessage: string,
    isFinalAttempt: boolean,
  ) {
    const completedAt = new Date();
    return this.prisma.aiTask.update({
      where: { id: taskId },
      data: {
        status: isFinalAttempt ? 'FAILED' : 'PENDING',
        errorMessage,
        retryCount: { increment: 1 },
        completedAt: isFinalAttempt ? completedAt : null,
      },
    });
  }

  async fail(
    stepId: string,
    taskId: string,
    errorMessage: string,
    isFinalAttempt: boolean,
  ) {
    const completedAt = new Date();
    return this.prisma.$transaction([
      this.prisma.agentStep.update({
        where: { id: stepId },
        data: { status: 'FAILED', errorMessage, completedAt },
      }),
      this.prisma.aiTask.update({
        where: { id: taskId },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'PENDING',
          errorMessage,
          retryCount: { increment: 1 },
          completedAt: isFinalAttempt ? completedAt : null,
        },
      }),
    ]);
  }
}

import { Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentStepService {
  constructor(private readonly prisma: PrismaService) {}

  async createRunning(taskId: string, type: AgentStepType) {
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
        },
      });
    });
  }

  async complete(stepId: string, taskId: string, result: string) {
    const completedAt = new Date();
    return this.prisma.$transaction([
      this.prisma.agentStep.update({
        where: { id: stepId },
        data: { status: 'COMPLETED', completedAt, errorMessage: null },
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

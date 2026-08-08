import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AgentStepType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { validateAiTaskResult } from './ai-task-result';
import { AI_PROVIDER, AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import type { AiProvider } from './providers/ai-provider';
import { AgentStepService } from './agent-step.service';

interface AiTaskJobData {
  taskId: string;
}

@Processor(AI_TASK_QUEUE)
export class AiTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentSteps: AgentStepService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {
    super();
  }

  async process(job: Job<AiTaskJobData, void, string>): Promise<void> {
    if (job.name !== AI_TASK_JOB) {
      throw new Error(`Unsupported job type: ${job.name}`);
    }

    const claim = await this.prisma.aiTask.updateMany({
      where: { id: job.data.taskId, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      },
    });

    if (claim.count === 0) {
      return;
    }

    const task = await this.prisma.aiTask.findUniqueOrThrow({
      where: { id: job.data.taskId },
      select: { prompt: true },
    });
    const step = await this.agentSteps.createRunning(
      job.data.taskId,
      AgentStepType.MODEL_CALL,
    );

    try {
      const result = validateAiTaskResult(
        await this.aiProvider.generateText({
          prompt: task.prompt,
        }),
      );
      await this.agentSteps.complete(
        step.id,
        job.data.taskId,
        JSON.stringify(result),
      );
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      await this.agentSteps.fail(
        step.id,
        job.data.taskId,
        this.getErrorMessage(error),
        isFinalAttempt,
      );
      throw error;
    }
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    return message.slice(0, 2_000);
  }
}

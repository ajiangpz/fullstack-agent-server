import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { validateAiTaskResult } from './ai-task-result';
import { AI_PROVIDER, AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import type { AiProvider } from './providers/ai-provider';
import { AiProviderError } from './providers/ai-provider';

interface AiTaskJobData {
  taskId: string;
}

@Processor(AI_TASK_QUEUE)
export class AiTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {
    super();
  }

  async process(job: Job<AiTaskJobData, void, string>): Promise<void> {
    if (job.name !== AI_TASK_JOB) {
      throw new Error(`Unsupported job type: ${job.name}`);
    }

    const task = await this.prisma.aiTask.update({
      where: { id: job.data.taskId },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      },
      select: { prompt: true },
    });

    try {
      const result = validateAiTaskResult(
        await this.aiProvider.generateText({
          prompt: task.prompt,
        }),
      );
      await this.prisma.aiTask.update({
        where: { id: job.data.taskId },
        data: {
          status: 'COMPLETED',
          result: JSON.stringify(result),
          errorMessage: null,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const retryable = !(error instanceof AiProviderError) || error.retryable;
      const isFinalAttempt = !retryable || job.attemptsMade + 1 >= maxAttempts;

      if (isFinalAttempt) {
        await this.prisma.aiTask.update({
          where: { id: job.data.taskId },
          data: {
            status: 'FAILED',
            errorMessage: this.getErrorMessage(error),
            completedAt: new Date(),
          },
        });
      }

      if (!retryable) {
        throw new UnrecoverableError(this.getErrorMessage(error));
      }
      throw error;
    }
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    return message.slice(0, 2_000);
  }
}

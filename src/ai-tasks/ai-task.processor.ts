import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from './agent.service';
import { AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import { AgentStepService } from './agent-step.service';

interface AiTaskJobData {
  taskId: string;
}

@Processor(AI_TASK_QUEUE)
export class AiTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly agentSteps: AgentStepService,
  ) {
    super();
  }

  async process(job: Job<AiTaskJobData, void, string>): Promise<void> {
    if (job.name !== AI_TASK_JOB) {
      throw new Error(`Unsupported job type: ${job.name}`);
    }

    // 条件更新充当任务抢占，确保同一任务不会被多个 Worker 重复执行。
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
    if (claim.count === 0) return;

    // Agent 使用的身份必须来自数据库中的任务 owner，而不是队列载荷。
    const task = await this.prisma.aiTask.findUniqueOrThrow({
      where: { id: job.data.taskId },
      select: {
        prompt: true,
        owner: {
          select: { id: true, username: true, email: true, role: true },
        },
      },
    });

    try {
      await this.agent.run(
        [
          {
            role: 'system',
            content:
              'You are a network device troubleshooting agent. Use tools when required.',
          },
          { role: 'user', content: task.prompt },
        ],
        { taskId: job.data.taskId, user: task.owner },
      );
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      await this.agentSteps.failTask(
        job.data.taskId,
        this.errorMessage(error),
        job.attemptsMade + 1 >= maxAttempts,
      );
      throw error;
    }
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown AI error').slice(
      0,
      2_000,
    );
  }
}

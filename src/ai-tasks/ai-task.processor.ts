import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from './agent.service';
import { AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import { AgentStepService } from './agent-step.service';
import { LeaseLostError, TaskLeaseService } from './task-lease.service';

interface AiTaskJobData {
  taskId: string;
}

@Processor(AI_TASK_QUEUE)
export class AiTaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly agentSteps: AgentStepService,
    private readonly leases: TaskLeaseService,
  ) {
    super();
  }

  async process(job: Job<AiTaskJobData, void, string>): Promise<void> {
    if (job.name !== AI_TASK_JOB) {
      throw new Error(`Unsupported job type: ${job.name}`);
    }

    const lease = await this.leases.acquire(job.data.taskId);
    if (!lease) return;
    const abortController = new AbortController();
    const heartbeat = setInterval(() => {
      void this.leases
        .heartbeat(lease)
        .then((owned) => {
          if (!owned) abortController.abort();
        })
        .catch(() => abortController.abort());
    }, TaskLeaseService.heartbeatIntervalMs);
    heartbeat.unref();

    try {
      // Agent 使用的身份必须来自数据库中的任务 owner，而不是队列载荷。
      const task = await this.prisma.aiTask.findFirstOrThrow({
        where: { id: job.data.taskId, leaseToken: lease.token },
        select: {
          prompt: true,
          owner: {
            select: { id: true, username: true, email: true, role: true },
          },
        },
      });
      await this.agent.run(
        [
          {
            role: 'system',
            content:
              'You are a network device troubleshooting agent. Use tools when required.',
          },
          { role: 'user', content: task.prompt },
        ],
        {
          taskId: job.data.taskId,
          user: task.owner,
          leaseToken: lease.token,
          signal: abortController.signal,
        },
      );
    } catch (error) {
      if (error instanceof LeaseLostError || abortController.signal.aborted) {
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      const failed = await this.agentSteps.failTask(
        lease,
        this.errorMessage(error),
        job.attemptsMade + 1 >= maxAttempts,
      );
      if (!failed) return;
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown AI error').slice(
      0,
      2_000,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskLease {
  taskId: string;
  token: string;
}

export class LeaseLostError extends Error {
  constructor() {
    super('AI task lease is no longer owned by this worker');
    this.name = 'LeaseLostError';
  }
}

@Injectable()
export class TaskLeaseService {
  static readonly timeoutMs = 5 * 60_000;
  static readonly heartbeatIntervalMs = 60_000;
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(private readonly prisma: PrismaService) {}

  async acquire(taskId: string): Promise<TaskLease | null> {
    const now = new Date();
    const token = randomUUID();
    const claim = await this.prisma.aiTask.updateMany({
      where: {
        id: taskId,
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lockedBy: this.workerId,
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + TaskLeaseService.timeoutMs),
        startedAt: now,
        completedAt: null,
        errorMessage: null,
      },
    });

    return claim.count === 1 ? { taskId, token } : null;
  }

  async heartbeat(lease: TaskLease): Promise<boolean> {
    const renewed = await this.prisma.aiTask.updateMany({
      where: {
        id: lease.taskId,
        leaseToken: lease.token,
        status: 'PROCESSING',
      },
      data: {
        leaseExpiresAt: new Date(Date.now() + TaskLeaseService.timeoutMs),
      },
    });
    return renewed.count === 1;
  }
}

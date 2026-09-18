import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import type { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AI_TASK_JOB, AI_TASK_QUEUE } from './ai-task.constants';
import { CreateAiTaskDto } from './dto/create-ai-task.dto';
import { QueryAiTasksDto } from './dto/query-ai-tasks.dto';

@Injectable()
export class AiTasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(AI_TASK_QUEUE) private readonly queue: Queue,
  ) {}

  async create(
    dto: CreateAiTaskDto,
    user: AuthenticatedUser,
  ): Promise<{ taskId: string }> {
    const task = await this.prisma.aiTask.create({
      data: {
        prompt: dto.prompt,
        owner: { connect: { id: user.id } },
      },
      select: { id: true },
    });

    try {
      await this.queue.add(
        AI_TASK_JOB,
        { taskId: task.id },
        {
          jobId: task.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 86_400, count: 5_000 },
        },
      );
    } catch {
      await this.prisma.aiTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Task could not be queued',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException('AI task queue is unavailable');
    }

    return { taskId: task.id };
  }

  async findAll(user: AuthenticatedUser, query = new QueryAiTasksDto()) {
    const { page, limit, status } = query;
    const search = query.search?.trim();
    const where: Prisma.AiTaskWhereInput = {
      ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.id }),
      status,
      prompt: search
        ? {
            contains: search,
            mode: 'insensitive',
          }
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.aiTask.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          prompt: true,
          status: true,
          errorMessage: true,
          attempts: true,
          retryCount: true,
          ownerId: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { steps: true },
          },
        },
      }),
      this.prisma.aiTask.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...task }) => ({
        ...task,
        stepCount: _count.steps,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const task = await this.prisma.aiTask.findFirst({
      where: {
        id,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.id }),
      },
      select: {
        id: true,
        prompt: true,
        status: true,
        result: true,
        errorMessage: true,
        attempts: true,
        retryCount: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        steps: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`AI task ${id} not found`);
    }

    return task;
  }
}

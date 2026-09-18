import {
  ConflictException,
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
    const task = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.conversation.updateMany({
        where: {
          id: dto.conversationId,
          ownerId: user.id,
          busy: false,
        },
        data: { busy: true },
      });

      if (claimed.count !== 1) {
        const conversation = await tx.conversation.findFirst({
          where: { id: dto.conversationId, ownerId: user.id },
          select: { id: true },
        });

        if (!conversation) {
          throw new NotFoundException(
            `Conversation ${dto.conversationId} not found`,
          );
        }

        throw new ConflictException(
          'Conversation already has an active AI task',
        );
      }

      const lastMessage = await tx.conversationMessage.findFirst({
        where: { conversationId: dto.conversationId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });

      const created = await tx.aiTask.create({
        data: {
          prompt: dto.prompt,
          ownerId: user.id,
          conversationId: dto.conversationId,
        },
        select: { id: true, conversationId: true },
      });

      await tx.conversationMessage.create({
        data: {
          conversationId: dto.conversationId,
          taskId: created.id,
          role: 'USER',
          content: dto.prompt,
          sequence: (lastMessage?.sequence ?? 0) + 1,
        },
      });

      return created;
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
      await this.prisma.$transaction(async (tx) => {
        await tx.aiTask.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Task could not be queued',
            completedAt: new Date(),
          },
        });
        await tx.conversation.update({
          where: { id: task.conversationId },
          data: { busy: false },
        });
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

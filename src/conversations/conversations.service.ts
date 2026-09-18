import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { AiTaskStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthenticatedUser) {
    return this.prisma.conversation.create({
      data: { ownerId: user.id },
      select: {
        id: true,
        busy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getMessages(id: string, user: AuthenticatedUser) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, ownerId: user.id },
      select: {
        id: true,
        busy: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            taskId: true,
            role: true,
            content: true,
            sequence: true,
            createdAt: true,
          },
        },
        tasks: {
          where: {
            status: {
              in: [AiTaskStatus.PENDING, AiTaskStatus.PROCESSING],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const { messages, tasks, ...summary } = conversation;
    return {
      conversation: summary,
      messages,
      activeTaskId: tasks[0]?.id ?? null,
    };
  }
}

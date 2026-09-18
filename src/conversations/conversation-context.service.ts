import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConversationMessageRole } from '../generated/prisma/enums';
import type { AiMessage } from '../ai-tasks/providers/ai-provider';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_CHARS = 12_000;

@Injectable()
export class ConversationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildForTask(taskId: string): Promise<AiMessage[]> {
    const task = await this.prisma.aiTask.findUnique({
      where: { id: taskId },
      select: { conversationId: true },
    });

    if (!task) {
      throw new NotFoundException(`AI task ${taskId} not found`);
    }

    const [current, history] = await Promise.all([
      this.prisma.conversationMessage.findFirst({
        where: {
          taskId,
          conversationId: task.conversationId,
          role: 'USER',
        },
        select: {
          role: true,
          content: true,
          sequence: true,
        },
      }),
      this.prisma.conversationMessage.findMany({
        where: {
          conversationId: task.conversationId,
          taskId: { not: taskId },
          task: { status: 'COMPLETED' },
          role: { in: ['USER', 'ASSISTANT'] },
        },
        orderBy: { sequence: 'desc' },
        take: MAX_HISTORY_MESSAGES - 1,
        select: {
          role: true,
          content: true,
          sequence: true,
        },
      }),
    ]);

    if (!current) {
      throw new Error('Current conversation user message not found');
    }

    const selected: typeof history = [];
    let remainingChars = Math.max(
      0,
      MAX_HISTORY_CHARS - current.content.length,
    );

    for (const message of history) {
      if (message.content.length > remainingChars) break;

      selected.push(message);
      remainingChars -= message.content.length;
    }

    selected.reverse();

    return [
      ...selected.map((message) =>
        this.toAiMessage(message.role, message.content),
      ),
      { role: 'user', content: current.content },
    ];
  }

  private toAiMessage(
    role: ConversationMessageRole,
    content: string,
  ): AiMessage {
    return {
      role: role === 'USER' ? 'user' : 'assistant',
      content,
    };
  }
}

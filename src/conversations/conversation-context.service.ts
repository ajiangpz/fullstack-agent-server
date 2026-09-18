import { Injectable } from '@nestjs/common';
import type { AiMessage } from '../ai-tasks/providers/ai-provider';
import {
  AiTaskStatus,
  ConversationMessageRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_CHARS = 12_000;

@Injectable()
export class ConversationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildForTask(taskId: string): Promise<AiMessage[]> {
    const task = await this.prisma.aiTask.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        id: true,
        conversation: {
          select: {
            messages: {
              where: {
                OR: [
                  {
                    task: { status: AiTaskStatus.COMPLETED },
                    role: {
                      in: [
                        ConversationMessageRole.USER,
                        ConversationMessageRole.ASSISTANT,
                      ],
                    },
                  },
                  {
                    taskId,
                    role: ConversationMessageRole.USER,
                  },
                ],
              },
              orderBy: { sequence: 'asc' },
              select: {
                taskId: true,
                role: true,
                content: true,
                sequence: true,
              },
            },
          },
        },
      },
    });

    if (!task.conversation) {
      throw new Error('Task conversation not found');
    }

    const messages = task.conversation.messages;
    const current = messages.find(
      (message) =>
        message.taskId === taskId &&
        message.role === ConversationMessageRole.USER,
    );

    if (!current) {
      throw new Error('Current conversation user message not found');
    }

    const history = messages.filter((message) => message.taskId !== taskId);
    const selected: typeof history = [];
    let remainingCount = MAX_HISTORY_MESSAGES - 1;
    let remainingChars = Math.max(
      0,
      MAX_HISTORY_CHARS - current.content.length,
    );

    for (let index = history.length - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (remainingCount <= 0) break;
      if (message.content.length > remainingChars) break;

      selected.push(message);
      remainingCount -= 1;
      remainingChars -= message.content.length;
    }

    selected.reverse();

    return [
      ...selected.map((message): AiMessage => ({
        role:
          message.role === ConversationMessageRole.USER ? 'user' : 'assistant',
        content: message.content,
      })),
      { role: 'user', content: current.content },
    ];
  }
}

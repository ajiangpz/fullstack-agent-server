import { PrismaService } from '../prisma/prisma.service';
import {
  ConversationContextService,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
} from './conversation-context.service';

describe('ConversationContextService', () => {
  const prisma = {
    aiTask: { findUnique: jest.fn() },
    conversationMessage: { findMany: jest.fn() },
  };
  let service: ConversationContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.aiTask.findUnique.mockResolvedValue({ conversationId: 'conv-1' });
    service = new ConversationContextService(
      prisma as unknown as PrismaService,
    );
  });

  it('includes completed history and the current user message', async () => {
    prisma.conversationMessage.findMany.mockResolvedValue([
      {
        taskId: 'old-task',
        role: 'USER',
        content: 'first question',
        sequence: 1,
      },
      {
        taskId: 'old-task',
        role: 'ASSISTANT',
        content: 'first answer',
        sequence: 2,
      },
      {
        taskId: 'task-1',
        role: 'USER',
        content: 'follow up',
        sequence: 4,
      },
    ]);

    await expect(service.buildForTask('task-1')).resolves.toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'follow up' },
    ]);

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: 'conv-1',
          OR: [
            {
              role: { in: ['USER', 'ASSISTANT'] },
              task: { is: { status: 'COMPLETED' } },
            },
            { taskId: 'task-1', role: 'USER' },
          ],
        },
      }),
    );
  });

  it('keeps at most 20 messages including the current user message', async () => {
    const history = Array.from(
      { length: MAX_HISTORY_MESSAGES + 5 },
      (_, index) => ({
        taskId: `task-${index}`,
        role: index % 2 === 0 ? 'USER' : 'ASSISTANT',
        content: `message-${index}`,
        sequence: index + 1,
      }),
    );
    prisma.conversationMessage.findMany.mockResolvedValue([
      ...history,
      {
        taskId: 'current',
        role: 'USER',
        content: 'current message',
        sequence: 100,
      },
    ]);

    const result = await service.buildForTask('current');

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: 'current message',
    });
    expect(result[0]).toEqual({
      role: history.at(-19)?.role === 'USER' ? 'user' : 'assistant',
      content: history.at(-19)?.content,
    });
  });

  it('stops adding old history after the character budget', async () => {
    const large = 'x'.repeat(5_000);
    prisma.conversationMessage.findMany.mockResolvedValue([
      { taskId: 'old-1', role: 'USER', content: large, sequence: 1 },
      { taskId: 'old-1', role: 'ASSISTANT', content: large, sequence: 2 },
      { taskId: 'old-2', role: 'USER', content: 'newer', sequence: 3 },
      { taskId: 'current', role: 'USER', content: large, sequence: 4 },
    ]);

    const result = await service.buildForTask('current');

    expect(
      result.reduce((total, message) => total + message.content.length, 0),
    ).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
    expect(result).toEqual([
      { role: 'assistant', content: large },
      { role: 'user', content: 'newer' },
      { role: 'user', content: large },
    ]);
  });

  it('always retains the current user message', async () => {
    const current = 'x'.repeat(MAX_HISTORY_CHARS + 1_000);
    prisma.conversationMessage.findMany.mockResolvedValue([
      { taskId: 'old', role: 'USER', content: 'old', sequence: 1 },
      { taskId: 'task-1', role: 'USER', content: current, sequence: 2 },
    ]);

    await expect(service.buildForTask('task-1')).resolves.toEqual([
      { role: 'user', content: current },
    ]);
  });
});

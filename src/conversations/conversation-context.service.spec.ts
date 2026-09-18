import { PrismaService } from '../prisma/prisma.service';
import {
  ConversationContextService,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
} from './conversation-context.service';

describe('ConversationContextService', () => {
  const prisma = {
    aiTask: {
      findUnique: jest.fn(),
    },
    conversationMessage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  let service: ConversationContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.aiTask.findUnique.mockResolvedValue({
      conversationId: 'conv-1',
    });
    prisma.conversationMessage.findFirst.mockResolvedValue({
      role: 'USER',
      content: 'current',
      sequence: 3,
    });
    prisma.conversationMessage.findMany.mockResolvedValue([]);
    service = new ConversationContextService(
      prisma as unknown as PrismaService,
    );
  });

  it('includes completed history and the current user message', async () => {
    prisma.conversationMessage.findFirst.mockResolvedValue({
      role: 'USER',
      content: 'follow up',
      sequence: 3,
    });
    prisma.conversationMessage.findMany.mockResolvedValue([
      {
        role: 'ASSISTANT',
        content: 'first answer',
        sequence: 2,
      },
      {
        role: 'USER',
        content: 'first question',
        sequence: 1,
      },
    ]);

    await expect(service.buildForTask('task-3')).resolves.toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'follow up' },
    ]);

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conv-1',
        taskId: { not: 'task-3' },
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
    });
  });

  it('queries at most 19 historical messages', async () => {
    await service.buildForTask('current');

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: MAX_HISTORY_MESSAGES - 1,
      }),
    );
  });

  it('stops adding old history after the character budget', async () => {
    const newest = 'n'.repeat(5_000);
    const oldest = 'o'.repeat(5_000);
    const current = 'c'.repeat(3_000);

    prisma.conversationMessage.findFirst.mockResolvedValue({
      role: 'USER',
      content: current,
      sequence: 3,
    });
    prisma.conversationMessage.findMany.mockResolvedValue([
      {
        role: 'ASSISTANT',
        content: newest,
        sequence: 2,
      },
      {
        role: 'USER',
        content: oldest,
        sequence: 1,
      },
    ]);

    await expect(service.buildForTask('current')).resolves.toEqual([
      { role: 'assistant', content: newest },
      { role: 'user', content: current },
    ]);
  });

  it('always retains the current user message', async () => {
    const current = 'c'.repeat(MAX_HISTORY_CHARS + 1);
    prisma.conversationMessage.findFirst.mockResolvedValue({
      role: 'USER',
      content: current,
      sequence: 2,
    });
    prisma.conversationMessage.findMany.mockResolvedValue([
      {
        role: 'USER',
        content: 'old',
        sequence: 1,
      },
    ]);

    await expect(service.buildForTask('current')).resolves.toEqual([
      { role: 'user', content: current },
    ]);
  });
});

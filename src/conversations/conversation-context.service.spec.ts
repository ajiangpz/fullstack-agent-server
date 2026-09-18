/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  };
  let service: ConversationContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationContextService(
      prisma as unknown as PrismaService,
    );
  });

  it('includes completed history and the current user message', async () => {
    prisma.aiTask.findUnique.mockResolvedValue({
      id: 'task-3',
      conversation: {
        messages: [
          {
            taskId: 'task-1',
            role: 'USER',
            content: 'first question',
            sequence: 1,
          },
          {
            taskId: 'task-1',
            role: 'ASSISTANT',
            content: 'first answer',
            sequence: 2,
          },
          {
            taskId: 'task-3',
            role: 'USER',
            content: 'follow up',
            sequence: 4,
          },
        ],
      },
    });

    await expect(service.buildForTask('task-3')).resolves.toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'follow up' },
    ]);
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

    prisma.aiTask.findUnique.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          ...history,
          {
            taskId: 'current',
            role: 'USER',
            content: 'current message',
            sequence: history.length + 1,
          },
        ],
      },
    });

    const result = await service.buildForTask('current');

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: 'current message',
    });
  });

  it('stops adding old history after the character budget', async () => {
    const newest = 'n'.repeat(5_000);
    const oldest = 'o'.repeat(5_000);
    const current = 'c'.repeat(3_000);

    prisma.aiTask.findUnique.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          {
            taskId: 'old',
            role: 'USER',
            content: oldest,
            sequence: 1,
          },
          {
            taskId: 'new',
            role: 'ASSISTANT',
            content: newest,
            sequence: 2,
          },
          {
            taskId: 'current',
            role: 'USER',
            content: current,
            sequence: 3,
          },
        ],
      },
    });

    await expect(service.buildForTask('current')).resolves.toEqual([
      { role: 'assistant', content: newest },
      { role: 'user', content: current },
    ]);
  });

  it('always retains the current user message', async () => {
    const current = 'c'.repeat(MAX_HISTORY_CHARS + 1);
    prisma.aiTask.findUnique.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          {
            taskId: 'old',
            role: 'USER',
            content: 'old',
            sequence: 1,
          },
          {
            taskId: 'current',
            role: 'USER',
            content: current,
            sequence: 2,
          },
        ],
      },
    });

    await expect(service.buildForTask('current')).resolves.toEqual([
      { role: 'user', content: current },
    ]);
  });
});

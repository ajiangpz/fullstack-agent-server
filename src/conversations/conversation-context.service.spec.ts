import { ConversationMessageRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConversationContextService,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
} from './conversation-context.service';

describe('ConversationContextService', () => {
  const prisma = {
    aiTask: { findUniqueOrThrow: jest.fn() },
  };
  let service: ConversationContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationContextService(
      prisma as unknown as PrismaService,
    );
  });

  it('includes completed history and the current user message', async () => {
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      id: 'task-3',
      conversation: {
        messages: [
          {
            taskId: 'task-1',
            role: ConversationMessageRole.USER,
            content: 'first question',
            sequence: 1,
          },
          {
            taskId: 'task-1',
            role: ConversationMessageRole.ASSISTANT,
            content: 'first answer',
            sequence: 2,
          },
          {
            taskId: 'task-3',
            role: ConversationMessageRole.USER,
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
    const historical = Array.from(
      { length: MAX_HISTORY_MESSAGES + 5 },
      (_, index) => ({
        taskId: `task-${index}`,
        role:
          index % 2 === 0
            ? ConversationMessageRole.USER
            : ConversationMessageRole.ASSISTANT,
        content: `message-${index}`,
        sequence: index + 1,
      }),
    );
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          ...historical,
          {
            taskId: 'current',
            role: ConversationMessageRole.USER,
            content: 'current prompt',
            sequence: historical.length + 1,
          },
        ],
      },
    });

    const result = await service.buildForTask('current');

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: 'current prompt',
    });
    expect(result[0]?.content).toBe(historical.at(-19)?.content);
  });

  it('stops adding old history after the 12000 character budget', async () => {
    const newest = 'n'.repeat(4_000);
    const oldest = 'o'.repeat(7_000);
    const current = 'c'.repeat(2_000);
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          {
            taskId: 'old',
            role: ConversationMessageRole.USER,
            content: oldest,
            sequence: 1,
          },
          {
            taskId: 'new',
            role: ConversationMessageRole.ASSISTANT,
            content: newest,
            sequence: 2,
          },
          {
            taskId: 'current',
            role: ConversationMessageRole.USER,
            content: current,
            sequence: 3,
          },
        ],
      },
    });

    const result = await service.buildForTask('current');

    expect(result).toEqual([
      { role: 'assistant', content: newest },
      { role: 'user', content: current },
    ]);
    expect(
      result.reduce((sum, message) => sum + message.content.length, 0),
    ).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
  });

  it('always retains the current user message', async () => {
    const current = 'x'.repeat(MAX_HISTORY_CHARS + 1);
    prisma.aiTask.findUniqueOrThrow.mockResolvedValue({
      id: 'current',
      conversation: {
        messages: [
          {
            taskId: 'old',
            role: ConversationMessageRole.ASSISTANT,
            content: 'old answer',
            sequence: 1,
          },
          {
            taskId: 'current',
            role: ConversationMessageRole.USER,
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

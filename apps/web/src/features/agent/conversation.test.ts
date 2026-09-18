import { describe, expect, it } from 'vitest';
import {
  createAiTaskPayload,
  sortConversationMessages,
} from './conversation';
import type { ConversationMessage } from './types';

const baseMessage: Omit<ConversationMessage, 'id' | 'sequence' | 'role'> = {
  taskId: 'task-1',
  content: 'hello',
  createdAt: '2026-09-18T00:00:00.000Z',
};

describe('conversation helpers', () => {
  it('sorts persisted messages by sequence without mutating the input', () => {
    const messages: ConversationMessage[] = [
      {
        ...baseMessage,
        id: 'assistant',
        role: 'ASSISTANT',
        sequence: 2,
      },
      {
        ...baseMessage,
        id: 'user',
        role: 'USER',
        sequence: 1,
      },
    ];

    expect(
      sortConversationMessages(messages).map((message) => message.sequence),
    ).toEqual([1, 2]);
    expect(messages.map((message) => message.sequence)).toEqual([2, 1]);
  });

  it('builds the required conversation-aware AI task payload', () => {
    expect(createAiTaskPayload('conv-1', 'hello')).toEqual({
      conversationId: 'conv-1',
      prompt: 'hello',
    });
  });
});

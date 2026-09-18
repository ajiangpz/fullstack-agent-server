import { describe, expect, it } from 'vitest';
import {
  createAiTaskPayload,
  sortConversationMessages,
} from './conversation-utils';
import type { ConversationMessage } from './types';

const message = (
  id: string,
  sequence: number,
  role: ConversationMessage['role'],
): ConversationMessage => ({
  id,
  taskId: `task-${id}`,
  role,
  content: id,
  sequence,
  createdAt: '2026-09-18T00:00:00.000Z',
});

describe('conversation utilities', () => {
  it('sorts persisted messages by sequence without mutating input', () => {
    const input = [
      message('assistant', 2, 'ASSISTANT'),
      message('user', 1, 'USER'),
    ];

    const result = sortConversationMessages(input);

    expect(result.map((item) => item.sequence)).toEqual([1, 2]);
    expect(input.map((item) => item.sequence)).toEqual([2, 1]);
  });

  it('creates the AI task transport payload with conversationId', () => {
    expect(createAiTaskPayload('conv-1', 'hello')).toEqual({
      conversationId: 'conv-1',
      prompt: 'hello',
    });
  });
});

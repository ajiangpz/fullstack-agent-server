import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../types';
import { sortConversationMessages } from './conversation-message-list';

describe('sortConversationMessages', () => {
  it('sorts messages by sequence without mutating the input', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'm2',
        taskId: 't1',
        role: 'ASSISTANT',
        content: 'answer',
        sequence: 2,
        createdAt: '2026-09-18T00:00:02.000Z',
      },
      {
        id: 'm1',
        taskId: 't1',
        role: 'USER',
        content: 'question',
        sequence: 1,
        createdAt: '2026-09-18T00:00:01.000Z',
      },
    ];

    expect(sortConversationMessages(messages).map((item) => item.sequence)).toEqual([
      1,
      2,
    ]);
    expect(messages[0].sequence).toBe(2);
  });
});

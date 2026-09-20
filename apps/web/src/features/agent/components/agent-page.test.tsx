import { describe, expect, it } from 'vitest';
import { createTemporaryAssistantMessage } from './agent-page';
import type { ConversationMessage } from '../types';

const persisted = (taskId: string): ConversationMessage => ({
  id: 'message-1',
  taskId,
  role: 'ASSISTANT',
  content: 'Hello',
  sequence: 2,
  createdAt: '2026-09-20T00:00:00.000Z',
});

describe('createTemporaryAssistantMessage', () => {
  it('keeps the temporary answer after task completion until persistence catches up', () => {
    expect(
      createTemporaryAssistantMessage({
        taskId: 'task-1',
        taskStatus: 'COMPLETED',
        streamedAnswer: 'Hello',
        messages: [],
        createdAt: '2026-09-20T00:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        id: 'streaming-task-1',
        role: 'ASSISTANT',
        content: 'Hello',
      }),
    );
  });

  it('hands off to the persisted assistant message without duplication', () => {
    expect(
      createTemporaryAssistantMessage({
        taskId: 'task-1',
        taskStatus: 'COMPLETED',
        streamedAnswer: 'Hello',
        messages: [persisted('task-1')],
        createdAt: '2026-09-20T00:00:00.000Z',
      }),
    ).toBeUndefined();
  });

  it('removes an unfinished temporary answer after failure', () => {
    expect(
      createTemporaryAssistantMessage({
        taskId: 'task-1',
        taskStatus: 'FAILED',
        streamedAnswer: 'Partial',
        messages: [],
        createdAt: '2026-09-20T00:00:00.000Z',
      }),
    ).toBeUndefined();
  });
});

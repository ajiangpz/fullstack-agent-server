import { isAiTaskStreamEvent } from './ai-task-events';

describe('isAiTaskStreamEvent', () => {
  it('accepts answer.delta events', () => {
    expect(
      isAiTaskStreamEvent({
        taskId: 'task-1',
        type: 'answer.delta',
        data: { delta: 'he' },
        emittedAt: 'now',
      }),
    ).toBe(true);
  });

  it('rejects unknown event types', () => {
    expect(
      isAiTaskStreamEvent({
        taskId: 'task-1',
        type: 'answer.chunk',
        data: { delta: 'he' },
        emittedAt: 'now',
      }),
    ).toBe(false);
  });
});

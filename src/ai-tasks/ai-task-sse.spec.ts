import { serializeAiTaskSseEvent } from './ai-task-sse';

describe('serializeAiTaskSseEvent', () => {
  it('writes the event name and JSON data as an SSE frame', () => {
    expect(
      serializeAiTaskSseEvent({
        taskId: 'task-1',
        type: 'step.updated',
        data: { id: 'step-1', status: 'COMPLETED' },
        emittedAt: '2026-09-18T06:00:00.000Z',
      }),
    ).toBe(
      'event: step.updated\ndata: {"taskId":"task-1","type":"step.updated","data":{"id":"step-1","status":"COMPLETED"},"emittedAt":"2026-09-18T06:00:00.000Z"}\n\n',
    );
  });
});

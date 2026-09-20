import { describe, expect, it } from 'vitest';
import { consumeSseBuffer, parseAiTaskStreamEvent } from './sse';

describe('SSE parser', () => {
  it('keeps an incomplete frame for the next network chunk', () => {
    const first = consumeSseBuffer(
      'event: step.created\ndata: {"taskId":"task-1"',
    );

    expect(first.frames).toEqual([]);
    expect(first.rest).toBe(
      'event: step.created\ndata: {"taskId":"task-1"',
    );

    const second = consumeSseBuffer(
      `${first.rest},"type":"step.created","data":{"id":"step-1"},"emittedAt":"now"}\n\n`,
    );

    expect(second.rest).toBe('');
    expect(second.frames).toEqual([
      {
        event: 'step.created',
        data: '{"taskId":"task-1","type":"step.created","data":{"id":"step-1"},"emittedAt":"now"}',
      },
    ]);
  });

  it('supports CRLF frames, comments and multiline data', () => {
    const result = consumeSseBuffer(
      ': heartbeat\r\nevent: task.updated\r\ndata: {"taskId":"task-1",\r\ndata: "type":"task.updated","data":{},"emittedAt":"now"}\r\n\r\n',
    );

    expect(result.frames).toEqual([
      {
        event: 'task.updated',
        data: '{"taskId":"task-1",\n"type":"task.updated","data":{},"emittedAt":"now"}',
      },
    ]);
  });

  it('rejects malformed task event payloads', () => {
    expect(
      parseAiTaskStreamEvent({
        event: 'task.updated',
        data: '{"type":"task.updated"}',
      }),
    ).toBeNull();
  });

  it('accepts answer.delta task events', () => {
    expect(
      parseAiTaskStreamEvent({
        event: 'answer.delta',
        data: '{"taskId":"task-1","type":"answer.delta","data":{"delta":"he"},"emittedAt":"now"}',
      }),
    ).toEqual({
      taskId: 'task-1',
      type: 'answer.delta',
      data: { delta: 'he' },
      emittedAt: 'now',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  getStepDurationMs,
  getToolCallMetadata,
  parseStepPayload,
} from './trace';

describe('agent trace helpers', () => {
  it('parses persisted JSON payloads without rejecting legacy text', () => {
    expect(parseStepPayload('{"model":"gpt-test","inputTokens":12}')).toEqual({
      model: 'gpt-test',
      inputTokens: 12,
    });
    expect(parseStepPayload('legacy text')).toBe('legacy text');
  });

  it('extracts tool metadata and supports old steps without a tool name', () => {
    expect(
      getToolCallMetadata(
        '{"toolCallId":"call-1","name":"get_device","arguments":{"deviceId":1}}',
      ),
    ).toEqual({
      toolCallId: 'call-1',
      name: 'get_device',
      arguments: { deviceId: 1 },
    });

    expect(getToolCallMetadata('{"toolCallId":"call-old"}').name).toBe(
      'Unknown tool',
    );
  });

  it('formats persisted step duration', () => {
    expect(
      getStepDurationMs({
        startedAt: '2026-09-17T10:00:00.000Z',
        completedAt: '2026-09-17T10:00:01.250Z',
      }),
    ).toBe(1_250);
    expect(formatDuration(1_250)).toBe('1.25 s');
  });
});

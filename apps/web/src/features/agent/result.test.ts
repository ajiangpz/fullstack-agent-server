import { describe, expect, it } from 'vitest';
import { isTerminalTaskStatus, parseAiTaskResult } from './result';

describe('parseAiTaskResult', () => {
  it('parses the backend JSON result contract', () => {
    expect(
      parseAiTaskResult(JSON.stringify({ answer: '3 devices are offline.', keyPoints: ['SW-01', 'AP-02'] })),
    ).toEqual({ answer: '3 devices are offline.', keyPoints: ['SW-01', 'AP-02'] });
  });

  it('returns null for malformed task results', () => {
    expect(parseAiTaskResult('not-json')).toBeNull();
  });
});

describe('isTerminalTaskStatus', () => {
  it('stops polling only for completed or failed tasks', () => {
    expect(isTerminalTaskStatus('PENDING')).toBe(false);
    expect(isTerminalTaskStatus('PROCESSING')).toBe(false);
    expect(isTerminalTaskStatus('COMPLETED')).toBe(true);
    expect(isTerminalTaskStatus('FAILED')).toBe(true);
  });
});

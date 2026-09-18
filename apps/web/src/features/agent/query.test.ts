import { describe, expect, it } from 'vitest';
import { buildAiTaskQuery } from './query';

describe('buildAiTaskQuery', () => {
  it('serializes status and trimmed prompt search', () => {
    expect(
      buildAiTaskQuery({
        page: 2,
        limit: 20,
        status: 'FAILED',
        search: ' offline ',
      }),
    ).toBe('page=2&limit=20&search=offline&status=FAILED');
  });

  it('omits empty optional filters', () => {
    expect(
      buildAiTaskQuery({
        page: 1,
        limit: 20,
        search: '   ',
      }),
    ).toBe('page=1&limit=20');
  });
});

import { describe, expect, it } from 'vitest';
import { buildDeviceQuery } from './query';

describe('buildDeviceQuery', () => {
  it('serializes supported filters and trims search text', () => {
    expect(
      buildDeviceQuery({
        page: 2,
        limit: 20,
        search: ' core ',
        status: 'offline',
        minPortCount: 24,
        maxPortCount: 48,
      }),
    ).toBe(
      'page=2&limit=20&search=core&status=offline&minPortCount=24&maxPortCount=48',
    );
  });

  it('omits empty optional filters', () => {
    expect(buildDeviceQuery({ page: 1, limit: 20, search: '   ' })).toBe(
      'page=1&limit=20',
    );
  });
});

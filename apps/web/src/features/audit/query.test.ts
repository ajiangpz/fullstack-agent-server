import { describe, expect, it } from 'vitest';
import { buildAuditQuery } from './query';

describe('buildAuditQuery', () => {
  it('serializes supported audit filters and trims resource type', () => {
    expect(
      buildAuditQuery({
        page: 2,
        limit: 20,
        action: 'DEVICE_UPDATED',
        resourceType: ' device ',
        actorId: 7,
      }),
    ).toBe(
      'page=2&limit=20&action=DEVICE_UPDATED&resourceType=device&actorId=7',
    );
  });

  it('omits empty optional filters', () => {
    expect(
      buildAuditQuery({
        page: 1,
        limit: 20,
        resourceType: '   ',
      }),
    ).toBe('page=1&limit=20');
  });
});

import { describe, expect, it } from 'vitest';
import { calculateAvailability } from './metrics';

describe('calculateAvailability', () => {
  it('returns the online percentage', () => {
    expect(calculateAvailability(9, 10)).toBe(90);
  });

  it('returns null when there are no devices', () => {
    expect(calculateAvailability(0, 0)).toBeNull();
  });

  it('clamps invalid ratios to the valid percentage range', () => {
    expect(calculateAvailability(12, 10)).toBe(100);
    expect(calculateAvailability(-1, 10)).toBe(0);
  });
});

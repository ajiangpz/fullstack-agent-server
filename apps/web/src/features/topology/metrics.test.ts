import { describe, expect, it } from 'vitest';
import {
  bitsPerSecondToMbps,
  hasMetricSeriesValues,
} from './metrics';

describe('topology metrics helpers', () => {
  it('converts bits per second to megabits per second', () => {
    expect(bitsPerSecondToMbps(1_000_000)).toBe(1);
    expect(bitsPerSecondToMbps(2_500_000)).toBe(2.5);
    expect(bitsPerSecondToMbps(null)).toBeNull();
  });

  it('detects whether a chart series contains real values', () => {
    expect(
      hasMetricSeriesValues([
        { data: [['2026-09-23T00:00:00.000Z', null]] },
      ]),
    ).toBe(false);
    expect(
      hasMetricSeriesValues([
        { data: [['2026-09-23T00:00:00.000Z', 0]] },
      ]),
    ).toBe(true);
  });
});

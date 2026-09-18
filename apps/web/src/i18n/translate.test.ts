import { describe, expect, it } from 'vitest';
import { translate } from './translate';

describe('translate', () => {
  it('returns English and Chinese messages from the same key', () => {
    expect(translate('en', 'nav.devices')).toBe('Devices');
    expect(translate('zh-CN', 'nav.devices')).toBe('设备');
  });

  it('interpolates named parameters', () => {
    expect(
      translate('zh-CN', 'devices.pagination', {
        count: 12,
        page: 2,
        total: 3,
      }),
    ).toBe('共 12 台设备 · 第 2 页，共 3 页');
  });
});

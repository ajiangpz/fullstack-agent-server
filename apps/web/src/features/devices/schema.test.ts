import { describe, expect, it } from 'vitest';
import { deviceSchema } from './schema';

describe('deviceSchema', () => {
  it('accepts a valid network device', () => {
    const result = deviceSchema.safeParse({
      name: 'SW-Core-01',
      ip: '192.168.1.10',
      portCount: 48,
      status: 'online',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid IPv4 addresses and port counts', () => {
    const result = deviceSchema.safeParse({
      name: 'SW-Core-01',
      ip: '999.168.1.10',
      portCount: 0,
      status: 'online',
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { loginSchema } from './schema';

describe('loginSchema', () => {
  it('rejects an invalid email', () => {
    expect(
      loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success,
    ).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'john@example.com', password: '' }).success).toBe(false);
  });

  it('accepts a valid email and password', () => {
    expect(
      loginSchema.safeParse({ email: 'john@example.com', password: 'secret' }).success,
    ).toBe(true);
  });
});

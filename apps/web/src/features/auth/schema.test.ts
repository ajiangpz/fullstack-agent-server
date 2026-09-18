import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './schema';

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

describe('registerSchema', () => {
  const validRegistration = {
    username: 'john.dev',
    email: 'john@example.com',
    password: 'password123',
    displayName: 'John',
  };

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('rejects usernames with unsupported characters', () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, username: 'john dev' }).success,
    ).toBe(false);
  });

  it('rejects passwords shorter than eight characters', () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, password: 'short' }).success,
    ).toBe(false);
  });

  it('allows display name to be omitted', () => {
    const withoutDisplayName = {
      username: validRegistration.username,
      email: validRegistration.email,
      password: validRegistration.password,
    };
    expect(registerSchema.safeParse(withoutDisplayName).success).toBe(true);
  });
});

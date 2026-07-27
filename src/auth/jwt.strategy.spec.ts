import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let previousJwtSecret: string | undefined;

  beforeAll(() => {
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  beforeEach(() => {
    strategy = new JwtStrategy();
  });

  it('maps a valid JWT payload to the authenticated user', () => {
    expect(
      strategy.validate({
        sub: 1,
        username: 'alice',
        email: 'alice@example.com',
        role: 'USER',
      }),
    ).toEqual({
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      role: 'USER',
    });
  });

  it.each([
    {
      sub: '1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'USER',
    },
    {
      sub: 1,
      username: undefined,
      email: 'alice@example.com',
      role: 'USER',
    },
    {
      sub: 1,
      username: 'alice',
      email: undefined,
      role: 'USER',
    },
    {
      sub: 1,
      username: 'alice',
      email: 'alice@example.com',
      role: undefined,
    },
  ])('rejects an invalid identity payload', (payload) => {
    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });
});

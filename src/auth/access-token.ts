import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from './jwt-auth.guard';

interface AccessTokenPayload {
  sub?: unknown;
  username?: unknown;
  email?: unknown;
  role?: unknown;
}

export function parseAuthenticatedUser(
  payload: unknown,
): AuthenticatedUser {
  if (typeof payload !== 'object' || payload === null) {
    throw new UnauthorizedException('Invalid access token');
  }

  const token = payload as AccessTokenPayload;
  if (
    typeof token.sub !== 'number' ||
    !Number.isInteger(token.sub) ||
    typeof token.username !== 'string' ||
    typeof token.email !== 'string' ||
    (token.role !== UserRole.ADMIN && token.role !== UserRole.USER)
  ) {
    throw new UnauthorizedException('Invalid access token');
  }

  return {
    id: token.sub,
    username: token.username,
    email: token.email,
    role: token.role,
  };
}

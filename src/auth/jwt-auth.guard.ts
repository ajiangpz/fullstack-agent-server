import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '../generated/prisma/enums';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

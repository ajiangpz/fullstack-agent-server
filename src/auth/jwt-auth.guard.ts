import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

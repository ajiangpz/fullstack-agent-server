import { apiRequest } from '@/lib/api-client';
import type { AuthUser } from '@/lib/auth-store';
import type { LoginInput } from './schema';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

export function login(input: LoginInput) {
  return apiRequest<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

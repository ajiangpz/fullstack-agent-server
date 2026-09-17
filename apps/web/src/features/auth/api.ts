import { apiRequest } from '@/lib/api-client';
import type { AuthUser } from '@/lib/auth-store';
import type { LoginInput, RegisterInput } from './schema';

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

export function registerUser(input: RegisterInput) {
  return apiRequest<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

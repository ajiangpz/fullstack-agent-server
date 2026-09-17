import { useAuthStore } from './auth-store';

interface ApiEnvelope<T> {
  code: number;
  message: string | string[];
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

function errorMessage(message: string | string[]) {
  return Array.isArray(message) ? message.join(', ') : message;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json()) as ApiEnvelope<T | null>;

  if (!response.ok || body.code !== 0) {
    if (response.status === 401 && typeof window !== 'undefined') {
      useAuthStore.getState().clearSession();
      window.location.assign('/login');
    }
    throw new ApiError(errorMessage(body.message), response.status, body.code);
  }

  return body.data as T;
}

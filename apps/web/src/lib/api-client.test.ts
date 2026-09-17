import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api-client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('apiRequest', () => {
  it('unwraps the backend data envelope', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ code: 0, message: 'success', data: { id: 7 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(apiRequest<{ id: number }>('/devices/7')).resolves.toEqual({
      id: 7,
    });
  });

  it('throws a typed error using the backend message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ code: 400, message: 'Invalid request', data: null }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(apiRequest('/devices')).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        status: 400,
        message: 'Invalid request',
      }),
    );
  });
});

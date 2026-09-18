import { ApiError, apiUrl } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { consumeSseBuffer, parseAiTaskStreamEvent } from './sse';
import type { AiTaskStreamEvent } from './types';

interface StreamHandlers {
  signal: AbortSignal;
  onOpen: () => void;
  onEvent: (event: AiTaskStreamEvent) => void;
}

export async function streamAiTaskEvents(
  taskId: string,
  handlers: StreamHandlers,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers({ Accept: 'text/event-stream' });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    apiUrl(`/ai-tasks/${encodeURIComponent(taskId)}/events`),
    {
      method: 'GET',
      headers,
      signal: handlers.signal,
    },
  );

  if (!response.ok) {
    const message = await streamErrorMessage(response);
    if (response.status === 401 && typeof window !== 'undefined') {
      useAuthStore.getState().clearSession();
      window.location.assign('/login');
    }
    throw new ApiError(message, response.status);
  }

  if (!response.body) {
    throw new ApiError('AI task event stream is unavailable.', response.status);
  }

  handlers.onOpen();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = consumeSseBuffer(buffer);
    buffer = parsed.rest;

    for (const frame of parsed.frames) {
      const event = parseAiTaskStreamEvent(frame);
      if (event) handlers.onEvent(event);
    }
  }

  buffer += decoder.decode();
  const parsed = consumeSseBuffer(buffer);
  for (const frame of parsed.frames) {
    const event = parseAiTaskStreamEvent(frame);
    if (event) handlers.onEvent(event);
  }
}

async function streamErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) {
      const messages = body.message as unknown[];
      if (messages.every((item) => typeof item === 'string')) {
        return messages.join(', ');
      }
    }
  } catch {
    // The stream endpoint may fail before returning the normal JSON envelope.
  }

  return `AI task event stream failed with status ${response.status}.`;
}

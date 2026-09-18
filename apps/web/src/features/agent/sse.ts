import type {
  AiTaskStreamEvent,
  AiTaskStreamEventType,
} from './types';

export interface SseFrame {
  event: string | null;
  data: string;
}

const taskEventTypes = new Set<AiTaskStreamEventType>([
  'snapshot',
  'step.created',
  'step.updated',
  'task.updated',
  'task.completed',
  'task.failed',
]);

export function consumeSseBuffer(buffer: string): {
  frames: SseFrame[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const frames = parts
    .map(parseFrame)
    .filter((frame): frame is SseFrame => frame !== null);

  return { frames, rest };
}

export function parseAiTaskStreamEvent(
  frame: SseFrame,
): AiTaskStreamEvent | null {
  try {
    const value = JSON.parse(frame.data) as unknown;
    if (typeof value !== 'object' || value === null) return null;

    const event = value as Partial<AiTaskStreamEvent>;
    if (
      typeof event.taskId !== 'string' ||
      typeof event.type !== 'string' ||
      !taskEventTypes.has(event.type as AiTaskStreamEventType) ||
      typeof event.emittedAt !== 'string' ||
      !('data' in event)
    ) {
      return null;
    }

    return event as AiTaskStreamEvent;
  } catch {
    return null;
  }
}

function parseFrame(value: string): SseFrame | null {
  let event: string | null = null;
  const data: string[] = [];

  for (const line of value.split('\n')) {
    if (!line || line.startsWith(':')) continue;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? '' : line.slice(separator + 1);
    const fieldValue = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'event') event = fieldValue;
    if (field === 'data') data.push(fieldValue);
  }

  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

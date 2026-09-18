export const AI_TASK_EVENT_TYPES = [
  'snapshot',
  'step.created',
  'step.updated',
  'task.updated',
  'task.completed',
  'task.failed',
] as const;

export type AiTaskEventType = (typeof AI_TASK_EVENT_TYPES)[number];

export interface AiTaskStreamEvent {
  taskId: string;
  type: AiTaskEventType;
  data: unknown;
  emittedAt: string;
}

const eventTypes = new Set<string>(AI_TASK_EVENT_TYPES);

export function createAiTaskStreamEvent(
  taskId: string,
  type: AiTaskEventType,
  data: unknown,
): AiTaskStreamEvent {
  return {
    taskId,
    type,
    data,
    emittedAt: new Date().toISOString(),
  };
}

export function isAiTaskStreamEvent(
  value: unknown,
): value is AiTaskStreamEvent {
  if (typeof value !== 'object' || value === null) return false;

  const event = value as Partial<AiTaskStreamEvent>;
  return (
    typeof event.taskId === 'string' &&
    typeof event.type === 'string' &&
    eventTypes.has(event.type) &&
    typeof event.emittedAt === 'string' &&
    'data' in event
  );
}

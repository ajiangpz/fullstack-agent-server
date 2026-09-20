import type {
  AgentStep,
  AiTask,
  AiTaskStatus,
  AiTaskStreamEvent,
} from './types';

const taskStatuses: readonly AiTaskStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];

export function extractAnswerDelta(event: AiTaskStreamEvent): string | null {
  if (
    event.type !== 'answer.delta' ||
    typeof event.data !== 'object' ||
    event.data === null
  ) {
    return null;
  }

  const delta = (event.data as { delta?: unknown }).delta;
  return typeof delta === 'string' && delta.length > 0 ? delta : null;
}

export function reduceAiTaskStreamEvent(
  current: AiTask | undefined,
  event: AiTaskStreamEvent,
): AiTask | undefined {
  if (event.type === 'snapshot') {
    return isAiTask(event.data) ? event.data : current;
  }

  if (!current || current.id !== event.taskId) return current;

  if (event.type === 'step.created' || event.type === 'step.updated') {
    const step = event.data;
    if (!isAgentStep(step)) return current;

    const steps = current.steps.filter((item) => item.id !== step.id);
    steps.push(step);
    steps.sort((left, right) => left.sequence - right.sequence);
    return { ...current, steps };
  }

  return applyTaskPatch(current, event.data);
}

function applyTaskPatch(current: AiTask, value: unknown): AiTask {
  if (typeof value !== 'object' || value === null) return current;
  const patch = value as Record<string, unknown>;
  const next = { ...current };

  if (typeof patch.status === 'string' && isTaskStatus(patch.status)) {
    next.status = patch.status;
  }
  if (typeof patch.result === 'string' || patch.result === null) {
    next.result = patch.result;
  }
  if (
    typeof patch.errorMessage === 'string' ||
    patch.errorMessage === null
  ) {
    next.errorMessage = patch.errorMessage;
  }
  if (typeof patch.attempts === 'number') next.attempts = patch.attempts;
  if (typeof patch.retryCount === 'number') next.retryCount = patch.retryCount;
  if (typeof patch.startedAt === 'string' || patch.startedAt === null) {
    next.startedAt = patch.startedAt;
  }
  if (typeof patch.completedAt === 'string' || patch.completedAt === null) {
    next.completedAt = patch.completedAt;
  }
  if (typeof patch.updatedAt === 'string') next.updatedAt = patch.updatedAt;

  return next;
}

function isAiTask(value: unknown): value is AiTask {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Partial<AiTask>;

  return (
    typeof task.id === 'string' &&
    typeof task.prompt === 'string' &&
    typeof task.status === 'string' &&
    isTaskStatus(task.status) &&
    Array.isArray(task.steps)
  );
}

function isTaskStatus(value: string): value is AiTaskStatus {
  return taskStatuses.some((status) => status === value);
}

function isAgentStep(value: unknown): value is AgentStep {
  if (typeof value !== 'object' || value === null) return false;
  const step = value as Partial<AgentStep>;

  return (
    typeof step.id === 'string' &&
    typeof step.taskId === 'string' &&
    typeof step.type === 'string' &&
    typeof step.status === 'string' &&
    typeof step.sequence === 'number'
  );
}

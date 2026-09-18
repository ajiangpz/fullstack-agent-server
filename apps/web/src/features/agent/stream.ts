import type {
  AgentStep,
  AiTask,
  AiTaskStatus,
  AiTaskStreamEvent,
} from './types';

const taskStatuses = new Set<AiTaskStatus>([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export function reduceAiTaskStreamEvent(
  current: AiTask | undefined,
  event: AiTaskStreamEvent,
): AiTask | undefined {
  if (event.type === 'snapshot') {
    return isAiTask(event.data) ? event.data : current;
  }

  if (!current || current.id !== event.taskId) return current;

  if (event.type === 'step.created' || event.type === 'step.updated') {
    if (!isAgentStep(event.data)) return current;

    const steps = current.steps.filter((step) => step.id !== event.data.id);
    steps.push(event.data);
    steps.sort((left, right) => left.sequence - right.sequence);
    return { ...current, steps };
  }

  return applyTaskPatch(current, event.data);
}

function applyTaskPatch(current: AiTask, value: unknown): AiTask {
  if (typeof value !== 'object' || value === null) return current;
  const patch = value as Record<string, unknown>;
  const next = { ...current };

  if (
    typeof patch.status === 'string' &&
    taskStatuses.has(patch.status as AiTaskStatus)
  ) {
    next.status = patch.status as AiTaskStatus;
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
    taskStatuses.has(task.status as AiTaskStatus) &&
    Array.isArray(task.steps)
  );
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

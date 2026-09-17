import type { AgentStep } from './types';

export type StepPayload =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export function parseStepPayload(value: string | null): StepPayload {
  if (value === null) return null;

  try {
    return JSON.parse(value) as StepPayload;
  } catch {
    return value;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getToolCallMetadata(value: string | null) {
  const payload = asRecord(parseStepPayload(value));
  return {
    toolCallId:
      typeof payload?.toolCallId === 'string' ? payload.toolCallId : null,
    name: typeof payload?.name === 'string' ? payload.name : 'Unknown tool',
    arguments: payload?.arguments ?? null,
  };
}

export function getStepDurationMs(
  step: Pick<AgentStep, 'startedAt' | 'completedAt'>,
): number | null {
  if (!step.completedAt) return null;
  const startedAt = Date.parse(step.startedAt);
  const completedAt = Date.parse(step.completedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(completedAt)) return null;
  return Math.max(0, completedAt - startedAt);
}

export function formatDuration(durationMs: number | null) {
  if (durationMs === null) return 'Running';
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(2)} s`;
}

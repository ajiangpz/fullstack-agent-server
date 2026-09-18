import { describe, expect, it } from 'vitest';
import { reduceAiTaskStreamEvent } from './stream';
import type { AiTask, AgentStep } from './types';

const task: AiTask = {
  id: 'task-1',
  prompt: 'check devices',
  status: 'PROCESSING',
  result: null,
  errorMessage: null,
  attempts: 1,
  retryCount: 0,
  startedAt: '2026-09-18T06:00:00.000Z',
  completedAt: null,
  createdAt: '2026-09-18T05:59:59.000Z',
  updatedAt: '2026-09-18T06:00:00.000Z',
  steps: [],
};

const step = (id: string, sequence: number, status: AgentStep['status']): AgentStep => ({
  id,
  taskId: 'task-1',
  type: 'MODEL_CALL',
  status,
  sequence,
  input: null,
  output: null,
  errorMessage: null,
  startedAt: '2026-09-18T06:00:00.000Z',
  completedAt: status === 'RUNNING' ? null : '2026-09-18T06:00:01.000Z',
  createdAt: '2026-09-18T06:00:00.000Z',
  updatedAt: '2026-09-18T06:00:00.000Z',
});

describe('reduceAiTaskStreamEvent', () => {
  it('replaces cached data with a snapshot', () => {
    const snapshot = { ...task, status: 'COMPLETED' as const };
    expect(
      reduceAiTaskStreamEvent(undefined, {
        taskId: 'task-1',
        type: 'snapshot',
        data: snapshot,
        emittedAt: 'now',
      }),
    ).toEqual(snapshot);
  });

  it('upserts step updates by id and preserves sequence order', () => {
    const current = { ...task, steps: [step('step-2', 2, 'RUNNING')] };

    const withFirst = reduceAiTaskStreamEvent(current, {
      taskId: 'task-1',
      type: 'step.created',
      data: step('step-1', 1, 'RUNNING'),
      emittedAt: 'now',
    });

    const completed = reduceAiTaskStreamEvent(withFirst, {
      taskId: 'task-1',
      type: 'step.updated',
      data: step('step-2', 2, 'COMPLETED'),
      emittedAt: 'now',
    });

    expect(completed?.steps.map((item) => item.id)).toEqual([
      'step-1',
      'step-2',
    ]);
    expect(completed?.steps[1]?.status).toBe('COMPLETED');
  });

  it('applies task terminal patches without dropping cached steps', () => {
    const current = { ...task, steps: [step('step-1', 1, 'COMPLETED')] };

    const completed = reduceAiTaskStreamEvent(current, {
      taskId: 'task-1',
      type: 'task.completed',
      data: {
        status: 'COMPLETED',
        result: '{"answer":"ok","keyPoints":[]}',
        completedAt: '2026-09-18T06:00:02.000Z',
      },
      emittedAt: 'now',
    });

    expect(completed).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        result: '{"answer":"ok","keyPoints":[]}',
        steps: current.steps,
      }),
    );
  });
});

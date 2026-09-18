/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Queue } from 'bullmq';
import { AiTaskEventBus } from './ai-task-event-bus';

describe('AiTaskEventBus', () => {
  const publish = jest.fn();
  const subscribe = jest.fn();
  const unsubscribe = jest.fn();
  const quit = jest.fn();
  let messageHandler: ((channel: string, payload: string) => void) | undefined;

  const subscriber = {
    subscribe,
    unsubscribe,
    quit,
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') {
        messageHandler = (channel, payload) => {
          handler(channel, payload);
        };
      }
    }),
  };

  const redis = {
    publish,
    duplicate: jest.fn(() => subscriber),
  };

  const queue = {
    client: Promise.resolve(redis),
  } as unknown as Queue;

  beforeEach(() => {
    jest.clearAllMocks();
    messageHandler = undefined;
    publish.mockResolvedValue(1);
    subscribe.mockResolvedValue(1);
    unsubscribe.mockResolvedValue(0);
    quit.mockResolvedValue('OK');
  });

  it('publishes task events to a task-scoped Redis channel', async () => {
    const bus = new AiTaskEventBus(queue);

    const published = await bus.publish('task-1', 'step.created', {
      id: 'step-1',
    });

    expect(published).toBe(true);

    expect(publish).toHaveBeenCalledTimes(1);
    const [channel, payload] = publish.mock.calls[0] as [string, string];
    expect(channel).toBe('ai-task:task-1');
    expect(JSON.parse(payload)).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        type: 'step.created',
        data: { id: 'step-1' },
        emittedAt: expect.any(String),
      }),
    );
  });

  it('dispatches subscribed task events and unsubscribes the Redis channel', async () => {
    const bus = new AiTaskEventBus(queue);
    const listener = jest.fn();
    const stop = await bus.subscribe('task-1', listener);

    expect(subscribe).toHaveBeenCalledWith('ai-task:task-1');

    messageHandler?.(
      'ai-task:task-1',
      JSON.stringify({
        taskId: 'task-1',
        type: 'task.updated',
        data: { status: 'PROCESSING' },
        emittedAt: '2026-09-18T06:00:00.000Z',
      }),
    );

    expect(listener).toHaveBeenCalledWith({
      taskId: 'task-1',
      type: 'task.updated',
      data: { status: 'PROCESSING' },
      emittedAt: '2026-09-18T06:00:00.000Z',
    });

    await stop();
    expect(unsubscribe).toHaveBeenCalledWith('ai-task:task-1');
  });
});

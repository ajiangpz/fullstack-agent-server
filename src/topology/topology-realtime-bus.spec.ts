/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Queue } from 'bullmq';
import { TopologyRealtimeBus } from './topology-realtime-bus';
import { createTopologyResync } from './topology-realtime-events';

describe('TopologyRealtimeBus', () => {
  const get = jest.fn();
  const evalCommand = jest.fn();
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
        messageHandler = (channel, payload) => handler(channel, payload);
      }
    }),
  };
  const redis = {
    get,
    eval: evalCommand,
    duplicate: jest.fn(() => subscriber),
  };
  const queue = { client: Promise.resolve(redis) } as unknown as Queue;

  beforeEach(() => {
    jest.clearAllMocks();
    messageHandler = undefined;
    get.mockResolvedValue(null);
    evalCommand.mockResolvedValue(1);
    subscribe.mockResolvedValue(1);
    unsubscribe.mockResolvedValue(0);
    quit.mockResolvedValue('OK');
  });

  it('stores a versioned snapshot using the atomic Redis script', async () => {
    const bus = new TopologyRealtimeBus(queue);
    const snapshot = {
      schemaVersion: 1 as const,
      site: { id: 'site-1', name: 'Default Site' },
      revision: 3,
      generatedAt: new Date(),
      nodes: [],
      edges: [],
    };

    await expect(bus.cacheSnapshot(snapshot)).resolves.toBe(true);
    expect(evalCommand).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'topology:snapshot:site-1',
      'topology:site:site-1',
      '3',
      expect.any(String),
      expect.any(String),
      '',
    );
  });

  it('dispatches site-scoped Redis events to subscribers', async () => {
    const bus = new TopologyRealtimeBus(queue);
    const listener = jest.fn();
    const stop = await bus.subscribe('site-1', listener);
    const event = createTopologyResync('site-1', 4, 'revision-gap');

    messageHandler?.('topology:site:site-1', JSON.stringify(event));

    expect(listener).toHaveBeenCalledWith(event);
    await stop();
    expect(unsubscribe).toHaveBeenCalledWith('topology:site:site-1');
  });
});

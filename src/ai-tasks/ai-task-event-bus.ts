import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AI_TASK_QUEUE } from './ai-task.constants';
import {
  createAiTaskStreamEvent,
  isAiTaskStreamEvent,
  type AiTaskEventType,
  type AiTaskStreamEvent,
} from './ai-task-events';

const CHANNEL_PREFIX = 'ai-task:';

interface RedisCommandClient {
  publish(channel: string, payload: string): Promise<number>;
  duplicate(): RedisSubscriber;
}

interface RedisSubscriber {
  subscribe(channel: string): Promise<number>;
  unsubscribe(channel: string): Promise<number>;
  quit(): Promise<string>;
  on(
    event: 'message',
    listener: (channel: string, payload: string) => void,
  ): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

interface ChannelState {
  listeners: Set<(event: AiTaskStreamEvent) => void>;
  ready: Promise<void>;
}

@Injectable()
export class AiTaskEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(AiTaskEventBus.name);
  private readonly channels = new Map<string, ChannelState>();
  private subscriberPromise: Promise<RedisSubscriber> | null = null;

  constructor(@InjectQueue(AI_TASK_QUEUE) private readonly queue: Queue) {}

  async publish(
    taskId: string,
    type: AiTaskEventType,
    data: unknown,
  ): Promise<boolean> {
    try {
      const client = (await this.queue.client) as unknown as RedisCommandClient;
      const event = createAiTaskStreamEvent(taskId, type, data);
      await client.publish(this.channel(taskId), JSON.stringify(event));
      return true;
    } catch (error) {
      this.logger.warn(
        `Unable to publish AI task event: ${this.errorMessage(error)}`,
      );
      return false;
    }
  }

  async subscribe(
    taskId: string,
    listener: (event: AiTaskStreamEvent) => void,
  ): Promise<() => Promise<void>> {
    let state = this.channels.get(taskId);

    if (!state) {
      state = {
        listeners: new Set(),
        ready: Promise.resolve(),
      };
      this.channels.set(taskId, state);
      state.ready = this.subscribeChannel(taskId, state);
    }

    state.listeners.add(listener);

    try {
      await state.ready;
    } catch (error) {
      state.listeners.delete(listener);
      if (state.listeners.size === 0 && this.channels.get(taskId) === state) {
        this.channels.delete(taskId);
      }
      throw error;
    }

    let stopped = false;
    return async () => {
      if (stopped) return;
      stopped = true;

      const current = this.channels.get(taskId);
      if (!current) return;

      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;

      this.channels.delete(taskId);
      const subscriber = await this.getSubscriber().catch(() => null);
      if (!subscriber) return;

      await subscriber.unsubscribe(this.channel(taskId)).catch((error) => {
        this.logger.warn(
          `Unable to unsubscribe AI task event channel: ${this.errorMessage(error)}`,
        );
      });
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriberPromise) return;

    const subscriber = await this.subscriberPromise.catch(() => null);
    if (!subscriber) return;

    await subscriber.quit().catch((error) => {
      this.logger.warn(
        `Unable to close AI task event subscriber: ${this.errorMessage(error)}`,
      );
    });
  }

  private async subscribeChannel(
    taskId: string,
    state: ChannelState,
  ): Promise<void> {
    const subscriber = await this.getSubscriber();

    if (this.channels.get(taskId) !== state) return;

    await subscriber.subscribe(this.channel(taskId));

    if (this.channels.get(taskId) !== state) {
      await subscriber.unsubscribe(this.channel(taskId));
    }
  }

  private getSubscriber(): Promise<RedisSubscriber> {
    if (!this.subscriberPromise) {
      this.subscriberPromise = this.createSubscriber().catch((error) => {
        this.subscriberPromise = null;
        throw error;
      });
    }

    return this.subscriberPromise;
  }

  private async createSubscriber(): Promise<RedisSubscriber> {
    const client = (await this.queue.client) as unknown as RedisCommandClient;
    const subscriber = client.duplicate();

    subscriber.on('message', (channel, payload) => {
      this.handleMessage(channel, payload);
    });
    subscriber.on('error', (error) => {
      this.logger.warn(
        `AI task event subscriber error: ${this.errorMessage(error)}`,
      );
    });

    return subscriber;
  }

  private handleMessage(channel: string, payload: string): void {
    try {
      const event = JSON.parse(payload) as unknown;
      if (!isAiTaskStreamEvent(event)) return;
      if (channel !== this.channel(event.taskId)) return;

      const state = this.channels.get(event.taskId);
      if (!state) return;

      for (const listener of state.listeners) {
        listener(event);
      }
    } catch {
      this.logger.warn('Ignored malformed AI task event payload');
    }
  }

  private channel(taskId: string): string {
    return `${CHANNEL_PREFIX}${taskId}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown Redis error';
  }
}

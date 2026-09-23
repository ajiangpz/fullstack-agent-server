import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { TOPOLOGY_QUEUE } from './topology.constants';
import type { TopologySnapshotDto } from './dto/topology.dto';
import {
  isTopologyRealtimeEvent,
  type TopologyRealtimeEvent,
} from './topology-realtime-events';

const CHANNEL_PREFIX = 'topology:site:';
const SNAPSHOT_PREFIX = 'topology:snapshot:';
const DEFAULT_SNAPSHOT_TTL_SECONDS = 300;
const DEFAULT_REDIS_TIMEOUT_MS = 500;

const SET_SNAPSHOT_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if ok and decoded['revision'] and tonumber(decoded['revision']) > tonumber(ARGV[1]) then
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
if ARGV[4] ~= '' then
  redis.call('PUBLISH', KEYS[2], ARGV[4])
end
return 1
`;

interface RedisCommandClient {
  get(key: string): Promise<string | null>;
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
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
  listeners: Set<(event: TopologyRealtimeEvent) => void>;
  ready: Promise<void>;
}

@Injectable()
export class TopologyRealtimeBus implements OnModuleDestroy {
  private readonly logger = new Logger(TopologyRealtimeBus.name);
  private readonly channels = new Map<string, ChannelState>();
  private subscriberPromise: Promise<RedisSubscriber> | null = null;

  constructor(@InjectQueue(TOPOLOGY_QUEUE) private readonly queue: Queue) {}

  async getSnapshot(siteId: string): Promise<TopologySnapshotDto | null> {
    try {
      const client = await this.getCommandClient();
      const payload = await this.withRedisTimeout(
        client.get(this.snapshotKey(siteId)),
      );
      return payload ? this.parseSnapshot(payload, siteId) : null;
    } catch (error) {
      this.warn('Unable to read topology snapshot cache', error);
      return null;
    }
  }

  async cacheSnapshot(snapshot: TopologySnapshotDto): Promise<boolean> {
    return this.writeSnapshot(snapshot, null);
  }

  async publishSnapshotAndEvent(
    snapshot: TopologySnapshotDto,
    event: TopologyRealtimeEvent,
  ): Promise<boolean> {
    return this.writeSnapshot(snapshot, event);
  }

  async subscribe(
    siteId: string,
    listener: (event: TopologyRealtimeEvent) => void,
  ): Promise<() => Promise<void>> {
    let state = this.channels.get(siteId);
    if (!state) {
      state = { listeners: new Set(), ready: Promise.resolve() };
      this.channels.set(siteId, state);
      state.ready = this.subscribeChannel(siteId, state);
    }

    state.listeners.add(listener);
    try {
      await state.ready;
    } catch (error) {
      state.listeners.delete(listener);
      if (state.listeners.size === 0 && this.channels.get(siteId) === state) {
        this.channels.delete(siteId);
      }
      throw error;
    }

    let stopped = false;
    return async () => {
      if (stopped) return;
      stopped = true;
      const current = this.channels.get(siteId);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;

      this.channels.delete(siteId);
      const subscriber = await this.getSubscriber().catch(() => null);
      if (subscriber) {
        await this.withRedisTimeout(
          subscriber.unsubscribe(this.channel(siteId)),
        ).catch((error) => {
          this.warn('Unable to unsubscribe topology channel', error);
        });
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriberPromise) return;
    const subscriber = await this.subscriberPromise.catch(() => null);
    if (subscriber) {
      await this.withRedisTimeout(subscriber.quit()).catch((error) => {
        this.warn('Unable to close topology Redis subscriber', error);
      });
    }
  }

  private async writeSnapshot(
    snapshot: TopologySnapshotDto,
    event: TopologyRealtimeEvent | null,
  ): Promise<boolean> {
    try {
      const client = await this.getCommandClient();
      const result = await this.withRedisTimeout(
        client.eval(
          SET_SNAPSHOT_SCRIPT,
          2,
          this.snapshotKey(snapshot.site.id),
          this.channel(snapshot.site.id),
          String(snapshot.revision),
          JSON.stringify(snapshot),
          String(this.snapshotTtlSeconds()),
          event ? JSON.stringify(event) : '',
        ),
      );
      return Number(result) === 1;
    } catch (error) {
      this.warn('Unable to write topology realtime state', error);
      return false;
    }
  }

  private async subscribeChannel(
    siteId: string,
    state: ChannelState,
  ): Promise<void> {
    const subscriber = await this.getSubscriber();
    if (this.channels.get(siteId) !== state) return;

    await this.withRedisTimeout(subscriber.subscribe(this.channel(siteId)));
    if (this.channels.get(siteId) !== state) {
      await this.withRedisTimeout(
        subscriber.unsubscribe(this.channel(siteId)),
      );
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
    const client = await this.getCommandClient();
    const subscriber = client.duplicate();

    subscriber.on('message', (channel, payload) => {
      this.handleMessage(channel, payload);
    });
    subscriber.on('error', (error) => {
      this.warn('Topology Redis subscriber error', error);
    });
    return subscriber;
  }

  private handleMessage(channel: string, payload: string): void {
    try {
      const event = JSON.parse(payload) as unknown;
      if (!isTopologyRealtimeEvent(event)) return;
      if (channel !== this.channel(event.siteId)) return;

      const state = this.channels.get(event.siteId);
      if (!state) return;
      for (const listener of state.listeners) listener(event);
    } catch {
      this.logger.warn('Ignored malformed topology realtime payload');
    }
  }

  private parseSnapshot(
    payload: string,
    siteId: string,
  ): TopologySnapshotDto | null {
    try {
      const value = JSON.parse(payload) as TopologySnapshotDto;
      if (
        value.schemaVersion !== 1 ||
        value.site?.id !== siteId ||
        !Number.isInteger(value.revision) ||
        !Array.isArray(value.nodes) ||
        !Array.isArray(value.edges)
      ) {
        return null;
      }

      return {
        ...value,
        generatedAt: new Date(String(value.generatedAt)),
        nodes: value.nodes.map((node) => ({
          ...node,
          lastSeenAt: node.lastSeenAt ? new Date(String(node.lastSeenAt)) : null,
        })),
        edges: value.edges.map((edge) => ({
          ...edge,
          lastSeenAt: new Date(String(edge.lastSeenAt)),
        })),
      };
    } catch {
      return null;
    }
  }

  private async getCommandClient(): Promise<RedisCommandClient> {
    return this.withRedisTimeout(
      this.queue.client as unknown as Promise<RedisCommandClient>,
    );
  }

  private withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutMs = this.redisTimeoutMs();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Topology Redis operation timed out'));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error('Redis operation failed'));
        },
      );
    });
  }

  private redisTimeoutMs(): number {
    const configured = Number(
      process.env.TOPOLOGY_REDIS_TIMEOUT_MS ?? DEFAULT_REDIS_TIMEOUT_MS,
    );
    if (!Number.isFinite(configured)) return DEFAULT_REDIS_TIMEOUT_MS;
    return Math.min(5_000, Math.max(100, Math.floor(configured)));
  }

  private snapshotTtlSeconds(): number {
    const configured = Number(
      process.env.TOPOLOGY_SNAPSHOT_TTL_SECONDS ??
        DEFAULT_SNAPSHOT_TTL_SECONDS,
    );
    if (!Number.isFinite(configured)) return DEFAULT_SNAPSHOT_TTL_SECONDS;
    return Math.min(86_400, Math.max(30, Math.floor(configured)));
  }

  private channel(siteId: string): string {
    return CHANNEL_PREFIX + siteId;
  }

  private snapshotKey(siteId: string): string {
    return SNAPSHOT_PREFIX + siteId;
  }

  private warn(message: string, error: unknown): void {
    this.logger.warn(
      message + ': ' + (error instanceof Error ? error.message : 'Unknown Redis error'),
    );
  }
}

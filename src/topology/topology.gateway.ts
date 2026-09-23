import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { parseAuthenticatedUser } from '../auth/access-token';
import {
  TOPOLOGY_PATCH_EVENT,
  TOPOLOGY_RESYNC_EVENT,
  TOPOLOGY_SUBSCRIBE_EVENT,
} from './topology.constants';
import { TopologyQueryService } from './topology-query.service';
import { TopologyRealtimeBus } from './topology-realtime-bus';
import { createTopologyResync } from './topology-realtime-events';

const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

interface TopologySocket {
  id: string;
  handshake: {
    auth?: Record<string, unknown>;
  };
  data: {
    user?: AuthenticatedUser;
  };
  emit(event: string, payload: unknown): boolean;
  disconnect(close?: boolean): void;
}

@WebSocketGateway({
  namespace: '/topology',
  transports: ['websocket'],
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class TopologyGateway
  implements OnGatewayConnection<TopologySocket>, OnGatewayDisconnect<TopologySocket>
{
  private readonly subscriptions = new Map<
    string,
    () => Promise<void>
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly queryService: TopologyQueryService,
    private readonly realtimeBus: TopologyRealtimeBus,
  ) {}

  handleConnection(client: TopologySocket): void {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(token);
      client.data.user = parseAuthenticatedUser(payload);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: TopologySocket): Promise<void> {
    await this.stopSubscription(client.id);
  }

  @SubscribeMessage(TOPOLOGY_SUBSCRIBE_EVENT)
  async subscribeToSite(
    @ConnectedSocket() client: TopologySocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const user = client.data.user;
    const request = this.parseSubscription(payload);
    if (!user || !request) {
      client.emit('topology.error', { message: 'Invalid topology subscription' });
      if (!user) client.disconnect(true);
      return;
    }

    await this.stopSubscription(client.id);

    try {
      // Authorize before subscribing so an inaccessible site's patch can
      // never race ahead of the permission check.
      await this.queryService.getTopology(request.siteId, user);

      const stop = await this.realtimeBus.subscribe(request.siteId, (event) => {
        client.emit(
          event.type === 'patch' ? TOPOLOGY_PATCH_EVENT : TOPOLOGY_RESYNC_EVENT,
          event,
        );
      });
      this.subscriptions.set(client.id, stop);

      // Re-read after the Redis subscription is active. If a mutation landed
      // between authorization and subscribe, revision mismatch forces resync.
      const snapshot = await this.queryService.getTopology(request.siteId, user);
      if (snapshot.revision !== request.revision) {
        client.emit(
          TOPOLOGY_RESYNC_EVENT,
          createTopologyResync(
            request.siteId,
            snapshot.revision,
            'revision-mismatch',
          ),
        );
      }

      client.emit('topology.ready', {
        siteId: request.siteId,
        revision: snapshot.revision,
      });
    } catch {
      await this.stopSubscription(client.id);
      client.emit('topology.error', {
        message: 'Topology subscription is unavailable',
      });
    }
  }

  private parseSubscription(
    payload: unknown,
  ): { siteId: string; revision: number } | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const value = payload as { siteId?: unknown; revision?: unknown };
    if (
      typeof value.siteId !== 'string' ||
      value.siteId.length === 0 ||
      value.siteId.length > 128 ||
      !Number.isInteger(value.revision) ||
      (value.revision as number) < 0
    ) {
      return null;
    }
    return { siteId: value.siteId, revision: value.revision as number };
  }

  private async stopSubscription(clientId: string): Promise<void> {
    const stop = this.subscriptions.get(clientId);
    if (!stop) return;
    this.subscriptions.delete(clientId);
    await stop();
  }
}

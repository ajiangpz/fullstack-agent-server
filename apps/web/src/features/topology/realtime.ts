import { io } from 'socket.io-client';
import { apiUrl } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type {
  TopologyPatchEvent,
  TopologyResyncEvent,
} from './types';
import { isTopologyPatchEvent } from './graph/topology-patch';

export type TopologyRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'fallback';

export function connectTopologyRealtime(options: {
  siteId: string;
  getRevision: () => number;
  onPatch: (event: TopologyPatchEvent) => void;
  onResync: (event: TopologyResyncEvent) => void;
  onStatus: (status: TopologyRealtimeStatus) => void;
}) {
  const token = useAuthStore.getState().accessToken;
  const socket = io(apiUrl('/topology'), {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  options.onStatus('connecting');

  socket.on('connect', () => {
    options.onStatus('connected');
    socket.emit('topology.subscribe', {
      siteId: options.siteId,
      revision: options.getRevision(),
    });
  });
  socket.on('disconnect', () => options.onStatus('fallback'));
  socket.on('connect_error', () => options.onStatus('fallback'));
  socket.on('topology.patch', (value: unknown) => {
    if (isTopologyPatchEvent(value)) options.onPatch(value);
  });
  socket.on('topology.resync', (value: unknown) => {
    if (isTopologyResyncEvent(value)) options.onResync(value);
  });
  socket.on('topology.error', () => {
    options.onStatus('fallback');
    options.onResync({
      schemaVersion: 1,
      type: 'resync',
      siteId: options.siteId,
      revision: options.getRevision(),
      reason: 'revision-mismatch',
      emittedAt: new Date().toISOString(),
    });
  });

  return () => {
    socket.disconnect();
  };
}

const resyncReasons = new Set<TopologyResyncEvent['reason']>([
  'snapshot-miss',
  'revision-gap',
  'revision-mismatch',
  'concurrent-change',
]);

function isTopologyResyncEvent(
  value: unknown,
): value is TopologyResyncEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<TopologyResyncEvent>;
  return (
    event.schemaVersion === 1 &&
    event.type === 'resync' &&
    typeof event.siteId === 'string' &&
    event.siteId.length > 0 &&
    Number.isInteger(event.revision) &&
    (event.revision as number) >= 0 &&
    typeof event.emittedAt === 'string' &&
    resyncReasons.has(event.reason as TopologyResyncEvent['reason'])
  );
}

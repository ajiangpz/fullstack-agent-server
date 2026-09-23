import type {
  TopologyEdgeDto,
  TopologyNodeDto,
  TopologySnapshotDto,
} from './dto/topology.dto';

export interface TopologyPatchChanges {
  nodes: {
    upsert: TopologyNodeDto[];
    remove: string[];
  };
  edges: {
    upsert: TopologyEdgeDto[];
    remove: string[];
  };
}

export interface TopologyPatchEvent {
  schemaVersion: 1;
  type: 'patch';
  siteId: string;
  baseRevision: number;
  revision: number;
  changes: TopologyPatchChanges;
  emittedAt: string;
}

export interface TopologyResyncEvent {
  schemaVersion: 1;
  type: 'resync';
  siteId: string;
  revision: number;
  reason:
    | 'snapshot-miss'
    | 'revision-gap'
    | 'revision-mismatch'
    | 'concurrent-change';
  emittedAt: string;
}

export type TopologyRealtimeEvent =
  | TopologyPatchEvent
  | TopologyResyncEvent;

export function createTopologyPatch(
  previous: TopologySnapshotDto,
  next: TopologySnapshotDto,
): TopologyPatchEvent | null {
  if (next.revision !== previous.revision + 1) return null;

  return {
    schemaVersion: 1,
    type: 'patch',
    siteId: next.site.id,
    baseRevision: previous.revision,
    revision: next.revision,
    changes: {
      nodes: diffById(previous.nodes, next.nodes),
      edges: diffById(previous.edges, next.edges),
    },
    emittedAt: new Date().toISOString(),
  };
}

export function createTopologyResync(
  siteId: string,
  revision: number,
  reason: TopologyResyncEvent['reason'],
): TopologyResyncEvent {
  return {
    schemaVersion: 1,
    type: 'resync',
    siteId,
    revision,
    reason,
    emittedAt: new Date().toISOString(),
  };
}

const resyncReasons = new Set<TopologyResyncEvent['reason']>([
  'snapshot-miss',
  'revision-gap',
  'revision-mismatch',
  'concurrent-change',
]);

export function isTopologyRealtimeEvent(
  value: unknown,
): value is TopologyRealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<TopologyRealtimeEvent>;
  const common =
    event.schemaVersion === 1 &&
    typeof event.siteId === 'string' &&
    event.siteId.length > 0 &&
    Number.isInteger(event.revision) &&
    (event.revision as number) >= 0 &&
    typeof event.emittedAt === 'string';

  if (!common) return false;

  if (event.type === 'resync') {
    return resyncReasons.has(event.reason as TopologyResyncEvent['reason']);
  }

  if (event.type !== 'patch' || !Number.isInteger(event.baseRevision)) {
    return false;
  }

  const patch = event as Partial<TopologyPatchEvent>;
  const changes = patch.changes;
  if (typeof changes !== 'object' || changes === null) return false;

  return (
    (patch.baseRevision as number) >= 0 &&
    typeof changes.nodes === 'object' &&
    changes.nodes !== null &&
    Array.isArray(changes.nodes.upsert) &&
    Array.isArray(changes.nodes.remove) &&
    typeof changes.edges === 'object' &&
    changes.edges !== null &&
    Array.isArray(changes.edges.upsert) &&
    Array.isArray(changes.edges.remove)
  );
}

function diffById<T extends { id: string }>(
  previous: T[],
  next: T[],
): { upsert: T[]; remove: string[] } {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));

  const upsert = next.filter((item) => {
    const before = previousById.get(item.id);
    return !before || JSON.stringify(before) !== JSON.stringify(item);
  });

  const remove = previous
    .filter((item) => !nextById.has(item.id))
    .map((item) => item.id);

  return { upsert, remove };
}

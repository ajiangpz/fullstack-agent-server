import type {
  AppliedTopologyPatch,
  TopologyEdge,
  TopologyNode,
  TopologyPatchEvent,
  TopologySnapshot,
} from '../types';

export function applyTopologyPatch(
  snapshot: TopologySnapshot,
  patch: TopologyPatchEvent,
): AppliedTopologyPatch | null {
  if (
    patch.siteId !== snapshot.site.id ||
    patch.baseRevision !== snapshot.revision ||
    patch.revision !== patch.baseRevision + 1
  ) {
    return null;
  }

  const nodes = applyById(
    snapshot.nodes,
    patch.changes.nodes.upsert,
    patch.changes.nodes.remove,
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = applyById(
    snapshot.edges,
    patch.changes.edges.upsert,
    patch.changes.edges.remove,
  ).filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );

  return {
    snapshot: {
      ...snapshot,
      revision: patch.revision,
      generatedAt: patch.emittedAt,
      nodes,
      edges,
    },
    structural: isStructuralPatch(snapshot, patch),
  };
}

export function isTopologyPatchEvent(
  value: unknown,
): value is TopologyPatchEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<TopologyPatchEvent>;
  const changes = event.changes;

  return (
    event.schemaVersion === 1 &&
    event.type === 'patch' &&
    typeof event.siteId === 'string' &&
    event.siteId.length > 0 &&
    Number.isInteger(event.baseRevision) &&
    (event.baseRevision as number) >= 0 &&
    Number.isInteger(event.revision) &&
    (event.revision as number) >= 0 &&
    typeof event.emittedAt === 'string' &&
    typeof changes === 'object' &&
    changes !== null &&
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

function isStructuralPatch(
  snapshot: TopologySnapshot,
  patch: TopologyPatchEvent,
): boolean {
  if (
    patch.changes.nodes.remove.length > 0 ||
    patch.changes.edges.remove.length > 0
  ) {
    return true;
  }

  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  for (const node of patch.changes.nodes.upsert) {
    const before = nodes.get(node.id);
    if (!before || before.type !== node.type) return true;
  }

  const edges = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
  for (const edge of patch.changes.edges.upsert) {
    const before = edges.get(edge.id);
    if (
      !before ||
      before.source !== edge.source ||
      before.target !== edge.target
    ) {
      return true;
    }
  }

  return false;
}

function applyById<T extends { id: string }>(
  current: T[],
  upsert: T[],
  remove: string[],
): T[] {
  const removed = new Set(remove);
  const byId = new Map(
    current
      .filter((item) => !removed.has(item.id))
      .map((item) => [item.id, item]),
  );
  for (const item of upsert) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function topologyStructureKey(snapshot: TopologySnapshot): string {
  const nodes = snapshot.nodes
    .map((node: TopologyNode) => node.id + ':' + node.type)
    .sort()
    .join('|');
  const edges = snapshot.edges
    .map(
      (edge: TopologyEdge) =>
        edge.id + ':' + edge.source + ':' + edge.target,
    )
    .sort()
    .join('|');
  return nodes + '//' + edges;
}

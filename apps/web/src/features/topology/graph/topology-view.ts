import type {
  DeviceType,
  TopologyEdge,
  TopologyNode,
  TopologySnapshot,
} from '../types';

export interface TopologyHierarchy {
  parentByNode: Record<string, string | null>;
  childrenByNode: Record<string, string[]>;
  depthByNode: Record<string, number>;
  edgeDirection: Record<string, { source: string; target: string }>;
}

export interface TopologyVisibility {
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
}

export function buildTopologyHierarchy(
  snapshot: TopologySnapshot,
): TopologyHierarchy {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<
    string,
    Array<{ neighborId: string; edge: TopologyEdge }>
  >();

  for (const node of snapshot.nodes) adjacency.set(node.id, []);
  for (const edge of snapshot.edges) {
    adjacency.get(edge.source)?.push({ neighborId: edge.target, edge });
    adjacency.get(edge.target)?.push({ neighborId: edge.source, edge });
  }

  const parentByNode: Record<string, string | null> = {};
  const childrenByNode: Record<string, string[]> = Object.fromEntries(
    snapshot.nodes.map((node) => [node.id, []]),
  );
  const depthByNode: Record<string, number> = {};
  const edgeDirection: Record<string, { source: string; target: string }> = {};
  const unvisited = new Set(snapshot.nodes.map((node) => node.id));

  while (unvisited.size > 0) {
    const root = [...unvisited]
      .map((id) => nodesById.get(id)!)
      .sort((a, b) => compareRootCandidate(a, b, adjacency))[0];

    parentByNode[root.id] = null;
    depthByNode[root.id] = 0;
    unvisited.delete(root.id);

    const queue = [root.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = [...(adjacency.get(current) ?? [])].sort((a, b) =>
        a.neighborId.localeCompare(b.neighborId),
      );

      for (const { neighborId, edge } of neighbors) {
        if (unvisited.has(neighborId)) {
          parentByNode[neighborId] = current;
          depthByNode[neighborId] = depthByNode[current] + 1;
          childrenByNode[current].push(neighborId);
          edgeDirection[edge.id] = { source: current, target: neighborId };
          unvisited.delete(neighborId);
          queue.push(neighborId);
          continue;
        }

        if (!edgeDirection[edge.id]) {
          edgeDirection[edge.id] = orientExistingEdge(
            current,
            neighborId,
            depthByNode,
          );
        }
      }
    }
  }

  for (const children of Object.values(childrenByNode)) children.sort();

  return { parentByNode, childrenByNode, depthByNode, edgeDirection };
}

export function computeTopologyVisibility(
  snapshot: TopologySnapshot,
  hierarchy: TopologyHierarchy,
  filters: {
    status: 'all' | TopologyNode['status'];
    type: 'ALL' | DeviceType;
    collapsedNodeIds: string[];
  },
): TopologyVisibility {
  const hiddenByCollapse = new Set<string>();
  for (const nodeId of filters.collapsedNodeIds) {
    for (const descendant of getTopologyDescendants(nodeId, hierarchy)) {
      hiddenByCollapse.add(descendant);
    }
  }

  const visibleNodeIds = new Set(
    snapshot.nodes
      .filter(
        (node) =>
          !hiddenByCollapse.has(node.id) &&
          (filters.status === 'all' || node.status === filters.status) &&
          (filters.type === 'ALL' || node.type === filters.type),
      )
      .map((node) => node.id),
  );

  const visibleEdgeIds = new Set(
    snapshot.edges
      .filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      )
      .map((edge) => edge.id),
  );

  return { visibleNodeIds, visibleEdgeIds };
}

export function getTopologyDescendants(
  nodeId: string,
  hierarchy: TopologyHierarchy,
): string[] {
  const result: string[] = [];
  const stack = [...(hierarchy.childrenByNode[nodeId] ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    stack.push(...(hierarchy.childrenByNode[current] ?? []));
  }
  return result;
}

export function getTopologyAncestors(
  nodeId: string,
  hierarchy: TopologyHierarchy,
): string[] {
  const result: string[] = [];
  let current = hierarchy.parentByNode[nodeId];
  while (current) {
    result.push(current);
    current = hierarchy.parentByNode[current];
  }
  return result;
}

export function findTopologyNode(
  snapshot: TopologySnapshot,
  query: string,
): TopologyNode | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const ranked = snapshot.nodes
    .map((node) => ({ node, score: nodeMatchScore(node, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        rootPriority(a.node.type) - rootPriority(b.node.type) ||
        a.node.name.localeCompare(b.node.name),
    );

  return ranked[0]?.node ?? null;
}

function nodeMatchScore(node: TopologyNode, query: string) {
  const name = node.name.toLowerCase();
  const ip = node.ip.toLowerCase();
  if (name === query || ip === query) return 100;
  if (name.startsWith(query) || ip.startsWith(query)) return 70;
  if (name.includes(query) || ip.includes(query)) return 40;
  return 0;
}

function compareRootCandidate(
  a: TopologyNode,
  b: TopologyNode,
  adjacency: Map<string, Array<{ neighborId: string; edge: TopologyEdge }>>,
) {
  return (
    rootPriority(a.type) - rootPriority(b.type) ||
    (adjacency.get(b.id)?.length ?? 0) - (adjacency.get(a.id)?.length ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

function rootPriority(type: DeviceType) {
  const priorities: Record<DeviceType, number> = {
    GATEWAY: 0,
    ROUTER: 1,
    SWITCH: 2,
    SERVER: 3,
    ACCESS_POINT: 4,
    CLIENT: 5,
    UNKNOWN: 6,
  };
  return priorities[type];
}

function orientExistingEdge(
  a: string,
  b: string,
  depthByNode: Record<string, number>,
) {
  const aDepth = depthByNode[a] ?? Number.MAX_SAFE_INTEGER;
  const bDepth = depthByNode[b] ?? Number.MAX_SAFE_INTEGER;
  if (aDepth < bDepth) return { source: a, target: b };
  if (bDepth < aDepth) return { source: b, target: a };
  return a.localeCompare(b) <= 0
    ? { source: a, target: b }
    : { source: b, target: a };
}

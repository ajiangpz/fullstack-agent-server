import type { GraphData } from '@antv/g6';
import type { TopologyEdge, TopologyNode, TopologySnapshot } from '../types';

export function toG6GraphData(snapshot: TopologySnapshot): GraphData {
  return {
    nodes: snapshot.nodes.map(toG6Node),
    edges: snapshot.edges.map(toG6Edge),
  };
}

function toG6Node(node: TopologyNode) {
  const visual = nodeVisual(node.status);
  return {
    id: node.id,
    data: { ...node },
    style: {
      size: [156, 56] as [number, number],
      radius: 10,
      fill: visual.fill,
      stroke: visual.stroke,
      lineWidth: 1.5,
      shadowColor: 'rgba(0, 0, 0, 0.35)',
      shadowBlur: 8,
      labelText: node.name,
      labelFill: '#f4f4f5',
      labelFontSize: 12,
      labelFontWeight: 600,
      labelPlacement: 'center' as const,
      cursor: 'pointer' as const,
    },
  };
}

function toG6Edge(edge: TopologyEdge) {
  const visual = edgeVisual(edge.status);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { ...edge },
    style: {
      stroke: visual.stroke,
      lineWidth: edgeWidth(edge.speedMbps),
      lineDash: visual.lineDash,
      opacity: 0.88,
      labelText: edge.speedMbps ? formatSpeed(edge.speedMbps) : '',
      labelFill: '#a1a1aa',
      labelFontSize: 10,
      labelBackground: true,
      labelBackgroundFill: '#18181b',
      labelBackgroundRadius: 4,
      labelPadding: [2, 4] as [number, number],
    },
  };
}

export function nodeVisual(status: TopologyNode['status']) {
  return status === 'online'
    ? { fill: '#102a25', stroke: '#22c55e' }
    : { fill: '#32191d', stroke: '#ef4444' };
}

export function edgeVisual(status: TopologyEdge['status']) {
  switch (status) {
    case 'UP': return { stroke: '#52525b', lineDash: undefined };
    case 'DEGRADED': return { stroke: '#f59e0b', lineDash: [6, 4] };
    case 'DOWN': return { stroke: '#ef4444', lineDash: [6, 4] };
    default: return { stroke: '#71717a', lineDash: [3, 4] };
  }
}

function edgeWidth(speedMbps: number | null) {
  if (!speedMbps) return 1.25;
  if (speedMbps >= 10_000) return 3;
  if (speedMbps >= 1_000) return 2.25;
  return 1.5;
}

function formatSpeed(speedMbps: number) {
  if (speedMbps >= 1_000) {
    const gbps = speedMbps / 1_000;
    return Number.isInteger(gbps) ? `${gbps}G` : `${gbps.toFixed(1)}G`;
  }
  return `${speedMbps}M`;
}

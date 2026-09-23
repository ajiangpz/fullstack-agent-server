import {
  CanvasEvent,
  EdgeEvent,
  Graph,
  NodeEvent,
  type GraphData,
} from '@antv/g6';
import type { TopologySelection } from '../ui-store';

export type TopologyGraph = Graph;

export function createTopologyGraph(
  container: HTMLElement,
  onSelectionChange: (selection: TopologySelection) => void,
) {
  const graph = new Graph({
    container,
    data: { nodes: [], edges: [] },
    background: 'transparent',
    padding: 48,
    autoFit: 'view',
    autoResize: true,
    zoomRange: [0.35, 2.5],
    layout: {
      type: 'antv-dagre',
      rankdir: 'TB',
      align: 'UL',
      nodesep: 44,
      ranksep: 82,
      nodeSize: [156, 56],
      animation: false,
    },
    node: {
      type: 'rect',
      state: {
        selected: {
          stroke: '#22d3ee',
          lineWidth: 3,
          halo: true,
          haloStroke: '#0891b2',
          haloLineWidth: 5,
        },
        highlight: { stroke: '#67e8f9', lineWidth: 2 },
      },
    },
    edge: {
      type: 'line',
      state: {
        selected: { stroke: '#22d3ee', lineWidth: 3 },
        highlight: { stroke: '#67e8f9', lineWidth: 2.5 },
      },
    },
    behaviors: ['drag-canvas', 'zoom-canvas'],
  });

  graph.on(NodeEvent.CLICK, (event) => {
    onSelectionChange({ kind: 'node', id: event.target.id });
  });
  graph.on(EdgeEvent.CLICK, (event) => {
    onSelectionChange({ kind: 'edge', id: event.target.id });
  });
  graph.on(CanvasEvent.CLICK, () => onSelectionChange(null));

  return graph;
}

export async function renderTopologyGraph(graph: TopologyGraph, data: GraphData) {
  graph.setData(data);
  await graph.render();
}

export async function fitTopologyGraph(graph: TopologyGraph) {
  await graph.fitView();
}

export async function focusTopologyElement(graph: TopologyGraph, id: string) {
  await graph.focusElement(id, { duration: 350, easing: 'ease-in-out' });
}

export async function applyTopologyVisibility(
  graph: TopologyGraph,
  visibleNodeIds: Set<string>,
  visibleEdgeIds: Set<string>,
) {
  const visibility: Record<string, 'visible' | 'hidden'> = {};
  for (const node of graph.getNodeData()) {
    visibility[node.id] = visibleNodeIds.has(node.id) ? 'visible' : 'hidden';
  }
  for (const edge of graph.getEdgeData()) {
    if (!edge.id) continue;
    visibility[edge.id] = visibleEdgeIds.has(edge.id) ? 'visible' : 'hidden';
  }
  await graph.setElementVisibility(visibility, false);
}

export async function applyTopologySelection(
  graph: TopologyGraph,
  selection: TopologySelection,
) {
  const states: Record<string, string[]> = {};
  for (const node of graph.getNodeData()) states[node.id] = [];
  for (const edge of graph.getEdgeData()) if (edge.id) states[edge.id] = [];

  if (selection) {
    states[selection.id] = ['selected'];
    if (selection.kind === 'node') {
      for (const neighbor of graph.getNeighborNodesData(selection.id)) {
        states[neighbor.id] = ['highlight'];
      }
      for (const edge of graph.getRelatedEdgesData(selection.id)) {
        if (edge.id) states[edge.id] = ['highlight'];
      }
      states[selection.id] = ['selected'];
    } else {
      const edge = graph.getEdgeData(selection.id);
      states[edge.source] = ['highlight'];
      states[edge.target] = ['highlight'];
      states[selection.id] = ['selected'];
    }
  }

  await graph.setElementState(states, false);
}

import {
  CanvasEvent,
  EdgeEvent,
  Graph,
  NodeEvent,
  type GraphData,
} from '@antv/g6';
import type { TopologyLayoutCapture, TopologyView } from '../types';
import type { TopologySelection } from '../ui-store';

export type TopologyGraph = Graph;

export function createTopologyGraph(
  container: HTMLElement,
  callbacks: {
    onSelectionChange: (selection: TopologySelection) => void;
    onLayoutDirty: () => void;
  },
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
    behaviors: [
      'drag-canvas',
      'zoom-canvas',
      {
        type: 'drag-element',
        key: 'drag-node',
        trigger: [],
        dropEffect: 'none',
        shadow: false,
        enable: (event) => event.targetType === 'node',
      },
    ],
  });

  graph.on(NodeEvent.CLICK, (event) => {
    callbacks.onSelectionChange({ kind: 'node', id: event.target.id });
  });
  graph.on(EdgeEvent.CLICK, (event) => {
    callbacks.onSelectionChange({ kind: 'edge', id: event.target.id });
  });
  graph.on(CanvasEvent.CLICK, () => callbacks.onSelectionChange(null));
  graph.on(NodeEvent.DRAG_END, callbacks.onLayoutDirty);
  graph.on(CanvasEvent.DRAG_END, callbacks.onLayoutDirty);
  graph.on(CanvasEvent.WHEEL, callbacks.onLayoutDirty);

  return graph;
}

export async function renderTopologyGraph(graph: TopologyGraph, data: GraphData) {
  graph.setData(data);
  await graph.render();
}

export async function fitTopologyGraph(graph: TopologyGraph) {
  await graph.fitView();
}

export async function resetTopologyLayout(graph: TopologyGraph) {
  await graph.layout();
  await graph.fitView();
}

export async function focusTopologyElement(graph: TopologyGraph, id: string) {
  await graph.focusElement(id, { duration: 350, easing: 'ease-in-out' });
}

export async function restoreTopologyView(
  graph: TopologyGraph,
  view: TopologyView,
) {
  if (!view.viewId || !view.viewport) return;

  const nodeIds = new Set(graph.getNodeData().map((node) => node.id));
  const positions: Record<string, [number, number]> = {};
  for (const node of view.nodes) {
    if (nodeIds.has(node.nodeId)) positions[node.nodeId] = [node.x, node.y];
  }

  if (Object.keys(positions).length > 0) {
    await graph.translateElementTo(positions, false);
  }
  await graph.zoomTo(view.viewport.zoom, false);
  await graph.translateTo([view.viewport.x, view.viewport.y], false);
}

export function captureTopologyLayout(
  graph: TopologyGraph,
): TopologyLayoutCapture {
  const position = graph.getPosition();
  return {
    viewport: {
      x: position[0],
      y: position[1],
      zoom: graph.getZoom(),
    },
    nodes: graph.getNodeData().map((node) => {
      const point = graph.getElementPosition(node.id);
      return { nodeId: node.id, x: point[0], y: point[1] };
    }),
  };
}

export async function syncTopologyVisualData(
  graph: TopologyGraph,
  data: GraphData,
) {
  const existingNodeIds = new Set(
    graph.getNodeData().map((node) => node.id),
  );
  const existingEdgeIds = new Set(
    graph
      .getEdgeData()
      .map((edge) => edge.id)
      .filter((id): id is string => typeof id === 'string'),
  );

  const nodes = (data.nodes ?? []).filter((node) =>
    existingNodeIds.has(node.id),
  );
  const edges = (data.edges ?? []).filter(
    (edge) => edge.id && existingEdgeIds.has(edge.id),
  );

  if (nodes.length > 0) graph.updateNodeData(nodes);
  if (edges.length > 0) graph.updateEdgeData(edges);
  if (nodes.length > 0 || edges.length > 0) await graph.draw();
}

export async function restoreTopologyLayout(
  graph: TopologyGraph,
  layout: TopologyLayoutCapture,
) {
  const ids = new Set(graph.getNodeData().map((node) => node.id));
  const positions: Record<string, [number, number]> = {};
  for (const node of layout.nodes) {
    if (ids.has(node.nodeId)) positions[node.nodeId] = [node.x, node.y];
  }
  if (Object.keys(positions).length > 0) {
    await graph.translateElementTo(positions, false);
  }
  await graph.zoomTo(layout.viewport.zoom, false);
  await graph.translateTo([layout.viewport.x, layout.viewport.y], false);
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

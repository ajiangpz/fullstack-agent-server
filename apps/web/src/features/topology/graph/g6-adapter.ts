import { Graph, type GraphData } from '@antv/g6';

export type TopologyGraph = Graph;

export function createTopologyGraph(container: HTMLElement) {
  return new Graph({
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
    node: { type: 'rect' },
    edge: { type: 'line' },
    behaviors: ['drag-canvas', 'zoom-canvas'],
  });
}

export async function renderTopologyGraph(graph: TopologyGraph, data: GraphData) {
  graph.setData(data);
  await graph.render();
}

export async function fitTopologyGraph(graph: TopologyGraph) {
  await graph.fitView();
}

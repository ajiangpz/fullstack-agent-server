'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphData } from '@antv/g6';
import {
  applyTopologySelection,
  applyTopologyVisibility,
  captureTopologyLayout,
  createTopologyGraph,
  fitTopologyGraph,
  focusTopologyElement,
  renderTopologyGraph,
  resetTopologyLayout,
  restoreTopologyLayout,
  restoreTopologyView,
  syncTopologyVisualData,
  type TopologyGraph,
} from '../graph/g6-adapter';
import type { TopologyLayoutCapture, TopologyView } from '../types';
import type { TopologySelection } from '../ui-store';

export function TopologyCanvas({
  data,
  persistedView,
  dataKey,
  fitRequest,
  focusRequest,
  captureRequest,
  resetLayoutRequest,
  visibleNodeIds,
  visibleEdgeIds,
  selected,
  onSelectionChange,
  onLayoutDirty,
  onLayoutCapture,
  empty,
  ariaLabel,
  emptyMessage,
  renderErrorMessage,
}: {
  data: GraphData;
  persistedView: TopologyView | null;
  dataKey: string;
  fitRequest: number;
  focusRequest: { id: string; token: number } | null;
  captureRequest: number;
  resetLayoutRequest: number;
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  selected: TopologySelection;
  onSelectionChange: (selection: TopologySelection) => void;
  onLayoutDirty: () => void;
  onLayoutCapture: (capture: TopologyLayoutCapture) => void;
  empty: boolean;
  ariaLabel: string;
  emptyMessage: string;
  renderErrorMessage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const graphRef = useRef<TopologyGraph | null>(null);
  const operationRef = useRef<Promise<void>>(Promise.resolve());
  const selectionCallbackRef = useRef(onSelectionChange);
  const dirtyCallbackRef = useRef(onLayoutDirty);
  const captureCallbackRef = useRef(onLayoutCapture);
  const [renderError, setRenderError] = useState(false);

  selectionCallbackRef.current = onSelectionChange;
  dirtyCallbackRef.current = onLayoutDirty;
  captureCallbackRef.current = onLayoutCapture;
  dataRef.current = data;

  const enqueue = useCallback((operation: (graph: TopologyGraph) => Promise<void>) => {
    operationRef.current = operationRef.current
      .then(async () => {
        const graph = graphRef.current;
        if (graph) await operation(graph);
      })
      .catch(() => setRenderError(true));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph = createTopologyGraph(container, {
      onSelectionChange: (selection) => selectionCallbackRef.current(selection),
      onLayoutDirty: () => dirtyCallbackRef.current(),
    });
    graphRef.current = graph;
    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRenderError(false);
    enqueue(async (graph) => {
      const previousLayout =
        graph.getNodeData().length > 0 ? captureTopologyLayout(graph) : null;
      await renderTopologyGraph(graph, dataRef.current);
      if (previousLayout) {
        await restoreTopologyLayout(graph, previousLayout);
      } else if (persistedView) {
        await restoreTopologyView(graph, persistedView);
      }
    });
  }, [dataKey, enqueue]);

  useEffect(() => {
    enqueue((graph) => syncTopologyVisualData(graph, data));
  }, [data, enqueue]);

  useEffect(() => {
    if (!persistedView?.viewId) return;
    enqueue((graph) => restoreTopologyView(graph, persistedView));
  }, [enqueue, persistedView?.revision]);

  useEffect(() => {
    enqueue((graph) =>
      applyTopologyVisibility(graph, visibleNodeIds, visibleEdgeIds),
    );
  }, [enqueue, visibleEdgeIds, visibleNodeIds]);

  useEffect(() => {
    enqueue((graph) => applyTopologySelection(graph, selected));
  }, [enqueue, selected]);

  useEffect(() => {
    if (fitRequest === 0) return;
    enqueue((graph) => fitTopologyGraph(graph));
  }, [enqueue, fitRequest]);

  useEffect(() => {
    if (!focusRequest) return;
    enqueue((graph) => focusTopologyElement(graph, focusRequest.id));
  }, [enqueue, focusRequest]);

  useEffect(() => {
    if (resetLayoutRequest === 0) return;
    enqueue((graph) => resetTopologyLayout(graph));
  }, [enqueue, resetLayoutRequest]);

  useEffect(() => {
    if (captureRequest === 0) return;
    enqueue(async (graph) => {
      captureCallbackRef.current(captureTopologyLayout(graph));
    });
  }, [captureRequest, enqueue]);

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-xl bg-zinc-950/70">
      <div ref={containerRef} className="h-full w-full" aria-label={ariaLabel} />
      {empty ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center text-sm text-zinc-500">
          {emptyMessage}
        </div>
      ) : null}
      {renderError ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-red-900/70 bg-red-950/80 px-4 py-3 text-sm text-red-200">
          {renderErrorMessage}
        </div>
      ) : null}
    </div>
  );
}

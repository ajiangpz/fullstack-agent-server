'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphData } from '@antv/g6';
import {
  applyTopologySelection,
  applyTopologyVisibility,
  createTopologyGraph,
  fitTopologyGraph,
  focusTopologyElement,
  renderTopologyGraph,
  type TopologyGraph,
} from '../graph/g6-adapter';
import type { TopologySelection } from '../ui-store';

export function TopologyCanvas({
  data,
  fitRequest,
  focusRequest,
  visibleNodeIds,
  visibleEdgeIds,
  selected,
  onSelectionChange,
  empty,
  ariaLabel,
  emptyMessage,
  renderErrorMessage,
}: {
  data: GraphData;
  fitRequest: number;
  focusRequest: { id: string; token: number } | null;
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  selected: TopologySelection;
  onSelectionChange: (selection: TopologySelection) => void;
  empty: boolean;
  ariaLabel: string;
  emptyMessage: string;
  renderErrorMessage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<TopologyGraph | null>(null);
  const operationRef = useRef<Promise<void>>(Promise.resolve());
  const selectionCallbackRef = useRef(onSelectionChange);
  const [renderError, setRenderError] = useState(false);

  selectionCallbackRef.current = onSelectionChange;

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
    const graph = createTopologyGraph(container, (selection) =>
      selectionCallbackRef.current(selection),
    );
    graphRef.current = graph;
    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRenderError(false);
    enqueue((graph) => renderTopologyGraph(graph, data));
  }, [data, enqueue]);

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

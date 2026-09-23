'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphData } from '@antv/g6';
import { createTopologyGraph, fitTopologyGraph, renderTopologyGraph, type TopologyGraph } from '../graph/g6-adapter';

export function TopologyCanvas({ data, fitRequest, empty, ariaLabel, emptyMessage, renderErrorMessage }: {
  data: GraphData;
  fitRequest: number;
  empty: boolean;
  ariaLabel: string;
  emptyMessage: string;
  renderErrorMessage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<TopologyGraph | null>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph = createTopologyGraph(container);
    graphRef.current = graph;
    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    let active = true;
    setRenderError(false);
    void renderTopologyGraph(graph, data).catch(() => {
      if (active) setRenderError(true);
    });
    return () => { active = false; };
  }, [data]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || fitRequest === 0) return;
    void fitTopologyGraph(graph);
  }, [fitRequest]);

  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-xl bg-zinc-950/70">
      <div ref={containerRef} className="h-full w-full" aria-label={ariaLabel} />
      {empty ? <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center text-sm text-zinc-500">{emptyMessage}</div> : null}
      {renderError ? <div className="absolute inset-x-4 top-4 rounded-lg border border-red-900/70 bg-red-950/80 px-4 py-3 text-sm text-red-200">{renderErrorMessage}</div> : null}
    </div>
  );
}

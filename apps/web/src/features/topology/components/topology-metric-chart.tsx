'use client';

import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

use([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export interface MetricChartSeries {
  name: string;
  data: Array<[string, number | null]>;
}

export function TopologyMetricChart({
  series,
  valueSuffix,
  max,
}: {
  series: MetricChartSeries[];
  valueSuffix: string;
  max?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.setOption(
      {
        animation: false,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(24,24,27,0.96)',
          borderColor: '#3f3f46',
          textStyle: { color: '#e4e4e7', fontSize: 11 },
        },
        legend: {
          top: 0,
          type: 'scroll',
          textStyle: { color: '#a1a1aa', fontSize: 10 },
        },
        grid: {
          left: 48,
          right: 12,
          top: 32,
          bottom: 28,
        },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: '#3f3f46' } },
          axisLabel: { color: '#71717a', fontSize: 10 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#71717a',
            fontSize: 10,
            formatter: `{value}${valueSuffix}`,
          },
          splitLine: {
            lineStyle: { color: '#27272a', type: 'dashed' },
          },
        },
        series: series.map((item) => ({
          name: item.name,
          type: 'line',
          data: item.data,
          showSymbol: false,
          connectNulls: false,
          sampling: 'lttb',
          lineStyle: { width: 1.5 },
          emphasis: { focus: 'series' },
        })),
      },
      { notMerge: true, lazyUpdate: true },
    );
  }, [max, series, valueSuffix]);

  return <div ref={containerRef} className="h-44 w-full" />;
}

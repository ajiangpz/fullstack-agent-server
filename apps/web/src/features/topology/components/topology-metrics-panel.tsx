'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/use-translation';
import {
  useDeviceTopologyMetrics,
  useLinkTopologyMetrics,
} from '../hooks';
import type { TopologyMetricsRange } from '../types';
import { bitsPerSecondToMbps, hasMetricSeriesValues } from '../metrics';
import { TopologyMetricChart } from './topology-metric-chart';

const RANGES: TopologyMetricsRange[] = ['1h', '6h', '24h', '7d'];

export function DeviceTopologyMetricsPanel({
  siteId,
  deviceId,
}: {
  siteId: string;
  deviceId: number;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TopologyMetricsRange>('6h');
  const query = useDeviceTopologyMetrics(siteId, deviceId, range);
  const points = query.data?.points ?? [];

  const traffic = useMemo(
    () => [
      {
        name: t('topology.metrics.rx'),
        data: points.map(
          (point) =>
            [
              point.sampledAt,
              bitsPerSecondToMbps(point.rxBitsPerSecond),
            ] as [string, number | null],
        ),
      },
      {
        name: t('topology.metrics.tx'),
        data: points.map(
          (point) =>
            [
              point.sampledAt,
              bitsPerSecondToMbps(point.txBitsPerSecond),
            ] as [string, number | null],
        ),
      },
    ],
    [points, t],
  );

  const resources = useMemo(
    () => [
      {
        name: t('topology.metrics.cpu'),
        data: points.map(
          (point) =>
            [point.sampledAt, point.cpuPercent] as [string, number | null],
        ),
      },
      {
        name: t('topology.metrics.memory'),
        data: points.map(
          (point) =>
            [point.sampledAt, point.memoryPercent] as [
              string,
              number | null,
            ],
        ),
      },
    ],
    [points, t],
  );

  const latestTemperature = [...points]
    .reverse()
    .find((point) => point.temperatureCelsius !== null)?.temperatureCelsius;

  return (
    <MetricsSection range={range} onRangeChange={setRange}>
      <MetricQueryState
        loading={query.isLoading}
        error={query.isError}
        empty={points.length === 0}
      >
        {hasMetricSeriesValues(traffic) ? (
          <MetricBlock title={t('topology.metrics.traffic')}>
            <TopologyMetricChart
              series={traffic}
              valueSuffix=" Mbps"
            />
          </MetricBlock>
        ) : null}
        {hasMetricSeriesValues(resources) ? (
          <MetricBlock title={t('topology.metrics.resources')}>
            <TopologyMetricChart
              series={resources}
              valueSuffix="%"
              max={100}
            />
          </MetricBlock>
        ) : null}
        {latestTemperature !== undefined ? (
          <p className="text-xs text-zinc-500">
            {t('topology.metrics.temperature', {
              value: latestTemperature.toFixed(1),
            })}
          </p>
        ) : null}
        {!hasMetricSeriesValues(traffic) && !hasMetricSeriesValues(resources) ? (
          <p className="py-5 text-center text-xs text-zinc-600">
            {t('topology.metrics.empty')}
          </p>
        ) : null}
      </MetricQueryState>
    </MetricsSection>
  );
}

export function LinkTopologyMetricsPanel({
  siteId,
  linkId,
  sourceName,
  targetName,
}: {
  siteId: string;
  linkId: string;
  sourceName: string;
  targetName: string;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TopologyMetricsRange>('6h');
  const query = useLinkTopologyMetrics(siteId, linkId, range);
  const points = query.data?.points ?? [];

  const traffic = useMemo(
    () => [
      {
        name: `${sourceName} → ${targetName}`,
        data: points.map(
          (point) =>
            [
              point.sampledAt,
              bitsPerSecondToMbps(point.aToZBitsPerSecond),
            ] as [string, number | null],
        ),
      },
      {
        name: `${targetName} → ${sourceName}`,
        data: points.map(
          (point) =>
            [
              point.sampledAt,
              bitsPerSecondToMbps(point.zToABitsPerSecond),
            ] as [string, number | null],
        ),
      },
    ],
    [points, sourceName, targetName],
  );

  const health = useMemo(
    () => [
      {
        name: t('topology.metrics.utilization'),
        data: points.map(
          (point) =>
            [point.sampledAt, point.utilizationPercent] as [
              string,
              number | null,
            ],
        ),
      },
      {
        name: t('topology.metrics.errorRate'),
        data: points.map(
          (point) =>
            [point.sampledAt, point.errorRatePercent] as [
              string,
              number | null,
            ],
        ),
      },
      {
        name: t('topology.metrics.packetLoss'),
        data: points.map(
          (point) =>
            [point.sampledAt, point.packetLossPercent] as [
              string,
              number | null,
            ],
        ),
      },
    ],
    [points, t],
  );

  return (
    <MetricsSection range={range} onRangeChange={setRange}>
      <MetricQueryState
        loading={query.isLoading}
        error={query.isError}
        empty={points.length === 0}
      >
        {hasMetricSeriesValues(traffic) ? (
          <MetricBlock title={t('topology.metrics.traffic')}>
            <TopologyMetricChart
              series={traffic}
              valueSuffix=" Mbps"
            />
          </MetricBlock>
        ) : null}
        {hasMetricSeriesValues(health) ? (
          <MetricBlock title={t('topology.metrics.linkHealth')}>
            <TopologyMetricChart
              series={health}
              valueSuffix="%"
              max={100}
            />
          </MetricBlock>
        ) : null}
        {!hasMetricSeriesValues(traffic) && !hasMetricSeriesValues(health) ? (
          <p className="py-5 text-center text-xs text-zinc-600">
            {t('topology.metrics.empty')}
          </p>
        ) : null}
      </MetricQueryState>
    </MetricsSection>
  );
}

function MetricsSection({
  range,
  onRangeChange,
  children,
}: {
  range: TopologyMetricsRange;
  onRangeChange: (range: TopologyMetricsRange) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section className="border-t border-zinc-900 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {t('topology.metrics.title')}
        </p>
        <div className="flex rounded-md border border-zinc-800 bg-zinc-900/70 p-0.5">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded px-2 py-1 text-[10px] transition-colors ${
                range === item
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => onRangeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricQueryState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <p className="py-6 text-center text-xs text-zinc-600">
        {t('topology.metrics.loading')}
      </p>
    );
  }
  if (error) {
    return (
      <p className="py-6 text-center text-xs text-red-300">
        {t('topology.metrics.error')}
      </p>
    );
  }
  if (empty) {
    return (
      <p className="py-6 text-center text-xs text-zinc-600">
        {t('topology.metrics.empty')}
      </p>
    );
  }

  return <div className="space-y-4">{children}</div>;
}

function MetricBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">{title}</p>
      <div className="rounded-lg border border-zinc-900 bg-zinc-950/60 p-1">
        {children}
      </div>
    </div>
  );
}


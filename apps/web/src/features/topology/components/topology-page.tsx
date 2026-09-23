'use client';

import { Maximize2, Network, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import { useNetworkSites, useTopologySnapshot } from '../hooks';
import { toG6GraphData } from '../graph/topology-graph-data';
import { TopologyCanvas } from './topology-canvas';

export function TopologyPage() {
  const { t, intlLocale } = useTranslation();
  const sitesQuery = useNetworkSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState(0);

  useEffect(() => {
    const sites = sitesQuery.data ?? [];
    if (sites.length === 0) { setSelectedSiteId(null); return; }
    if (!selectedSiteId || !sites.some((site) => site.id === selectedSiteId)) setSelectedSiteId(sites[0].id);
  }, [selectedSiteId, sitesQuery.data]);

  const topologyQuery = useTopologySnapshot(selectedSiteId);
  const snapshot = topologyQuery.data;
  const graphData = useMemo(() => snapshot ? toG6GraphData(snapshot) : { nodes: [], edges: [] }, [snapshot]);

  if (sitesQuery.isLoading) return <WorkspaceState icon={<Network />} message={t('topology.loadingSites')} />;
  if (sitesQuery.isError) return <WorkspaceState icon={<Network />} message={t('topology.sitesError')} tone="error" />;

  const sites = sitesQuery.data ?? [];
  if (sites.length === 0) return <WorkspaceState icon={<Network />} message={t('topology.noSites')} />;

  const onlineCount = snapshot?.nodes.filter((node) => node.status === 'online').length ?? 0;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-cyan-400">{t('topology.section')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t('topology.title')}</h1>
          <p className="mt-2 text-sm text-zinc-500">{t('topology.description')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-zinc-500">
            {t('topology.site')}
            <select className="h-9 min-w-48 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-cyan-500" value={selectedSiteId ?? ''} onChange={(event) => setSelectedSiteId(event.target.value)}>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <Button variant="secondary" size="sm" disabled={!selectedSiteId || topologyQuery.isFetching} onClick={() => void topologyQuery.refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${topologyQuery.isFetching ? 'animate-spin' : ''}`} />
            {t('topology.refresh')}
          </Button>
          <Button variant="secondary" size="sm" disabled={!snapshot || snapshot.nodes.length === 0} onClick={() => setFitRequest((value) => value + 1)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            {t('topology.fit')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:max-w-xl">
        <Metric label={t('topology.devices')} value={snapshot?.nodes.length ?? 0} />
        <Metric label={t('topology.online')} value={onlineCount} />
        <Metric label={t('topology.links')} value={snapshot?.edges.length ?? 0} />
      </div>

      <Card className="relative min-h-0 flex-1 overflow-hidden p-2">
        {topologyQuery.isLoading || !snapshot ? (
          <div className="grid h-full min-h-[440px] place-items-center text-sm text-zinc-500">
            {topologyQuery.isError ? t('topology.loadError') : t('topology.loading')}
          </div>
        ) : (
          <TopologyCanvas data={graphData} fitRequest={fitRequest} empty={snapshot.nodes.length === 0} ariaLabel={t('topology.canvasAria')} emptyMessage={t('topology.empty')} renderErrorMessage={t('topology.renderError')} />
        )}
        {snapshot ? (
          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 text-[11px] text-zinc-500">
            <span className="rounded-md border border-zinc-800 bg-zinc-950/85 px-2 py-1">{t('topology.revision', { revision: snapshot.revision })}</span>
            <span className="rounded-md border border-zinc-800 bg-zinc-950/85 px-2 py-1">{t('topology.generatedAt', { time: formatSnapshotTime(snapshot.generatedAt, intlLocale) })}</span>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 text-lg font-semibold text-zinc-200">{value}</p></div>;
}

function WorkspaceState({ icon, message, tone = 'muted' }: { icon: React.ReactNode; message: string; tone?: 'muted' | 'error' }) {
  return <div className="grid h-full min-h-[480px] place-items-center"><div className={`flex max-w-md flex-col items-center gap-3 text-center text-sm ${tone === 'error' ? 'text-red-300' : 'text-zinc-500'}`}><div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-400">{icon}</div>{message}</div></div>;
}

function formatSnapshotTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

'use client';

import { Maximize2, Network, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/use-translation';
import { useNetworkSites, useTopologySnapshot } from '../hooks';
import { toG6GraphData } from '../graph/topology-graph-data';
import {
  buildTopologyHierarchy,
  computeTopologyVisibility,
  findTopologyNode,
  getTopologyAncestors,
} from '../graph/topology-view';
import type { DeviceType } from '../types';
import { useTopologyUiStore } from '../ui-store';
import { TopologyCanvas } from './topology-canvas';
import { TopologyDetailPanel } from './topology-detail-panel';

const DEVICE_TYPES: DeviceType[] = ['GATEWAY', 'ROUTER', 'SWITCH', 'ACCESS_POINT', 'CLIENT', 'SERVER', 'UNKNOWN'];

export function TopologyPage() {
  const { t, intlLocale } = useTranslation();
  const sitesQuery = useNetworkSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ id: string; token: number } | null>(null);
  const [searchMiss, setSearchMiss] = useState(false);

  const search = useTopologyUiStore((state) => state.search);
  const statusFilter = useTopologyUiStore((state) => state.statusFilter);
  const typeFilter = useTopologyUiStore((state) => state.typeFilter);
  const selected = useTopologyUiStore((state) => state.selected);
  const collapsed = useTopologyUiStore((state) => state.collapsed);
  const setSearch = useTopologyUiStore((state) => state.setSearch);
  const setStatusFilter = useTopologyUiStore((state) => state.setStatusFilter);
  const setTypeFilter = useTopologyUiStore((state) => state.setTypeFilter);
  const setSelected = useTopologyUiStore((state) => state.setSelected);
  const setCollapsed = useTopologyUiStore((state) => state.setCollapsed);
  const resetFilters = useTopologyUiStore((state) => state.resetFilters);
  const resetWorkspace = useTopologyUiStore((state) => state.resetWorkspace);

  useEffect(() => {
    const sites = sitesQuery.data ?? [];
    if (sites.length === 0) { setSelectedSiteId(null); return; }
    if (!selectedSiteId || !sites.some((site) => site.id === selectedSiteId)) setSelectedSiteId(sites[0].id);
  }, [selectedSiteId, sitesQuery.data]);

  useEffect(() => {
    resetWorkspace();
    setSearchMiss(false);
  }, [resetWorkspace, selectedSiteId]);

  const topologyQuery = useTopologySnapshot(selectedSiteId);
  const snapshot = topologyQuery.data;
  const hierarchy = useMemo(() => snapshot ? buildTopologyHierarchy(snapshot) : null, [snapshot]);
  const graphData = useMemo(() => snapshot && hierarchy ? toG6GraphData(snapshot, hierarchy) : { nodes: [], edges: [] }, [hierarchy, snapshot]);
  const visibility = useMemo(
    () => snapshot && hierarchy
      ? computeTopologyVisibility(snapshot, hierarchy, {
          status: statusFilter,
          type: typeFilter,
          collapsedNodeIds: Object.keys(collapsed),
        })
      : { visibleNodeIds: new Set<string>(), visibleEdgeIds: new Set<string>() },
    [collapsed, hierarchy, snapshot, statusFilter, typeFilter],
  );

  useEffect(() => {
    if (!selected) return;
    const visible = selected.kind === 'node'
      ? visibility.visibleNodeIds.has(selected.id)
      : visibility.visibleEdgeIds.has(selected.id);
    if (!visible) setSelected(null);
  }, [selected, setSelected, visibility]);

  if (sitesQuery.isLoading) return <WorkspaceState icon={<Network />} message={t('topology.loadingSites')} />;
  if (sitesQuery.isError) return <WorkspaceState icon={<Network />} message={t('topology.sitesError')} tone="error" />;

  const sites = sitesQuery.data ?? [];
  if (sites.length === 0) return <WorkspaceState icon={<Network />} message={t('topology.noSites')} />;

  const onlineCount = snapshot?.nodes.filter((node) => node.status === 'online').length ?? 0;

  function locateSearchResult(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot || !hierarchy) return;
    const node = findTopologyNode(snapshot, search);
    if (!node) { setSearchMiss(true); return; }
    setSearchMiss(false);
    resetFilters();
    for (const ancestor of getTopologyAncestors(node.id, hierarchy)) setCollapsed(ancestor, false);
    setSelected({ kind: 'node', id: node.id });
    setFocusRequest((current) => ({ id: node.id, token: (current?.token ?? 0) + 1 }));
  }

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

      <div className="grid gap-3 xl:grid-cols-[minmax(300px,1fr)_160px_190px_auto]">
        <form className="relative" onSubmit={locateSearchResult}>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
          <Input className="pl-9 pr-20" placeholder={t('topology.search')} value={search} onChange={(event) => { setSearch(event.target.value); setSearchMiss(false); }} />
          <button type="submit" className="absolute right-1 top-1 h-8 rounded-md px-3 text-xs font-medium text-cyan-300 hover:bg-zinc-800">{t('topology.searchAction')}</button>
          {searchMiss ? <p className="absolute left-0 top-11 z-20 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-200">{t('topology.searchNoMatch')}</p> : null}
        </form>
        <select className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'online' | 'offline')} aria-label={t('topology.statusFilter')}>
          <option value="all">{t('topology.allStatuses')}</option>
          <option value="online">{t('common.status.online')}</option>
          <option value="offline">{t('common.status.offline')}</option>
        </select>
        <select className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-500" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | DeviceType)} aria-label={t('topology.typeFilter')}>
          <option value="ALL">{t('topology.allTypes')}</option>
          {DEVICE_TYPES.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}
        </select>
        <Button variant="secondary" onClick={resetFilters}>{t('topology.resetFilters')}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 gap-3 md:max-w-xl md:flex-1">
          <Metric label={t('topology.devices')} value={snapshot?.nodes.length ?? 0} />
          <Metric label={t('topology.online')} value={onlineCount} />
          <Metric label={t('topology.links')} value={snapshot?.edges.length ?? 0} />
        </div>
        {snapshot ? <span className="text-xs text-zinc-600">{t('topology.visible', { count: visibility.visibleNodeIds.size })}</span> : null}
      </div>

      <Card className="relative min-h-0 flex-1 overflow-hidden p-2">
        {topologyQuery.isLoading || !snapshot || !hierarchy ? (
          <div className="grid h-full min-h-[440px] place-items-center text-sm text-zinc-500">{topologyQuery.isError ? t('topology.loadError') : t('topology.loading')}</div>
        ) : (
          <TopologyCanvas
            data={graphData}
            fitRequest={fitRequest}
            focusRequest={focusRequest}
            visibleNodeIds={visibility.visibleNodeIds}
            visibleEdgeIds={visibility.visibleEdgeIds}
            selected={selected}
            onSelectionChange={setSelected}
            empty={snapshot.nodes.length === 0}
            ariaLabel={t('topology.canvasAria')}
            emptyMessage={t('topology.empty')}
            renderErrorMessage={t('topology.renderError')}
          />
        )}
        {snapshot && hierarchy && selected ? (
          <TopologyDetailPanel snapshot={snapshot} hierarchy={hierarchy} selection={selected} collapsed={collapsed} onClose={() => setSelected(null)} onToggleCollapsed={setCollapsed} />
        ) : null}
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

function formatEnum(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

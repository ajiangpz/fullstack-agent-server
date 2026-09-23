'use client';

import { ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';
import { formatTopologySpeed } from '../graph/topology-graph-data';
import {
  getTopologyDescendants,
  type TopologyHierarchy,
} from '../graph/topology-view';
import type { TopologySnapshot } from '../types';
import type { TopologySelection } from '../ui-store';

export function TopologyDetailPanel({
  snapshot,
  hierarchy,
  selection,
  collapsed,
  onClose,
  onToggleCollapsed,
}: {
  snapshot: TopologySnapshot;
  hierarchy: TopologyHierarchy;
  selection: Exclude<TopologySelection, null>;
  collapsed: Record<string, true>;
  onClose: () => void;
  onToggleCollapsed: (nodeId: string, value: boolean) => void;
}) {
  const { t, intlLocale } = useTranslation();

  if (selection.kind === 'node') {
    const node = snapshot.nodes.find((item) => item.id === selection.id);
    if (!node) return null;
    const branchCount = getTopologyDescendants(node.id, hierarchy).length;
    const isCollapsed = Boolean(collapsed[node.id]);

    return (
      <Panel title={t('topology.details.device')} closeLabel={t('common.close')} onClose={onClose}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{node.name}</h2>
            <p className="mt-1 font-mono text-xs text-zinc-500">{node.ip}</p>
          </div>
          <div className="grid gap-3">
            <DetailRow label={t('topology.details.status')} value={node.status === 'online' ? t('common.status.online') : t('common.status.offline')} />
            <DetailRow label={t('topology.details.type')} value={formatEnum(node.type)} />
            <DetailRow label={t('topology.details.vendor')} value={node.vendor ?? '—'} />
            <DetailRow label={t('topology.details.model')} value={node.model ?? '—'} />
            <DetailRow label={t('topology.details.mac')} value={node.macAddress ?? '—'} />
            <DetailRow label={t('topology.details.ports')} value={String(node.portCount)} />
            <DetailRow label={t('topology.details.lastSeen')} value={formatDate(node.lastSeenAt, intlLocale, t('topology.details.unknown'))} />
          </div>
          {branchCount > 0 ? (
            <Button variant="secondary" className="w-full justify-between" onClick={() => onToggleCollapsed(node.id, !isCollapsed)}>
              <span className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isCollapsed ? t('topology.details.expandBranch') : t('topology.details.collapseBranch')}
              </span>
              <span className="text-xs text-zinc-500">{t('topology.details.branchCount', { count: branchCount })}</span>
            </Button>
          ) : null}
          <Link href={`/devices/${node.deviceId}`} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-cyan-300">
            <ExternalLink className="h-4 w-4" />
            {t('topology.details.openDevice')}
          </Link>
        </div>
      </Panel>
    );
  }

  const edge = snapshot.edges.find((item) => item.id === selection.id);
  if (!edge) return null;
  const direction = hierarchy.edgeDirection[edge.id] ?? { source: edge.source, target: edge.target };
  const source = snapshot.nodes.find((node) => node.id === direction.source);
  const target = snapshot.nodes.find((node) => node.id === direction.target);
  const sourcePort = direction.source === edge.source ? edge.sourcePort : edge.targetPort;
  const targetPort = direction.target === edge.target ? edge.targetPort : edge.sourcePort;

  return (
    <Panel title={t('topology.details.link')} closeLabel={t('common.close')} onClose={onClose}>
      <div className="grid gap-3">
        <DetailRow label={t('topology.details.source')} value={source?.name ?? direction.source} />
        <DetailRow label={t('topology.details.sourcePort')} value={sourcePort?.name ?? '—'} />
        <DetailRow label={t('topology.details.target')} value={target?.name ?? direction.target} />
        <DetailRow label={t('topology.details.targetPort')} value={targetPort?.name ?? '—'} />
        <DetailRow label={t('topology.details.status')} value={edge.status} />
        <DetailRow label={t('topology.details.linkType')} value={formatEnum(edge.linkType)} />
        <DetailRow label={t('topology.details.discovery')} value={edge.discoverySource} />
        <DetailRow label={t('topology.details.speed')} value={formatTopologySpeed(edge.speedMbps)} />
        <DetailRow label={t('topology.details.confidence')} value={`${Math.round(edge.confidence * 100)}%`} />
        <DetailRow label={t('topology.details.lastSeen')} value={formatDate(edge.lastSeenAt, intlLocale, t('topology.details.unknown'))} />
      </div>
    </Panel>
  );
}

function Panel({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="absolute inset-y-2 right-2 z-10 w-[min(360px,calc(100%-16px))] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">{title}</p>
        <Button variant="ghost" size="sm" aria-label={closeLabel} onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      {children}
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-zinc-900 pb-3 text-sm"><span className="text-zinc-600">{label}</span><span className="break-words text-right text-zinc-300">{value}</span></div>;
}

function formatEnum(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

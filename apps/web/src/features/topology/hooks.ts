'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  getDeviceTopologyMetrics,
  getLinkTopologyMetrics,
  getTopologySnapshot,
  getTopologyView,
  listNetworkSites,
  saveTopologyView,
} from './api';
import type {
  SaveTopologyViewPayload,
  TopologyMetricsRange,
  TopologySnapshot,
} from './types';
import { applyTopologyPatch } from './graph/topology-patch';
import {
  connectTopologyRealtime,
  type TopologyRealtimeStatus,
} from './realtime';

export function useNetworkSites() {
  return useQuery({
    queryKey: ['network-sites'],
    queryFn: listNetworkSites,
    staleTime: 30_000,
  });
}

export function useTopologySnapshot(siteId: string | null) {
  return useQuery({
    queryKey: ['topology', siteId],
    queryFn: () => getTopologySnapshot(siteId!),
    enabled: Boolean(siteId),
    staleTime: 10_000,
  });
}

export function useTopologyView(siteId: string | null) {
  return useQuery({
    queryKey: ['topology-view', siteId],
    queryFn: () => getTopologyView(siteId!),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });
}

export function useSaveTopologyView(siteId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveTopologyViewPayload) => {
      if (!siteId) throw new Error('A network site is required');
      return saveTopologyView(siteId, payload);
    },
    onSuccess: (view) => {
      queryClient.setQueryData(['topology-view', siteId], view);
    },
  });
}

export function useTopologyRealtime(
  siteId: string | null,
  snapshot: TopologySnapshot | undefined,
) {
  const queryClient = useQueryClient();
  const revisionRef = useRef(snapshot?.revision ?? 0);
  const [status, setStatus] = useState<TopologyRealtimeStatus>('connecting');

  useEffect(() => {
    revisionRef.current = snapshot?.revision ?? 0;
  }, [snapshot?.revision]);

  const snapshotReady = Boolean(snapshot);

  useEffect(() => {
    if (!siteId || !snapshotReady) return;

    const queryKey = ['topology', siteId] as const;
    const resync = () => {
      void queryClient.refetchQueries({ queryKey, exact: true, type: 'active' });
    };

    return connectTopologyRealtime({
      siteId,
      getRevision: () => revisionRef.current,
      onStatus: (nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus === 'fallback') resync();
      },
      onResync: resync,
      onPatch: (event) => {
        const current = queryClient.getQueryData<TopologySnapshot>(queryKey);
        if (!current) {
          resync();
          return;
        }

        const applied = applyTopologyPatch(current, event);
        if (!applied) {
          resync();
          return;
        }

        revisionRef.current = applied.snapshot.revision;
        queryClient.setQueryData(queryKey, applied.snapshot);
      },
    });
  }, [queryClient, siteId, snapshotReady]);

  useEffect(() => {
    if (!siteId || status === 'connecting') return;

    const intervalMs = status === 'fallback' ? 15_000 : 60_000;
    const timer = window.setInterval(() => {
      void queryClient.refetchQueries({
        queryKey: ['topology', siteId],
        exact: true,
        type: 'active',
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [queryClient, siteId, status]);

  return { status };
}

export function useDeviceTopologyMetrics(
  siteId: string,
  deviceId: number,
  range: TopologyMetricsRange,
) {
  return useQuery({
    queryKey: ['topology-metrics', siteId, 'device', deviceId, range],
    queryFn: () => getDeviceTopologyMetrics(siteId, deviceId, range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLinkTopologyMetrics(
  siteId: string,
  linkId: string,
  range: TopologyMetricsRange,
) {
  return useQuery({
    queryKey: ['topology-metrics', siteId, 'link', linkId, range],
    queryFn: () => getLinkTopologyMetrics(siteId, linkId, range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

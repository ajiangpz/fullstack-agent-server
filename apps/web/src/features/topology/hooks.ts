'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTopologySnapshot,
  getTopologyView,
  listNetworkSites,
  saveTopologyView,
} from './api';
import type { SaveTopologyViewPayload } from './types';

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

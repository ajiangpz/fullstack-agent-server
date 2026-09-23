'use client';

import { useQuery } from '@tanstack/react-query';
import { getTopologySnapshot, listNetworkSites } from './api';

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

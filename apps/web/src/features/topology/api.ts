import { apiRequest } from '@/lib/api-client';
import type { NetworkSiteSummary, TopologySnapshot } from './types';

export function listNetworkSites() {
  return apiRequest<NetworkSiteSummary[]>('/sites');
}

export function getTopologySnapshot(siteId: string) {
  return apiRequest<TopologySnapshot>(
    `/sites/${encodeURIComponent(siteId)}/topology`,
  );
}

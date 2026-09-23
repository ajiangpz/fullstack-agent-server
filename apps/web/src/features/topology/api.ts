import { apiRequest } from '@/lib/api-client';
import type {
  NetworkSiteSummary,
  SaveTopologyViewPayload,
  TopologySnapshot,
  TopologyView,
} from './types';

export function listNetworkSites() {
  return apiRequest<NetworkSiteSummary[]>('/sites');
}

export function getTopologySnapshot(siteId: string) {
  return apiRequest<TopologySnapshot>(
    `/sites/${encodeURIComponent(siteId)}/topology`,
  );
}

export function getTopologyView(siteId: string) {
  return apiRequest<TopologyView>(
    `/sites/${encodeURIComponent(siteId)}/topology/view`,
  );
}

export function saveTopologyView(
  siteId: string,
  payload: SaveTopologyViewPayload,
) {
  return apiRequest<TopologyView>(
    `/sites/${encodeURIComponent(siteId)}/topology/view`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

import { apiRequest } from '@/lib/api-client';
import type {
  DeviceMetricsSeries,
  NetworkSiteSummary,
  SaveTopologyViewPayload,
  TopologyLinkMetricsSeries,
  TopologyMetricsRange,
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

export function getDeviceTopologyMetrics(
  siteId: string,
  deviceId: number,
  range: TopologyMetricsRange,
) {
  const params = new URLSearchParams({ range, points: '180' });
  return apiRequest<DeviceMetricsSeries>(
    `/sites/${encodeURIComponent(siteId)}/topology/metrics/devices/${deviceId}?${params.toString()}`,
  );
}

export function getLinkTopologyMetrics(
  siteId: string,
  linkId: string,
  range: TopologyMetricsRange,
) {
  const params = new URLSearchParams({ range, points: '180' });
  return apiRequest<TopologyLinkMetricsSeries>(
    `/sites/${encodeURIComponent(siteId)}/topology/metrics/links/${encodeURIComponent(linkId)}?${params.toString()}`,
  );
}

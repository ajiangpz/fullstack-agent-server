export type DeviceStatus = 'online' | 'offline';

export type DeviceType =
  | 'GATEWAY'
  | 'ROUTER'
  | 'SWITCH'
  | 'ACCESS_POINT'
  | 'CLIENT'
  | 'SERVER'
  | 'UNKNOWN';

export type TopologyLinkType = 'ETHERNET' | 'WIRELESS' | 'VPN' | 'UNKNOWN';
export type TopologyLinkStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
export type DiscoverySource = 'MANUAL' | 'SNMP' | 'LLDP' | 'CDP';

export interface NetworkSiteSummary {
  id: string;
  name: string;
  ownerId: number;
  topologyRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopologyNode {
  id: string;
  deviceId: number;
  name: string;
  ip: string;
  status: DeviceStatus;
  type: DeviceType;
  portCount: number;
  vendor: string | null;
  model: string | null;
  macAddress: string | null;
  lastSeenAt: string | null;
}

export interface TopologyEdgePort {
  id: number;
  name: string;
  ifIndex: number | null;
}

export interface TopologyEdge {
  id: string;
  linkId: string;
  source: string;
  target: string;
  sourcePort: TopologyEdgePort | null;
  targetPort: TopologyEdgePort | null;
  linkType: TopologyLinkType;
  status: TopologyLinkStatus;
  discoverySource: DiscoverySource;
  speedMbps: number | null;
  confidence: number;
  lastSeenAt: string;
}

export interface TopologySnapshot {
  schemaVersion: 1;
  site: { id: string; name: string };
  revision: number;
  generatedAt: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologyViewNodePosition {
  nodeId: string;
  x: number;
  y: number;
}

export interface TopologyViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TopologyView {
  schemaVersion: 1;
  siteId: string;
  viewId: string | null;
  revision: number;
  topologyRevision: number | null;
  viewport: TopologyViewport | null;
  nodes: TopologyViewNodePosition[];
  updatedAt: string | null;
}

export interface SaveTopologyViewPayload {
  expectedRevision: number;
  topologyRevision: number;
  viewport: TopologyViewport;
  nodes: TopologyViewNodePosition[];
}

export interface TopologyLayoutCapture {
  viewport: TopologyViewport;
  nodes: TopologyViewNodePosition[];
}

export interface TopologyPatchChanges {
  nodes: {
    upsert: TopologyNode[];
    remove: string[];
  };
  edges: {
    upsert: TopologyEdge[];
    remove: string[];
  };
}

export interface TopologyPatchEvent {
  schemaVersion: 1;
  type: 'patch';
  siteId: string;
  baseRevision: number;
  revision: number;
  changes: TopologyPatchChanges;
  emittedAt: string;
}

export interface TopologyResyncEvent {
  schemaVersion: 1;
  type: 'resync';
  siteId: string;
  revision: number;
  reason:
    | 'snapshot-miss'
    | 'revision-gap'
    | 'revision-mismatch'
    | 'concurrent-change';
  emittedAt: string;
}

export interface AppliedTopologyPatch {
  snapshot: TopologySnapshot;
  structural: boolean;
}

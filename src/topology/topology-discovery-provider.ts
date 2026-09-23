import type {
  DiscoverySource,
  TopologyLinkStatus,
  TopologyLinkType,
} from '../generated/prisma/enums';

export interface DiscoveryProviderObservation {
  localDeviceId: number;
  localPortId?: number | null;
  localPortName?: string | null;
  localPortIfIndex?: number | null;
  remoteDeviceId?: number | null;
  remotePortId?: number | null;
  remoteManagementIp?: string | null;
  remoteMacAddress?: string | null;
  remoteChassisId?: string | null;
  remotePortName?: string | null;
  remotePortIfIndex?: number | null;
  linkType: TopologyLinkType;
  status: TopologyLinkStatus;
  speedMbps?: number | null;
  confidence: number;
  observedAt: Date;
  ttlSeconds?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface TopologyDiscoveryProviderContext {
  runId: string;
  siteId: string;
  requestPayload: unknown;
}

export interface TopologyDiscoveryProvider {
  readonly source: DiscoverySource;
  discover(
    context: TopologyDiscoveryProviderContext,
  ): Promise<DiscoveryProviderObservation[]>;
}

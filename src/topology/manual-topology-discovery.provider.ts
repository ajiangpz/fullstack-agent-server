import { Injectable } from '@nestjs/common';
import {
  DiscoverySource,
  TopologyLinkStatus,
  TopologyLinkType,
} from '../generated/prisma/enums';
import type {
  DiscoveryProviderObservation,
  TopologyDiscoveryProvider,
  TopologyDiscoveryProviderContext,
} from './topology-discovery-provider';

interface ManualRequestPayload {
  observations?: Array<{
    localDeviceId?: unknown;
    localPortId?: unknown;
    remoteDeviceId?: unknown;
    remotePortId?: unknown;
    linkType?: unknown;
    status?: unknown;
    speedMbps?: unknown;
    confidence?: unknown;
  }>;
}

@Injectable()
export class ManualTopologyDiscoveryProvider
  implements TopologyDiscoveryProvider
{
  readonly source = DiscoverySource.MANUAL;

  async discover(
    context: TopologyDiscoveryProviderContext,
  ): Promise<DiscoveryProviderObservation[]> {
    const payload = context.requestPayload as ManualRequestPayload | null;
    if (!payload || !Array.isArray(payload.observations)) {
      throw new Error('Manual discovery payload is missing observations');
    }

    return payload.observations.map((item) => ({
      localDeviceId: this.positiveInteger(item.localDeviceId, 'localDeviceId'),
      localPortId: this.optionalPositiveInteger(item.localPortId, 'localPortId'),
      remoteDeviceId: this.positiveInteger(
        item.remoteDeviceId,
        'remoteDeviceId',
      ),
      remotePortId: this.optionalPositiveInteger(
        item.remotePortId,
        'remotePortId',
      ),
      linkType: this.enumValue(
        item.linkType,
        Object.values(TopologyLinkType),
        TopologyLinkType.ETHERNET,
        'linkType',
      ),
      status: this.enumValue(
        item.status,
        Object.values(TopologyLinkStatus),
        TopologyLinkStatus.UP,
        'status',
      ),
      speedMbps: this.optionalNonnegativeInteger(
        item.speedMbps,
        'speedMbps',
      ),
      confidence: this.confidence(item.confidence),
      observedAt: new Date(),
      ttlSeconds: null,
      metadata: null,
    }));
  }

  private positiveInteger(value: unknown, field: string): number {
    if (!Number.isInteger(value) || (value as number) <= 0) {
      throw new Error('Invalid manual discovery ' + field);
    }
    return value as number;
  }

  private optionalPositiveInteger(
    value: unknown,
    field: string,
  ): number | null {
    if (value === undefined || value === null) return null;
    return this.positiveInteger(value, field);
  }

  private optionalNonnegativeInteger(
    value: unknown,
    field: string,
  ): number | null {
    if (value === undefined || value === null) return null;
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw new Error('Invalid manual discovery ' + field);
    }
    return value as number;
  }

  private confidence(value: unknown): number {
    if (value === undefined || value === null) return 1;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error('Invalid manual discovery confidence');
    }
    return value;
  }

  private enumValue<T extends string>(
    value: unknown,
    values: readonly T[],
    fallback: T,
    field: string,
  ): T {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string' || !values.includes(value as T)) {
      throw new Error('Invalid manual discovery ' + field);
    }
    return value as T;
  }
}

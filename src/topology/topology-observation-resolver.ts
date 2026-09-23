import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { Prisma } from '../generated/prisma/client';
import { DiscoverySource } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { canonicalizeTopologyLink } from './topology-link-key';
import type { DiscoveryProviderObservation } from './topology-discovery-provider';

const DEFAULT_DISCOVERY_TTL_SECONDS = 180;
const MIN_DISCOVERY_TTL_SECONDS = 30;
const MAX_DISCOVERY_TTL_SECONDS = 3_600;

export type PersistableTopologyObservation =
  Prisma.TopologyObservationCreateManyInput;

@Injectable()
export class TopologyObservationResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    runId: string,
    siteId: string,
    source: DiscoverySource,
    observations: DiscoveryProviderObservation[],
  ): Promise<PersistableTopologyObservation[]> {
    const devices = await this.prisma.device.findMany({
      where: { siteId },
      select: {
        id: true,
        ip: true,
        macAddress: true,
        ports: {
          select: {
            id: true,
            name: true,
            ifIndex: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const devicesById = new Map(devices.map((device) => [device.id, device]));
    const devicesByIp = new Map(
      devices.map((device) => [String(device.ip), device]),
    );
    const devicesByMac = new Map(
      devices
        .filter((device) => device.macAddress)
        .map((device) => [
          this.normalizeMac(device.macAddress!),
          device,
        ]),
    );

    return observations.map((observation) => {
      const errors: string[] = [];
      const localDevice = devicesById.get(observation.localDeviceId);
      if (!localDevice) errors.push('Local device is not in this site');

      const remoteIp = this.validIp(observation.remoteManagementIp);
      const remoteMac = this.validMac(observation.remoteMacAddress);
      let remoteDevice = observation.remoteDeviceId
        ? devicesById.get(observation.remoteDeviceId)
        : undefined;

      if (!remoteDevice && remoteIp) remoteDevice = devicesByIp.get(remoteIp);
      if (!remoteDevice && remoteMac) {
        remoteDevice = devicesByMac.get(remoteMac);
      }

      if (!remoteDevice) errors.push('Remote device could not be resolved');
      if (localDevice && remoteDevice && localDevice.id === remoteDevice.id) {
        errors.push('Topology observation resolves to the same device');
      }

      const localPort = localDevice
        ? this.resolvePort(
            localDevice.ports,
            observation.localPortId,
            observation.localPortName,
            observation.localPortIfIndex,
            'local',
            errors,
          )
        : null;
      const remotePort = remoteDevice
        ? this.resolvePort(
            remoteDevice.ports,
            observation.remotePortId,
            observation.remotePortName,
            observation.remotePortIfIndex,
            'remote',
            errors,
          )
        : null;

      let aDeviceId: number | null = null;
      let aPortId: number | null = null;
      let zDeviceId: number | null = null;
      let zPortId: number | null = null;
      let canonicalKey: string | null = null;

      if (errors.length === 0 && localDevice && remoteDevice) {
        const canonical = canonicalizeTopologyLink(
          { deviceId: localDevice.id, portId: localPort?.id ?? null },
          { deviceId: remoteDevice.id, portId: remotePort?.id ?? null },
        );
        aDeviceId = canonical.a.deviceId;
        aPortId = canonical.a.portId ?? null;
        zDeviceId = canonical.z.deviceId;
        zPortId = canonical.z.portId ?? null;
        canonicalKey = canonical.canonicalKey;
      }

      return {
        runId,
        source,
        localDeviceId: observation.localDeviceId,
        localPortId: localPort?.id ?? observation.localPortId ?? null,
        localPortName: observation.localPortName ?? null,
        localPortIfIndex: observation.localPortIfIndex ?? null,
        remoteDeviceId:
          remoteDevice?.id ?? observation.remoteDeviceId ?? null,
        remotePortId: remotePort?.id ?? observation.remotePortId ?? null,
        remoteManagementIp: remoteIp,
        remoteMacAddress: remoteMac,
        remoteChassisId: observation.remoteChassisId ?? null,
        remotePortName: observation.remotePortName ?? null,
        remotePortIfIndex: observation.remotePortIfIndex ?? null,
        aDeviceId,
        aPortId,
        zDeviceId,
        zPortId,
        canonicalKey,
        linkType: observation.linkType,
        linkStatus: observation.status,
        speedMbps: observation.speedMbps ?? null,
        confidence: observation.confidence,
        observedAt: observation.observedAt,
        expiresAt: this.expiresAt(source, observation),
        resolutionError:
          errors.length > 0 ? errors.join('; ').slice(0, 500) : null,
        metadata: observation.metadata
          ? (observation.metadata as Prisma.InputJsonValue)
          : undefined,
      };
    });
  }

  private resolvePort(
    ports: Array<{ id: number; name: string; ifIndex: number | null }>,
    portId: number | null | undefined,
    portName: string | null | undefined,
    ifIndex: number | null | undefined,
    side: 'local' | 'remote',
    errors: string[],
  ) {
    if (
      portId === null ||
      portId === undefined
    ) {
      if (ifIndex !== null && ifIndex !== undefined) {
        const port = ports.find((candidate) => candidate.ifIndex === ifIndex);
        if (!port) errors.push('Unknown ' + side + ' port ifIndex');
        return port ?? null;
      }
      if (portName) {
        const port = ports.find((candidate) => candidate.name === portName);
        if (!port) errors.push('Unknown ' + side + ' port name');
        return port ?? null;
      }
      return null;
    }

    const port = ports.find((candidate) => candidate.id === portId);
    if (!port) errors.push('Unknown ' + side + ' port id');
    return port ?? null;
  }

  private expiresAt(
    source: DiscoverySource,
    observation: DiscoveryProviderObservation,
  ): Date | null {
    if (source === DiscoverySource.MANUAL) return null;

    const requestedTtl = observation.ttlSeconds;
    const normalizedTtl =
      typeof requestedTtl === 'number' && Number.isFinite(requestedTtl)
        ? Math.floor(requestedTtl)
        : DEFAULT_DISCOVERY_TTL_SECONDS;
    const ttl = Math.min(
      MAX_DISCOVERY_TTL_SECONDS,
      Math.max(MIN_DISCOVERY_TTL_SECONDS, normalizedTtl),
    );
    return new Date(observation.observedAt.getTime() + ttl * 1000);
  }

  private validIp(value: string | null | undefined): string | null {
    if (!value) return null;
    return isIP(value) ? value : null;
  }

  private validMac(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = this.normalizeMac(value);
    return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(normalized)
      ? normalized
      : null;
  }

  private normalizeMac(value: string): string {
    return value.trim().toLowerCase().replaceAll('-', ':');
  }
}

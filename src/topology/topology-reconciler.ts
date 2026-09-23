import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { DiscoverySource } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TopologyRealtimeCoordinator } from './topology-realtime.coordinator';

interface ReconcileResult {
  reconciledLinkCount: number;
  revisionChanged: boolean;
  revision: number;
}

@Injectable()
export class TopologyReconciler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: TopologyRealtimeCoordinator,
  ) {}

  async reconcile(runId: string): Promise<ReconcileResult> {
    let attempt = 0;
    while (true) {
      try {
        const result = await this.prisma.$transaction(
          (tx) => this.reconcileInTransaction(tx, runId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        if (result.revisionChanged) {
          void this.realtime.recordSiteChange(
            result.siteId,
            result.revision - 1,
            result.revision,
          );
        }

        return {
          reconciledLinkCount: result.reconciledLinkCount,
          revisionChanged: result.revisionChanged,
          revision: result.revision,
        };
      } catch (error) {
        attempt += 1;
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async reconcileInTransaction(
    tx: Prisma.TransactionClient,
    runId: string,
  ) {
    const run = await tx.discoveryRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        siteId: true,
        source: true,
        status: true,
        observations: {
          where: {
            canonicalKey: { not: null },
            resolutionError: null,
            aDeviceId: { not: null },
            zDeviceId: { not: null },
          },
          select: {
            id: true,
            source: true,
            aDeviceId: true,
            aPortId: true,
            zDeviceId: true,
            zPortId: true,
            canonicalKey: true,
            linkType: true,
            linkStatus: true,
            speedMbps: true,
            confidence: true,
            observedAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!run) throw new NotFoundException('Discovery run ' + runId + ' not found');
    if (run.status === 'COMPLETED') {
      const site = await tx.networkSite.findUniqueOrThrow({
        where: { id: run.siteId },
        select: { topologyRevision: true },
      });
      return {
        siteId: run.siteId,
        reconciledLinkCount: 0,
        revisionChanged: false,
        revision: site.topologyRevision,
      };
    }
    if (run.status !== 'RECONCILING') {
      throw new Error(
        'Discovery run ' + runId + ' is not ready for reconciliation',
      );
    }

    const candidates = await this.filterCurrentCandidates(
      tx,
      run.siteId,
      this.bestCandidates(run.observations),
    );
    const existingLinks = await tx.topologyLink.findMany({
      where: { siteId: run.siteId },
      select: {
        id: true,
        canonicalKey: true,
        discoverySource: true,
        expiresAt: true,
      },
    });
    const existingByKey = new Map(
      existingLinks.map((link) => [link.canonicalKey, link]),
    );
    const candidateKeys = new Set(candidates.keys());
    const now = new Date();
    const expiredIds = existingLinks
      .filter(
        (link) =>
          link.expiresAt !== null &&
          link.expiresAt <= now &&
          !candidateKeys.has(link.canonicalKey),
      )
      .map((link) => link.id);

    if (expiredIds.length > 0) {
      await tx.topologyLink.deleteMany({
        where: { id: { in: expiredIds } },
      });
    }

    let reconciledLinkCount = 0;
    for (const [canonicalKey, observation] of candidates) {
      const existing = existingByKey.get(canonicalKey);
      if (
        existing?.discoverySource === DiscoverySource.MANUAL &&
        run.source !== DiscoverySource.MANUAL
      ) {
        continue;
      }

      await tx.topologyLink.upsert({
        where: { canonicalKey },
        create: {
          siteId: run.siteId,
          aDeviceId: observation.aDeviceId!,
          aPortId: observation.aPortId,
          zDeviceId: observation.zDeviceId!,
          zPortId: observation.zPortId,
          canonicalKey,
          linkType: observation.linkType,
          discoverySource: observation.source,
          status: observation.linkStatus,
          speedMbps: observation.speedMbps,
          confidence: observation.confidence,
          firstSeenAt: observation.observedAt,
          lastSeenAt: observation.observedAt,
          expiresAt: observation.expiresAt,
          metadata: { lastDiscoveryRunId: run.id },
        },
        update: {
          aDeviceId: observation.aDeviceId!,
          aPortId: observation.aPortId,
          zDeviceId: observation.zDeviceId!,
          zPortId: observation.zPortId,
          linkType: observation.linkType,
          discoverySource: observation.source,
          status: observation.linkStatus,
          speedMbps: observation.speedMbps,
          confidence: observation.confidence,
          lastSeenAt: observation.observedAt,
          expiresAt: observation.expiresAt,
          metadata: { lastDiscoveryRunId: run.id },
        },
      });
      reconciledLinkCount += 1;
    }

    const changed = expiredIds.length > 0 || reconciledLinkCount > 0;
    const site = changed
      ? await tx.networkSite.update({
          where: { id: run.siteId },
          data: { topologyRevision: { increment: 1 } },
          select: { topologyRevision: true },
        })
      : await tx.networkSite.findUniqueOrThrow({
          where: { id: run.siteId },
          select: { topologyRevision: true },
        });

    await tx.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        reconciledLinkCount,
        errorMessage: null,
        completedAt: new Date(),
      },
    });

    return {
      siteId: run.siteId,
      reconciledLinkCount,
      revisionChanged: changed,
      revision: site.topologyRevision,
    };
  }

  private async filterCurrentCandidates<
    T extends {
      aDeviceId: number | null;
      aPortId: number | null;
      zDeviceId: number | null;
      zPortId: number | null;
    },
  >(
    tx: Prisma.TransactionClient,
    siteId: string,
    candidates: Map<string, T>,
  ): Promise<Map<string, T>> {
    const deviceIds = new Set<number>();
    const portIds = new Set<number>();

    for (const observation of candidates.values()) {
      if (observation.aDeviceId !== null) deviceIds.add(observation.aDeviceId);
      if (observation.zDeviceId !== null) deviceIds.add(observation.zDeviceId);
      if (observation.aPortId !== null) portIds.add(observation.aPortId);
      if (observation.zPortId !== null) portIds.add(observation.zPortId);
    }

    const [devices, ports] = await Promise.all([
      tx.device.findMany({
        where: { siteId, id: { in: [...deviceIds] } },
        select: { id: true },
      }),
      portIds.size > 0
        ? tx.devicePort.findMany({
            where: { id: { in: [...portIds] } },
            select: { id: true, deviceId: true },
          })
        : Promise.resolve([]),
    ]);

    const currentDeviceIds = new Set(devices.map((device) => device.id));
    const currentPorts = new Map(
      ports.map((port) => [port.id, port.deviceId]),
    );
    const result = new Map<string, T>();

    for (const [key, observation] of candidates) {
      if (
        observation.aDeviceId === null ||
        observation.zDeviceId === null ||
        !currentDeviceIds.has(observation.aDeviceId) ||
        !currentDeviceIds.has(observation.zDeviceId)
      ) {
        continue;
      }

      if (
        observation.aPortId !== null &&
        currentPorts.get(observation.aPortId) !== observation.aDeviceId
      ) {
        continue;
      }
      if (
        observation.zPortId !== null &&
        currentPorts.get(observation.zPortId) !== observation.zDeviceId
      ) {
        continue;
      }

      result.set(key, observation);
    }

    return result;
  }

  private bestCandidates<T extends {
    canonicalKey: string | null;
    confidence: number;
    observedAt: Date;
  }>(observations: T[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const observation of observations) {
      if (!observation.canonicalKey) continue;
      const current = result.get(observation.canonicalKey);
      if (
        !current ||
        observation.confidence > current.confidence ||
        (observation.confidence === current.confidence &&
          observation.observedAt > current.observedAt)
      ) {
        result.set(observation.canonicalKey, observation);
      }
    }

    return result;
  }
}

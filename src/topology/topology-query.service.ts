import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  NetworkSiteSummaryDto,
  TopologyEdgeDto,
  TopologyNodeDto,
  TopologySnapshotDto,
} from './dto/topology.dto';

@Injectable()
export class TopologyQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listSites(
    user: AuthenticatedUser,
  ): Promise<NetworkSiteSummaryDto[]> {
    return this.prisma.networkSite.findMany({
      where: this.getSiteOwnershipFilter(user),
      select: {
        id: true,
        name: true,
        ownerId: true,
        topologyRevision: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async getTopology(
    siteId: string,
    user: AuthenticatedUser,
  ): Promise<TopologySnapshotDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const site = await tx.networkSite.findFirst({
          where: {
            id: siteId,
            ...this.getSiteOwnershipFilter(user),
          },
          select: {
            id: true,
            name: true,
            topologyRevision: true,
          },
        });

        if (!site) {
          throw new NotFoundException('Network site ' + siteId + ' not found');
        }

        const devices = await tx.device.findMany({
          where: { siteId },
          select: {
            id: true,
            name: true,
            ip: true,
            status: true,
            type: true,
            portCount: true,
            vendor: true,
            model: true,
            macAddress: true,
            lastSeenAt: true,
          },
          orderBy: { id: 'asc' },
        });

        const links = await tx.topologyLink.findMany({
          where: { siteId },
          select: {
            id: true,
            aDeviceId: true,
            zDeviceId: true,
            linkType: true,
            status: true,
            discoverySource: true,
            speedMbps: true,
            confidence: true,
            lastSeenAt: true,
            aPort: {
              select: {
                id: true,
                name: true,
                ifIndex: true,
              },
            },
            zPort: {
              select: {
                id: true,
                name: true,
                ifIndex: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        });

        return {
          schemaVersion: 1,
          site: {
            id: site.id,
            name: site.name,
          },
          revision: site.topologyRevision,
          generatedAt: new Date(),
          nodes: devices.map((device) => this.toNode(device)),
          edges: links.map((link) => this.toEdge(link)),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  private getSiteOwnershipFilter(
    user: AuthenticatedUser,
  ): Pick<Prisma.NetworkSiteWhereInput, 'ownerId'> {
    return user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
  }

  private toNode(device: {
    id: number;
    name: string;
    ip: string;
    status: TopologyNodeDto['status'];
    type: TopologyNodeDto['type'];
    portCount: number;
    vendor: string | null;
    model: string | null;
    macAddress: string | null;
    lastSeenAt: Date | null;
  }): TopologyNodeDto {
    return {
      id: 'device:' + device.id,
      deviceId: device.id,
      name: device.name,
      ip: device.ip,
      status: device.status,
      type: device.type,
      portCount: device.portCount,
      vendor: device.vendor,
      model: device.model,
      macAddress: device.macAddress,
      lastSeenAt: device.lastSeenAt,
    };
  }

  private toEdge(link: {
    id: string;
    aDeviceId: number;
    zDeviceId: number;
    linkType: TopologyEdgeDto['linkType'];
    status: TopologyEdgeDto['status'];
    discoverySource: TopologyEdgeDto['discoverySource'];
    speedMbps: number | null;
    confidence: number;
    lastSeenAt: Date;
    aPort: { id: number; name: string; ifIndex: number | null } | null;
    zPort: { id: number; name: string; ifIndex: number | null } | null;
  }): TopologyEdgeDto {
    return {
      id: 'link:' + link.id,
      linkId: link.id,
      source: 'device:' + link.aDeviceId,
      target: 'device:' + link.zDeviceId,
      sourcePort: link.aPort,
      targetPort: link.zPort,
      linkType: link.linkType,
      status: link.status,
      discoverySource: link.discoverySource,
      speedMbps: link.speedMbps,
      confidence: link.confidence,
      lastSeenAt: link.lastSeenAt,
    };
  }
}

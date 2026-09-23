import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveTopologyViewDto,
  TopologyViewDto,
} from './dto/topology-view.dto';

@Injectable()
export class TopologyViewService {
  constructor(private readonly prisma: PrismaService) {}

  async getView(
    siteId: string,
    user: AuthenticatedUser,
  ): Promise<TopologyViewDto> {
    await this.requireAccessibleSite(this.prisma, siteId, user);

    const view = await this.prisma.topologyView.findUnique({
      where: {
        siteId_ownerId: {
          siteId,
          ownerId: user.id,
        },
      },
      select: {
        id: true,
        revision: true,
        topologyRevision: true,
        viewportX: true,
        viewportY: true,
        zoom: true,
        updatedAt: true,
        nodes: {
          select: { nodeId: true, x: true, y: true },
          orderBy: { nodeId: 'asc' },
        },
      },
    });

    return view ? this.toDto(siteId, view) : this.emptyView(siteId);
  }

  async saveView(
    siteId: string,
    dto: SaveTopologyViewDto,
    user: AuthenticatedUser,
  ): Promise<TopologyViewDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.requireAccessibleSite(tx, siteId, user);
        await this.validateNodeSet(tx, siteId, dto);

        const existing = await tx.topologyView.findUnique({
          where: {
            siteId_ownerId: {
              siteId,
              ownerId: user.id,
            },
          },
          select: { id: true, revision: true },
        });

        let viewId: string;
        if (!existing) {
          if (dto.expectedRevision !== 0) {
            throw new ConflictException(
              'Topology view changed; reload before saving',
            );
          }

          const created = await tx.topologyView.create({
            data: {
              siteId,
              ownerId: user.id,
              revision: 1,
              topologyRevision: dto.topologyRevision,
              viewportX: dto.viewport.x,
              viewportY: dto.viewport.y,
              zoom: dto.viewport.zoom,
            },
            select: { id: true },
          });
          viewId = created.id;
        } else {
          const updated = await tx.topologyView.updateMany({
            where: {
              id: existing.id,
              revision: dto.expectedRevision,
            },
            data: {
              revision: { increment: 1 },
              topologyRevision: dto.topologyRevision,
              viewportX: dto.viewport.x,
              viewportY: dto.viewport.y,
              zoom: dto.viewport.zoom,
            },
          });

          if (updated.count !== 1) {
            throw new ConflictException(
              'Topology view changed; reload before saving',
            );
          }
          viewId = existing.id;
        }

        await tx.topologyViewNode.deleteMany({ where: { viewId } });
        if (dto.nodes.length > 0) {
          await tx.topologyViewNode.createMany({
            data: dto.nodes.map((node) => ({ viewId, ...node })),
          });
        }

        const saved = await tx.topologyView.findUniqueOrThrow({
          where: { id: viewId },
          select: {
            id: true,
            revision: true,
            topologyRevision: true,
            viewportX: true,
            viewportY: true,
            zoom: true,
            updatedAt: true,
            nodes: {
              select: { nodeId: true, x: true, y: true },
              orderBy: { nodeId: 'asc' },
            },
          },
        });

        return this.toDto(siteId, saved);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Topology view changed; reload before saving',
        );
      }
      throw error;
    }
  }

  private async validateNodeSet(
    tx: Pick<Prisma.TransactionClient, 'device'>,
    siteId: string,
    dto: SaveTopologyViewDto,
  ): Promise<void> {
    const devices = await tx.device.findMany({
      where: { siteId },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const expected = new Set(devices.map((device) => 'device:' + device.id));
    const actual = new Set(dto.nodes.map((node) => node.nodeId));

    if (
      expected.size !== actual.size ||
      [...expected].some((nodeId) => !actual.has(nodeId))
    ) {
      throw new ConflictException(
        'Topology changed; refresh before saving the layout',
      );
    }
  }

  private async requireAccessibleSite(
    client: Pick<Prisma.TransactionClient, 'networkSite'>,
    siteId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const site = await client.networkSite.findFirst({
      where: {
        id: siteId,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.id }),
      },
      select: { id: true },
    });

    if (!site) {
      throw new NotFoundException('Network site ' + siteId + ' not found');
    }
  }

  private emptyView(siteId: string): TopologyViewDto {
    return {
      schemaVersion: 1,
      siteId,
      viewId: null,
      revision: 0,
      topologyRevision: null,
      viewport: null,
      nodes: [],
      updatedAt: null,
    };
  }

  private toDto(
    siteId: string,
    view: {
      id: string;
      revision: number;
      topologyRevision: number;
      viewportX: number;
      viewportY: number;
      zoom: number;
      updatedAt: Date;
      nodes: Array<{ nodeId: string; x: number; y: number }>;
    },
  ): TopologyViewDto {
    return {
      schemaVersion: 1,
      siteId,
      viewId: view.id,
      revision: view.revision,
      topologyRevision: view.topologyRevision,
      viewport: {
        x: view.viewportX,
        y: view.viewportY,
        zoom: view.zoom,
      },
      nodes: view.nodes,
      updatedAt: view.updatedAt,
    };
  }
}

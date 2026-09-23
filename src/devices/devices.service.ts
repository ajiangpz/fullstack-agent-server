import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { Device, Prisma } from '../generated/prisma/client';
import { AuditAction, UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT_NAME, DomainEvent } from '../events/domain-event';
import { DEFAULT_SITE_NAME } from '../topology/topology.constants';
import { TopologyRealtimeCoordinator } from '../topology/topology-realtime.coordinator';

interface TopologyRevisionChange {
  siteId: string;
  baseRevision: number;
  revision: number;
}

export interface PaginatedDevices {
  items: Device[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly topologyRealtime: TopologyRealtimeCoordinator,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query = new QueryDevicesDto(),
  ): Promise<PaginatedDevices> {
    const {
      page,
      limit,
      search,
      status,
      siteId,
      minPortCount,
      maxPortCount,
    } = query;

    if (
      minPortCount !== undefined &&
      maxPortCount !== undefined &&
      minPortCount > maxPortCount
    ) {
      throw new BadRequestException(
        'minPortCount cannot be greater than maxPortCount',
      );
    }

    const normalizedSearch = search?.trim();
    const where: Prisma.DeviceWhereInput = {
      ...this.getOwnershipFilter(user),
      siteId,
      status,
      portCount:
        minPortCount !== undefined || maxPortCount !== undefined
          ? { gte: minPortCount, lte: maxPortCount }
          : undefined,
      OR: normalizedSearch
        ? [
            {
              name: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            ...(isIP(normalizedSearch) ? [{ ip: normalizedSearch }] : []),
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: { id, ...this.getOwnershipFilter(user) },
    });

    if (!device) {
      throw new NotFoundException('Device ' + id + ' not found');
    }

    return device;
  }

  async create(dto: CreateDeviceDto, user: AuthenticatedUser): Promise<Device> {
    const { siteId, ...deviceData } = dto;
    const resolvedSiteId = await this.resolveSiteId(user.id, siteId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const device = await tx.device.create({
          data: {
            ...deviceData,
            ownerId: user.id,
            siteId: resolvedSiteId,
          },
        });
        const revision = await this.bumpTopologyRevision(tx, resolvedSiteId);
        return { device, change: this.toRevisionChange(resolvedSiteId, revision) };
      });

      this.publishTopologyChanges([result.change]);
      this.publishDeviceEvent(AuditAction.DEVICE_CREATED, result.device, user);
      return result.device;
    } catch (error) {
      this.handleWriteError(error, dto);
    }
  }

  async update(
    id: number,
    dto: UpdateDeviceDto,
    user: AuthenticatedUser,
  ): Promise<Device> {
    const { siteId, ...deviceData } = dto;
    const requestedSiteId =
      siteId !== undefined ? await this.resolveSiteId(user.id, siteId) : undefined;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.device.findFirst({
          where: { id, ...this.getOwnershipFilter(user) },
          select: { siteId: true },
        });
        if (!existing) {
          throw new NotFoundException('Device ' + id + ' not found');
        }

        const targetSiteId = requestedSiteId ?? existing.siteId;
        if (targetSiteId !== existing.siteId) {
          const linkCount = await tx.topologyLink.count({
            where: {
              OR: [{ aDeviceId: id }, { zDeviceId: id }],
            },
          });
          if (linkCount > 0) {
            throw new ConflictException(
              'Disconnect topology links before moving this device to another site',
            );
          }
        }

        const data: Prisma.DeviceUncheckedUpdateInput = { ...deviceData };
        if (requestedSiteId !== undefined) data.siteId = requestedSiteId;

        const device = await tx.device.update({
          where: { id, ...this.getOwnershipFilter(user) },
          data,
        });

        const changes: TopologyRevisionChange[] = [];
        const sourceRevision = await this.bumpTopologyRevision(tx, existing.siteId);
        changes.push(this.toRevisionChange(existing.siteId, sourceRevision));

        if (targetSiteId !== existing.siteId) {
          const targetRevision = await this.bumpTopologyRevision(tx, targetSiteId);
          changes.push(this.toRevisionChange(targetSiteId, targetRevision));
        }

        return { device, changes };
      });

      this.publishTopologyChanges(result.changes);
      this.publishDeviceEvent(AuditAction.DEVICE_UPDATED, result.device, user, {
        changedFields: Object.keys(dto),
      });
      return result.device;
    } catch (error) {
      this.handleWriteError(error, dto, id);
    }
  }

  async remove(id: number, user: AuthenticatedUser): Promise<Device> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.device.findFirst({
          where: { id, ...this.getOwnershipFilter(user) },
          select: { siteId: true },
        });
        if (!existing) {
          throw new NotFoundException('Device ' + id + ' not found');
        }

        const device = await tx.device.delete({
          where: { id, ...this.getOwnershipFilter(user) },
        });
        const revision = await this.bumpTopologyRevision(tx, existing.siteId);
        return { device, change: this.toRevisionChange(existing.siteId, revision) };
      });

      this.publishTopologyChanges([result.change]);
      this.publishDeviceEvent(AuditAction.DEVICE_DELETED, result.device, user);
      return result.device;
    } catch (error) {
      this.handleWriteError(error, undefined, id);
    }
  }

  private async bumpTopologyRevision(
    tx: Prisma.TransactionClient,
    siteId: string,
  ): Promise<number> {
    const site = await tx.networkSite.update({
      where: { id: siteId },
      data: { topologyRevision: { increment: 1 } },
      select: { topologyRevision: true },
    });
    return site.topologyRevision;
  }

  private toRevisionChange(
    siteId: string,
    revision: number,
  ): TopologyRevisionChange {
    return {
      siteId,
      baseRevision: revision - 1,
      revision,
    };
  }

  private publishTopologyChanges(changes: TopologyRevisionChange[]): void {
    for (const change of changes) {
      void this.topologyRealtime.recordSiteChange(
        change.siteId,
        change.baseRevision,
        change.revision,
      );
    }
  }

  private getOwnershipFilter(
    user: AuthenticatedUser,
  ): Pick<Prisma.DeviceWhereInput, 'ownerId'> {
    return user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
  }

  private async resolveSiteId(
    ownerId: number,
    requestedSiteId?: string,
  ): Promise<string> {
    if (requestedSiteId) {
      const site = await this.prisma.networkSite.findFirst({
        where: { id: requestedSiteId, ownerId },
        select: { id: true },
      });

      if (!site) {
        throw new NotFoundException(
          'Network site ' + requestedSiteId + ' not found',
        );
      }

      return site.id;
    }

    const defaultSite = await this.prisma.networkSite.upsert({
      where: {
        ownerId_name: {
          ownerId,
          name: DEFAULT_SITE_NAME,
        },
      },
      create: {
        ownerId,
        name: DEFAULT_SITE_NAME,
      },
      update: {},
      select: { id: true },
    });

    return defaultSite.id;
  }

  private publishDeviceEvent(
    action: AuditAction,
    device: Device,
    user: AuthenticatedUser,
    metadata?: Record<string, unknown>,
  ): void {
    this.eventEmitter.emit(
      DOMAIN_EVENT_NAME,
      new DomainEvent({
        action,
        resourceType: 'device',
        resourceId: String(device.id),
        actorId: user.id,
        metadata: {
          name: device.name,
          ip: device.ip,
          siteId: device.siteId,
          ...metadata,
        },
      }),
    );
  }

  private handleWriteError(
    error: unknown,
    dto?: Pick<UpdateDeviceDto, 'name' | 'ip'>,
    id?: number,
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target : [target];

        if (fields.includes('name') && dto?.name) {
          throw new ConflictException(
            'Device name "' + dto.name + '" already exists in this site',
          );
        }

        if (fields.includes('ip') && dto?.ip) {
          throw new ConflictException(
            'Device IP "' + dto.ip + '" already exists in this site',
          );
        }

        throw new ConflictException(
          'Device name or IP already exists in this site',
        );
      }

      if (error.code === 'P2025' && id !== undefined) {
        throw new NotFoundException('Device ' + id + ' not found');
      }
    }

    throw error;
  }
}

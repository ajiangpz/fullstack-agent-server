import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { Device, Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    user: AuthenticatedUser,
    query = new QueryDevicesDto(),
  ): Promise<PaginatedDevices> {
    const { page, limit, search, status, minPortCount, maxPortCount } = query;

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
      throw new NotFoundException(`Device ${id} not found`);
    }

    return device;
  }

  async create(dto: CreateDeviceDto, user: AuthenticatedUser): Promise<Device> {
    try {
      return await this.prisma.device.create({
        data: {
          ...dto,
          owner: { connect: { id: user.id } },
        },
      });
    } catch (error) {
      this.handleWriteError(error, dto);
    }
  }

  async update(
    id: number,
    dto: UpdateDeviceDto,
    user: AuthenticatedUser,
  ): Promise<Device> {
    try {
      return await this.prisma.device.update({
        where: { id, ...this.getOwnershipFilter(user) },
        data: dto,
      });
    } catch (error) {
      this.handleWriteError(error, dto, id);
    }
  }

  async remove(id: number, user: AuthenticatedUser): Promise<Device> {
    try {
      return await this.prisma.device.delete({
        where: { id, ...this.getOwnershipFilter(user) },
      });
    } catch (error) {
      this.handleWriteError(error, undefined, id);
    }
  }

  private getOwnershipFilter(
    user: AuthenticatedUser,
  ): Pick<Prisma.DeviceWhereInput, 'ownerId'> {
    return user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
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
            `Device name "${dto.name}" already exists`,
          );
        }

        if (fields.includes('ip') && dto?.ip) {
          throw new ConflictException(`Device IP "${dto.ip}" already exists`);
        }

        throw new ConflictException('Device name or IP already exists');
      }

      if (error.code === 'P2025' && id !== undefined) {
        throw new NotFoundException(`Device ${id} not found`);
      }
    }

    throw error;
  }
}

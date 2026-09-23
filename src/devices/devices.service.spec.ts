import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { AuditAction, UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENT_NAME, DomainEvent } from '../events/domain-event';

describe('DevicesService', () => {
  let service: DevicesService;
  let prisma: {
    device: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    networkSite: {
      findFirst: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let eventEmitter: { emit: jest.Mock };

  const device = {
    id: 1,
    name: 'Office Switch',
    ip: '192.168.1.10',
    portCount: 8,
    status: 'online',
    type: 'SWITCH',
    macAddress: null,
    serialNumber: null,
    vendor: null,
    model: null,
    lastSeenAt: null,
    metadata: null,
    ownerId: 2,
    siteId: 'site-2',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const user: AuthenticatedUser = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  const admin: AuthenticatedUser = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const knownRequestError = (code: string, meta?: Record<string, unknown>) =>
    new Prisma.PrismaClientKnownRequestError('Database request failed', {
      code,
      clientVersion: '7.9.0',
      meta,
    });

  beforeEach(async () => {
    prisma = {
      device: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      networkSite: {
        findFirst: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'site-2' }),
      },
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return the first page with default pagination', async () => {
      prisma.device.findMany.mockResolvedValue([device]);
      prisma.device.count.mockResolvedValue(1);

      await expect(service.findAll(user)).resolves.toEqual({
        items: [device],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: user.id,
          siteId: undefined,
          status: undefined,
          portCount: undefined,
          OR: undefined,
        },
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' },
      });
    });

    it('should apply search, status, site and port count filters', async () => {
      prisma.device.findMany.mockResolvedValue([device]);
      prisma.device.count.mockResolvedValue(11);

      const result = await service.findAll(user, {
        page: 2,
        limit: 10,
        search: '192.168.1.10',
        status: 'online',
        siteId: 'site-2',
        minPortCount: 4,
        maxPortCount: 48,
      });

      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: user.id,
          siteId: 'site-2',
          status: 'online',
          portCount: { gte: 4, lte: 48 },
          OR: [
            {
              name: {
                contains: '192.168.1.10',
                mode: 'insensitive',
              },
            },
            { ip: '192.168.1.10' },
          ],
        },
        skip: 10,
        take: 10,
        orderBy: { id: 'desc' },
      });
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 11,
        totalPages: 2,
      });
    });

    it('should not scope administrators to an owner', async () => {
      prisma.device.findMany.mockResolvedValue([device]);
      prisma.device.count.mockResolvedValue(1);

      await service.findAll(admin);

      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: {
          siteId: undefined,
          status: undefined,
          portCount: undefined,
          OR: undefined,
        },
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' },
      });
    });

    it('should reject an invalid port count range', async () => {
      await expect(
        service.findAll(user, {
          page: 1,
          limit: 20,
          minPortCount: 48,
          maxPortCount: 8,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a device by ID from the database', async () => {
      prisma.device.findFirst.mockResolvedValue(device);

      await expect(service.findOne(1, user)).resolves.toEqual(device);
      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { id: 1, ownerId: user.id },
      });
    });

    it('should hide a device that is not owned by the user', async () => {
      prisma.device.findFirst.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow administrators to find any device', async () => {
      prisma.device.findFirst.mockResolvedValue(device);

      await service.findOne(1, admin);

      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Core Switch',
      ip: '192.168.1.30',
      portCount: 24,
      status: 'online' as const,
    };

    it('should create a device in the default site', async () => {
      const createdDevice = { ...device, id: 3, ...dto };
      prisma.device.create.mockResolvedValue(createdDevice);

      await expect(service.create(dto, user)).resolves.toEqual(createdDevice);
      expect(prisma.networkSite.upsert).toHaveBeenCalledWith({
        where: {
          ownerId_name: {
            ownerId: user.id,
            name: 'Default Site',
          },
        },
        create: {
          ownerId: user.id,
          name: 'Default Site',
        },
        update: {},
        select: { id: true },
      });
      expect(prisma.device.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          ownerId: user.id,
          siteId: 'site-2',
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAME,
        new DomainEvent({
          action: AuditAction.DEVICE_CREATED,
          resourceType: 'device',
          resourceId: '3',
          actorId: user.id,
          metadata: {
            name: createdDevice.name,
            ip: createdDevice.ip,
            siteId: createdDevice.siteId,
          },
        }),
      );
    });

    it('should create a device only in a site owned by the caller', async () => {
      prisma.networkSite.findFirst.mockResolvedValue({ id: 'custom-site' });
      prisma.device.create.mockResolvedValue({
        ...device,
        siteId: 'custom-site',
      });

      await service.create({ ...dto, siteId: 'custom-site' }, user);

      expect(prisma.networkSite.findFirst).toHaveBeenCalledWith({
        where: { id: 'custom-site', ownerId: user.id },
        select: { id: true },
      });
      expect(prisma.device.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          ownerId: user.id,
          siteId: 'custom-site',
        },
      });
    });

    it('should reject a site not owned by the caller', async () => {
      prisma.networkSite.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ ...dto, siteId: 'foreign-site' }, user),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.device.create).not.toHaveBeenCalled();
    });

    it('should reject a duplicate device name in the same site', async () => {
      prisma.device.create.mockRejectedValue(
        knownRequestError('P2002', { target: ['siteId', 'name'] }),
      );

      await expect(service.create(dto, user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject a duplicate device IP in the same site', async () => {
      prisma.device.create.mockRejectedValue(
        knownRequestError('P2002', { target: ['siteId', 'ip'] }),
      );

      await expect(service.create(dto, user)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update a device in the database', async () => {
      const dto = { portCount: 24 };
      const updatedDevice = { ...device, ...dto };
      prisma.device.update.mockResolvedValue(updatedDevice);

      await expect(service.update(1, dto, user)).resolves.toEqual(
        updatedDevice,
      );
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 1, ownerId: user.id },
        data: dto,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAME,
        new DomainEvent({
          action: AuditAction.DEVICE_UPDATED,
          resourceType: 'device',
          resourceId: '1',
          actorId: user.id,
          metadata: {
            name: updatedDevice.name,
            ip: updatedDevice.ip,
            siteId: updatedDevice.siteId,
            changedFields: ['portCount'],
          },
        }),
      );
    });

    it('should reject a duplicate device name', async () => {
      prisma.device.update.mockRejectedValue(
        knownRequestError('P2002', { target: ['siteId', 'name'] }),
      );

      await expect(
        service.update(1, { name: 'Meeting Room AP' }, user),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw when the device does not exist', async () => {
      prisma.device.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update(99, { portCount: 24 }, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a device from the database', async () => {
      prisma.device.delete.mockResolvedValue(device);

      await expect(service.remove(1, user)).resolves.toEqual(device);
      expect(prisma.device.delete).toHaveBeenCalledWith({
        where: { id: 1, ownerId: user.id },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAME,
        new DomainEvent({
          action: AuditAction.DEVICE_DELETED,
          resourceType: 'device',
          resourceId: '1',
          actorId: user.id,
          metadata: {
            name: device.name,
            ip: device.ip,
            siteId: device.siteId,
          },
        }),
      );
    });

    it('should throw when the device does not exist', async () => {
      prisma.device.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
    });
  });
});

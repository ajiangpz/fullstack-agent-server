import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';

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
  };

  const device = {
    id: 1,
    name: 'Office Switch',
    ip: '192.168.1.10',
    portCount: 8,
    status: 'online',
    ownerId: 2,
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: PrismaService,
          useValue: prisma,
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
          status: undefined,
          portCount: undefined,
          OR: undefined,
        },
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' },
      });
    });

    it('should apply search, status and port count filters', async () => {
      prisma.device.findMany.mockResolvedValue([device]);
      prisma.device.count.mockResolvedValue(11);

      const result = await service.findAll(user, {
        page: 2,
        limit: 10,
        search: '192.168.1.10',
        status: 'online',
        minPortCount: 4,
        maxPortCount: 48,
      });

      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: user.id,
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

    it('should create a device in the database', async () => {
      const createdDevice = { id: 3, ...dto };
      prisma.device.create.mockResolvedValue(createdDevice);

      await expect(service.create(dto, user)).resolves.toEqual(createdDevice);
      expect(prisma.device.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          owner: { connect: { id: user.id } },
        },
      });
    });

    it('should reject a duplicate device name', async () => {
      prisma.device.create.mockRejectedValue(
        knownRequestError('P2002', { target: ['name'] }),
      );

      await expect(service.create(dto, user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject a duplicate device IP', async () => {
      prisma.device.create.mockRejectedValue(
        knownRequestError('P2002', { target: ['ip'] }),
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
    });

    it('should reject a duplicate device name', async () => {
      prisma.device.update.mockRejectedValue(
        knownRequestError('P2002', { target: ['name'] }),
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
    });

    it('should throw when the device does not exist', async () => {
      prisma.device.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
    });
  });
});

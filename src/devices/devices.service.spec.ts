import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DevicesService],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should reject a duplicate device name', () => {
      expect(() =>
        service.create({
          name: 'Office Switch',
          ip: '192.168.1.30',
          portCount: 24,
          status: 'online',
        }),
      ).toThrow(ConflictException);
    });

    it('should reject a duplicate device IP', () => {
      expect(() =>
        service.create({
          name: 'Core Switch',
          ip: '192.168.1.10',
          portCount: 24,
          status: 'online',
        }),
      ).toThrow(ConflictException);
    });

    it('should create a device when its name and IP are unique', () => {
      const device = service.create({
        name: 'Core Switch',
        ip: '192.168.1.30',
        portCount: 24,
        status: 'online',
      });

      expect(device).toEqual({
        id: 3,
        name: 'Core Switch',
        ip: '192.168.1.30',
        portCount: 24,
        status: 'online',
      });
    });

    it('should generate an ID greater than the current maximum after deletion', () => {
      service.remove(1);

      const device = service.create({
        name: 'Core Switch',
        ip: '192.168.1.30',
        portCount: 24,
        status: 'online',
      });

      expect(device.id).toBe(3);
    });
  });

  describe('update', () => {
    it('should reject another device\'s name', () => {
      expect(() => service.update(2, { name: 'Office Switch' })).toThrow(
        ConflictException,
      );
    });

    it('should reject another device\'s IP', () => {
      expect(() => service.update(2, { ip: '192.168.1.10' })).toThrow(
        ConflictException,
      );
    });

    it('should allow a device to keep its own name and IP', () => {
      const device = service.update(1, {
        name: 'Office Switch',
        ip: '192.168.1.10',
        portCount: 24,
      });

      expect(device.portCount).toBe(24);
    });
  });
});

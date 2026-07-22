import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
type DeviceStatus = 'online' | 'offline';

export type Device = {
  id: number;
  name: string;
  ip: string;
  portCount: number;
  status: DeviceStatus;
};

@Injectable()
export class DevicesService {
  private readonly devices: Device[] = [
    {
      id: 1,
      name: 'Office Switch',
      ip: '192.168.1.10',
      portCount: 8,
      status: 'online',
    },
    {
      id: 2,
      name: 'Meeting Room AP',
      ip: '192.168.1.20',
      portCount: 1,
      status: 'offline',
    },
  ];

  findAll(): Device[] {
    return this.devices;
  }

  findOne(id: number): Device {
    const device = this.devices.find((item) => item.id === id);
    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return device;
  }
  create(dto: CreateDeviceDto) {
    this.assertUnique(dto);

    const device: Device = {
      id: this.getNextId(),
      ...dto,
    };

    this.devices.push(device);

    return device;
  }

  private assertUnique(
    dto: Pick<UpdateDeviceDto, 'name' | 'ip'>,
    excludedId?: number,
  ): void {
    if (
      dto.name !== undefined &&
      this.devices.some(
        (device) => device.id !== excludedId && device.name === dto.name,
      )
    ) {
      throw new ConflictException(`Device name "${dto.name}" already exists`);
    }

    if (
      dto.ip !== undefined &&
      this.devices.some(
        (device) => device.id !== excludedId && device.ip === dto.ip,
      )
    ) {
      throw new ConflictException(`Device IP "${dto.ip}" already exists`);
    }
  }

  private getNextId(): number {
    return this.devices.reduce((maxId, device) => Math.max(maxId, device.id), 0) + 1;
  }

  update(id: number, dto: UpdateDeviceDto): Device {
    const device = this.findOne(id);
    this.assertUnique(dto, id);

    Object.assign(device, dto);

    return device;
  }
  remove(id: number): Device {
    const index = this.devices.findIndex((device) => device.id === id);

    if (index === -1) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    const [deletedDevice] = this.devices.splice(index, 1);

    return deletedDevice;
  }
}

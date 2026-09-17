import {
  IsIn,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const DEVICE_STATUSES = ['online', 'offline'] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export class CreateDeviceDto {
  @ApiProperty({
    example: 'gateway-01',
    minLength: 1,
    maxLength: 100,
    description: '设备名称',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '192.168.1.10', description: '设备 IP 地址' })
  @IsIP(4)
  ip!: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 128, description: '端口数量' })
  @IsInt()
  @Min(1)
  @Max(128)
  portCount!: number;

  @ApiProperty({
    example: 'online',
    enum: DEVICE_STATUSES,
    description: '设备状态',
  })
  @IsIn(DEVICE_STATUSES)
  status!: DeviceStatus;
}

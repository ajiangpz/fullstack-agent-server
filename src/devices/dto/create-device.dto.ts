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

export const DEVICE_STATUSES = ['online', 'offline'] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIP(4)
  ip!: string;

  @IsInt()
  @Min(1)
  @Max(128)
  portCount!: number;

  @IsIn(DEVICE_STATUSES)
  status!: DeviceStatus;
}

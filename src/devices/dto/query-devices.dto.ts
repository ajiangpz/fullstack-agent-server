import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEVICE_STATUSES } from './create-device.dto';
import type { DeviceStatus } from './create-device.dto';

export class QueryDevicesDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: '页码' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, description: '每页条数' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ example: 'gateway', maxLength: 100, description: '搜索关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: DEVICE_STATUSES,
    example: 'online',
    description: '设备状态过滤',
  })
  @IsOptional()
  @IsIn(DEVICE_STATUSES)
  status?: DeviceStatus;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 128, description: '最小端口数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(128)
  minPortCount?: number;

  @ApiPropertyOptional({ example: 32, minimum: 1, maximum: 128, description: '最大端口数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(128)
  maxPortCount?: number;
}

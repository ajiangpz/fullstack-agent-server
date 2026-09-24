import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetricSource } from '../../generated/prisma/enums';

export enum TopologyMetricsRange {
  ONE_HOUR = '1h',
  SIX_HOURS = '6h',
  TWENTY_FOUR_HOURS = '24h',
  SEVEN_DAYS = '7d',
}

export class TopologyMetricsQueryDto {
  @ApiPropertyOptional({
    enum: TopologyMetricsRange,
    default: TopologyMetricsRange.SIX_HOURS,
  })
  @IsOptional()
  @IsEnum(TopologyMetricsRange)
  range?: TopologyMetricsRange = TopologyMetricsRange.SIX_HOURS;

  @ApiPropertyOptional({ minimum: 30, maximum: 360, default: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(360)
  points?: number = 180;
}

export class DeviceMetricIngestSampleDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  deviceId!: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  sampledAt!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  rxBitsPerSecond?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  txBitsPerSecond?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  cpuPercent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  memoryPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  temperatureCelsius?: number;
}

export class TopologyLinkMetricIngestSampleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  linkId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  sampledAt!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  aToZBitsPerSecond?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  zToABitsPerSecond?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  utilizationPercent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  errorRatePercent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  packetLossPercent?: number;
}

export class IngestTopologyMetricsDto {
  @ApiProperty({ enum: MetricSource })
  @IsEnum(MetricSource)
  source!: MetricSource;

  @ApiPropertyOptional({
    type: [DeviceMetricIngestSampleDto],
    maxItems: 1000,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => DeviceMetricIngestSampleDto)
  devices?: DeviceMetricIngestSampleDto[];

  @ApiPropertyOptional({
    type: [TopologyLinkMetricIngestSampleDto],
    maxItems: 1000,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TopologyLinkMetricIngestSampleDto)
  links?: TopologyLinkMetricIngestSampleDto[];
}

export class TopologyMetricsIngestResultDto {
  @ApiProperty()
  acceptedDeviceSamples!: number;

  @ApiProperty()
  acceptedLinkSamples!: number;
}

export class DeviceMetricPointDto {
  @ApiProperty({ format: 'date-time' })
  sampledAt!: string;

  @ApiPropertyOptional({ nullable: true })
  rxBitsPerSecond!: number | null;

  @ApiPropertyOptional({ nullable: true })
  txBitsPerSecond!: number | null;

  @ApiPropertyOptional({ nullable: true })
  cpuPercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  memoryPercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  temperatureCelsius!: number | null;
}

export class TopologyLinkMetricPointDto {
  @ApiProperty({ format: 'date-time' })
  sampledAt!: string;

  @ApiPropertyOptional({ nullable: true })
  aToZBitsPerSecond!: number | null;

  @ApiPropertyOptional({ nullable: true })
  zToABitsPerSecond!: number | null;

  @ApiPropertyOptional({ nullable: true })
  utilizationPercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  errorRatePercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  packetLossPercent!: number | null;
}

export class DeviceMetricsSeriesDto {
  @ApiProperty()
  deviceId!: number;

  @ApiProperty({ enum: TopologyMetricsRange })
  range!: TopologyMetricsRange;

  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ type: [DeviceMetricPointDto] })
  points!: DeviceMetricPointDto[];
}

export class TopologyLinkMetricsSeriesDto {
  @ApiProperty()
  linkId!: string;

  @ApiProperty({ enum: TopologyMetricsRange })
  range!: TopologyMetricsRange;

  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ type: [TopologyLinkMetricPointDto] })
  points!: TopologyLinkMetricPointDto[];
}

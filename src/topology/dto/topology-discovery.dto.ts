import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DiscoveryRunStatus,
  DiscoverySource,
  TopologyLinkStatus,
  TopologyLinkType,
} from '../../generated/prisma/enums';

export class ManualTopologyObservationDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  localDeviceId!: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  localPortId?: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  remoteDeviceId!: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  remotePortId?: number;

  @ApiPropertyOptional({ enum: TopologyLinkType, default: 'ETHERNET' })
  @IsOptional()
  @IsEnum(TopologyLinkType)
  linkType?: TopologyLinkType;

  @ApiPropertyOptional({ enum: TopologyLinkStatus, default: 'UP' })
  @IsOptional()
  @IsEnum(TopologyLinkStatus)
  status?: TopologyLinkStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  speedMbps?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 1 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class CreateTopologyDiscoveryDto {
  @ApiProperty({ enum: DiscoverySource })
  @IsEnum(DiscoverySource)
  source!: DiscoverySource;

  @ApiPropertyOptional({
    type: [ManualTopologyObservationDto],
    description:
      'Required for MANUAL discovery. Automatic protocol providers ignore this field.',
  })
  @ValidateIf((dto: CreateTopologyDiscoveryDto) =>
    dto.source === DiscoverySource.MANUAL,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ManualTopologyObservationDto)
  observations?: ManualTopologyObservationDto[];
}

export class TopologyDiscoveryRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional({ nullable: true })
  requestedById!: number | null;

  @ApiProperty({ enum: DiscoverySource })
  source!: DiscoverySource;

  @ApiProperty({ enum: DiscoveryRunStatus })
  status!: DiscoveryRunStatus;

  @ApiProperty()
  observationCount!: number;

  @ApiProperty()
  resolvedObservationCount!: number;

  @ApiProperty()
  reconciledLinkCount!: number;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  startedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  completedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

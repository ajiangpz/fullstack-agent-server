import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyNullable } from '@nestjs/swagger';

const COORDINATE_LIMIT = 1_000_000;

export class TopologyViewNodePositionDto {
  @ApiProperty({ example: 'device:12' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*:[A-Za-z0-9._:-]+$/)
  nodeId!: string;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-COORDINATE_LIMIT)
  @Max(COORDINATE_LIMIT)
  x!: number;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-COORDINATE_LIMIT)
  @Max(COORDINATE_LIMIT)
  y!: number;
}

export class TopologyViewportDto {
  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-COORDINATE_LIMIT)
  @Max(COORDINATE_LIMIT)
  x!: number;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-COORDINATE_LIMIT)
  @Max(COORDINATE_LIMIT)
  y!: number;

  @ApiProperty({ minimum: 0.1, maximum: 10 })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.1)
  @Max(10)
  zoom!: number;
}

export class SaveTopologyViewDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  topologyRevision!: number;

  @ApiProperty({ type: TopologyViewportDto })
  @ValidateNested()
  @Type(() => TopologyViewportDto)
  viewport!: TopologyViewportDto;

  @ApiProperty({ type: [TopologyViewNodePositionDto], maxItems: 5000 })
  @IsArray()
  @ArrayMaxSize(5000)
  @ArrayUnique((position: TopologyViewNodePositionDto) => position.nodeId)
  @ValidateNested({ each: true })
  @Type(() => TopologyViewNodePositionDto)
  nodes!: TopologyViewNodePositionDto[];
}

export class TopologyViewDto {
  @ApiProperty({ example: 1, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyNullable({ type: String })
  viewId!: string | null;

  @ApiProperty({ minimum: 0 })
  revision!: number;

  @ApiPropertyNullable({ type: Number, minimum: 0 })
  topologyRevision!: number | null;

  @ApiPropertyNullable({ type: TopologyViewportDto })
  viewport!: TopologyViewportDto | null;

  @ApiProperty({ type: [TopologyViewNodePositionDto] })
  nodes!: TopologyViewNodePositionDto[];

  @ApiPropertyNullable({ type: String, format: 'date-time' })
  updatedAt!: Date | null;
}

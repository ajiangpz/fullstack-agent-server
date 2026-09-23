import { ApiProperty, ApiPropertyNullable } from '@nestjs/swagger';
import {
  DeviceStatus,
  DeviceType,
  DiscoverySource,
  TopologyLinkStatus,
  TopologyLinkType,
} from '../../generated/prisma/enums';

export class NetworkSiteSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ownerId!: number;

  @ApiProperty()
  topologyRevision!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TopologySiteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class TopologyNodeDto {
  @ApiProperty({ example: 'device:12' })
  id!: string;

  @ApiProperty()
  deviceId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ip!: string;

  @ApiProperty({ enum: DeviceStatus })
  status!: DeviceStatus;

  @ApiProperty({ enum: DeviceType })
  type!: DeviceType;

  @ApiProperty()
  portCount!: number;

  @ApiPropertyNullable({ type: String })
  vendor!: string | null;

  @ApiPropertyNullable({ type: String })
  model!: string | null;

  @ApiPropertyNullable({ type: String })
  macAddress!: string | null;

  @ApiPropertyNullable({ type: String, format: 'date-time' })
  lastSeenAt!: Date | null;
}

export class TopologyEdgePortDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyNullable({ type: Number })
  ifIndex!: number | null;
}

export class TopologyEdgeDto {
  @ApiProperty({ example: 'link:cm123' })
  id!: string;

  @ApiProperty()
  linkId!: string;

  @ApiProperty({ example: 'device:12' })
  source!: string;

  @ApiProperty({ example: 'device:18' })
  target!: string;

  @ApiPropertyNullable({ type: TopologyEdgePortDto })
  sourcePort!: TopologyEdgePortDto | null;

  @ApiPropertyNullable({ type: TopologyEdgePortDto })
  targetPort!: TopologyEdgePortDto | null;

  @ApiProperty({ enum: TopologyLinkType })
  linkType!: TopologyLinkType;

  @ApiProperty({ enum: TopologyLinkStatus })
  status!: TopologyLinkStatus;

  @ApiProperty({ enum: DiscoverySource })
  discoverySource!: DiscoverySource;

  @ApiPropertyNullable({ type: Number })
  speedMbps!: number | null;

  @ApiProperty({ minimum: 0, maximum: 1 })
  confidence!: number;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt!: Date;
}

export class TopologySnapshotDto {
  @ApiProperty({ example: 1, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: TopologySiteDto })
  site!: TopologySiteDto;

  @ApiProperty()
  revision!: number;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: Date;

  @ApiProperty({ type: [TopologyNodeDto] })
  nodes!: TopologyNodeDto[];

  @ApiProperty({ type: [TopologyEdgeDto] })
  edges!: TopologyEdgeDto[];
}

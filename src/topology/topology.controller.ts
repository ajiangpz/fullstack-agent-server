import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';
import {
  NetworkSiteSummaryDto,
  TopologySnapshotDto,
} from './dto/topology.dto';
import { TopologyQueryService } from './topology-query.service';
import {
  SaveTopologyViewDto,
  TopologyViewDto,
} from './dto/topology-view.dto';
import { TopologyViewService } from './topology-view.service';
import {
  CreateTopologyDiscoveryDto,
  TopologyDiscoveryRunDto,
} from './dto/topology-discovery.dto';
import { TopologyDiscoveryService } from './topology-discovery.service';
import {
  DeviceMetricsSeriesDto,
  IngestTopologyMetricsDto,
  TopologyLinkMetricsSeriesDto,
  TopologyMetricsIngestResultDto,
  TopologyMetricsQueryDto,
} from './dto/topology-metrics.dto';
import { TopologyMetricsService } from './topology-metrics.service';

@ApiTags('topology')
@ApiBearerAuth()
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopologyController {
  constructor(
    private readonly topologyQueryService: TopologyQueryService,
    private readonly topologyViewService: TopologyViewService,
    private readonly topologyDiscoveryService: TopologyDiscoveryService,
    private readonly topologyMetricsService: TopologyMetricsService,
  ) {}

  @ApiOperation({ summary: '获取可访问的网络站点列表' })
  @ApiOkResponse({ type: [NetworkSiteSummaryDto] })
  @Get()
  listSites(
    @Req() request: { user: AuthenticatedUser },
  ): Promise<NetworkSiteSummaryDto[]> {
    return this.topologyQueryService.listSites(request.user);
  }

  @ApiOperation({ summary: '获取指定站点的网络拓扑快照' })
  @ApiOkResponse({ type: TopologySnapshotDto })
  @Get(':siteId/topology')
  getTopology(
    @Param('siteId') siteId: string,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologySnapshotDto> {
    return this.topologyQueryService.getTopology(siteId, request.user);
  }

  @ApiOperation({ summary: '获取当前用户在指定站点的拓扑视图布局' })
  @ApiOkResponse({ type: TopologyViewDto })
  @Get(':siteId/topology/view')
  getTopologyView(
    @Param('siteId') siteId: string,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologyViewDto> {
    return this.topologyViewService.getView(siteId, request.user);
  }

  @ApiOperation({ summary: '保存当前用户在指定站点的拓扑视图布局' })
  @ApiOkResponse({ type: TopologyViewDto })
  @Put(':siteId/topology/view')
  saveTopologyView(
    @Param('siteId') siteId: string,
    @Body() dto: SaveTopologyViewDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologyViewDto> {
    return this.topologyViewService.saveView(siteId, dto, request.user);
  }

  @ApiOperation({ summary: '批量写入拓扑设备与链路指标' })
  @ApiCreatedResponse({ type: TopologyMetricsIngestResultDto })
  @Roles(UserRole.ADMIN)
  @Post(':siteId/topology/metrics/samples')
  ingestTopologyMetrics(
    @Param('siteId') siteId: string,
    @Body() dto: IngestTopologyMetricsDto,
  ): Promise<TopologyMetricsIngestResultDto> {
    return this.topologyMetricsService.ingest(siteId, dto);
  }

  @ApiOperation({ summary: '获取设备拓扑时序指标' })
  @ApiOkResponse({ type: DeviceMetricsSeriesDto })
  @Get(':siteId/topology/metrics/devices/:deviceId')
  getDeviceTopologyMetrics(
    @Param('siteId') siteId: string,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Query() query: TopologyMetricsQueryDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<DeviceMetricsSeriesDto> {
    return this.topologyMetricsService.getDeviceSeries(
      siteId,
      deviceId,
      query,
      request.user,
    );
  }

  @ApiOperation({ summary: '获取链路拓扑时序指标' })
  @ApiOkResponse({ type: TopologyLinkMetricsSeriesDto })
  @Get(':siteId/topology/metrics/links/:linkId')
  getLinkTopologyMetrics(
    @Param('siteId') siteId: string,
    @Param('linkId') linkId: string,
    @Query() query: TopologyMetricsQueryDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologyLinkMetricsSeriesDto> {
    return this.topologyMetricsService.getLinkSeries(
      siteId,
      linkId,
      query,
      request.user,
    );
  }

  @ApiOperation({ summary: '创建拓扑发现任务' })
  @ApiCreatedResponse({ type: TopologyDiscoveryRunDto })
  @Post(':siteId/topology/discovery')
  createTopologyDiscovery(
    @Param('siteId') siteId: string,
    @Body() dto: CreateTopologyDiscoveryDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologyDiscoveryRunDto> {
    return this.topologyDiscoveryService.create(siteId, dto, request.user);
  }

  @ApiOperation({ summary: '查询拓扑发现任务' })
  @ApiOkResponse({ type: TopologyDiscoveryRunDto })
  @Get(':siteId/topology/discovery/:runId')
  getTopologyDiscovery(
    @Param('siteId') siteId: string,
    @Param('runId') runId: string,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<TopologyDiscoveryRunDto> {
    return this.topologyDiscoveryService.findOne(siteId, runId, request.user);
  }
}

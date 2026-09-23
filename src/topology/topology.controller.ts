import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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

@ApiTags('topology')
@ApiBearerAuth()
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopologyController {
  constructor(
    private readonly topologyQueryService: TopologyQueryService,
    private readonly topologyViewService: TopologyViewService,
    private readonly topologyDiscoveryService: TopologyDiscoveryService,
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

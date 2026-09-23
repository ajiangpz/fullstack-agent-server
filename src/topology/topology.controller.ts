import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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

@ApiTags('topology')
@ApiBearerAuth()
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopologyController {
  constructor(
    private readonly topologyQueryService: TopologyQueryService,
    private readonly topologyViewService: TopologyViewService,
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
}

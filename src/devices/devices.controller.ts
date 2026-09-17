import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @ApiOperation({ summary: '获取设备列表' })
  @Get()
  findAll(
    @Query() query: QueryDevicesDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.findAll(request.user, query);
  }

  @ApiOperation({ summary: '获取单个设备详情' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.findOne(id, request.user);
  }

  @ApiOperation({ summary: '创建设备' })
  @Post()
  create(
    @Body() dto: CreateDeviceDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.create(dto, request.user);
  }

  @ApiOperation({ summary: '更新设备' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.update(id, dto, request.user);
  }

  @ApiOperation({ summary: '删除设备' })
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.remove(id, request.user);
  }
}

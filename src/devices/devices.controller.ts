import {
  Controller,
  Get,
  ParseIntPipe,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { QueryDevicesDto } from './dto/query-devices.dto';
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(
    @Query() query: QueryDevicesDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.findAll(request.user, query);
  }
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.findOne(id, request.user);
  }
  @Post()
  create(
    @Body() dto: CreateDeviceDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.create(dto, request.user);
  }
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.update(id, dto, request.user);
  }
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.devicesService.remove(id, request.user);
  }
}

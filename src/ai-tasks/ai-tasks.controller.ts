import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiTasksService } from './ai-tasks.service';
import { CreateAiTaskDto } from './dto/create-ai-task.dto';

@ApiTags('ai-tasks')
@ApiBearerAuth()
@Controller('ai-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiTasksController {
  constructor(private readonly aiTasksService: AiTasksService) {}

  @ApiOperation({ summary: '创建 AI 任务' })
  @Post()
  create(
    @Body() dto: CreateAiTaskDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.aiTasksService.create(dto, request.user);
  }

  @ApiOperation({ summary: '查询 AI 任务详情' })
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.aiTasksService.findOne(id, request.user);
  }
}

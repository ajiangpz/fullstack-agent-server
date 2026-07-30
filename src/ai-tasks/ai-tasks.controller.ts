import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiTasksService } from './ai-tasks.service';
import { CreateAiTaskDto } from './dto/create-ai-task.dto';

@Controller('ai-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiTasksController {
  constructor(private readonly aiTasksService: AiTasksService) {}

  @Post()
  create(
    @Body() dto: CreateAiTaskDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.aiTasksService.create(dto, request.user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.aiTasksService.findOne(id, request.user);
  }
}

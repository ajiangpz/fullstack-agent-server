import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiTaskEventBus } from './ai-task-event-bus';
import {
  createAiTaskStreamEvent,
  type AiTaskStreamEvent,
} from './ai-task-events';
import { serializeAiTaskSseEvent } from './ai-task-sse';
import { AiTasksService } from './ai-tasks.service';
import { CreateAiTaskDto } from './dto/create-ai-task.dto';
import { QueryAiTasksDto } from './dto/query-ai-tasks.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('ai-tasks')
@ApiBearerAuth()
@Controller('ai-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiTasksController {
  constructor(
    private readonly aiTasksService: AiTasksService,
    private readonly events: AiTaskEventBus,
  ) {}

  @ApiOperation({ summary: '创建 AI 任务' })
  @Post()
  create(@Body() dto: CreateAiTaskDto, @Req() request: AuthenticatedRequest) {
    return this.aiTasksService.create(dto, request.user);
  }

  @ApiOperation({ summary: '查询 AI 任务列表' })
  @Get()
  findAll(
    @Query() query: QueryAiTasksDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiTasksService.findAll(request.user, query);
  }

  @ApiOperation({ summary: '订阅 AI 任务实时事件' })
  @Get(':id/events')
  async eventsStream(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.aiTasksService.findOne(id, request.user);

    const bufferedEvents: AiTaskStreamEvent[] = [];
    let streaming = false;
    let closed = false;
    let heartbeat: NodeJS.Timeout | null = null;
    let stopSubscription: (() => Promise<void>) | null = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (stopSubscription) {
        void stopSubscription();
        stopSubscription = null;
      }
    };

    const deliver = (event: AiTaskStreamEvent) => {
      if (closed) return;
      if (!streaming) {
        bufferedEvents.push(event);
        return;
      }

      response.write(serializeAiTaskSseEvent(event));

      if (event.type === 'task.completed' || event.type === 'task.failed') {
        response.end();
        cleanup();
      }
    };

    try {
      stopSubscription = await this.events.subscribe(id, deliver);
    } catch {
      throw new ServiceUnavailableException(
        'AI task event stream is unavailable',
      );
    }

    response.once('close', cleanup);

    try {
      const snapshot = await this.aiTasksService.findOne(id, request.user);
      if (closed) return;

      response.status(200);
      response.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      response.write('retry: 3000\n\n');
      response.write(
        serializeAiTaskSseEvent(
          createAiTaskStreamEvent(id, 'snapshot', snapshot),
        ),
      );

      streaming = true;
      for (const event of bufferedEvents.splice(0)) {
        deliver(event);
        if (closed) return;
      }

      if (snapshot.status === 'COMPLETED' || snapshot.status === 'FAILED') {
        response.end();
        cleanup();
        return;
      }

      heartbeat = setInterval(() => {
        if (!closed) response.write(': heartbeat\n\n');
      }, 15_000);
      heartbeat.unref();
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  @ApiOperation({ summary: '查询 AI 任务详情' })
  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.aiTasksService.findOne(id, request.user);
  }
}

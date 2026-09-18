import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ConversationsService } from './conversations.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @ApiOperation({ summary: '创建 Conversation' })
  @Post()
  create(@Req() request: AuthenticatedRequest) {
    return this.conversations.create(request.user);
  }

  @ApiOperation({ summary: '查询 Conversation 消息' })
  @Get(':id/messages')
  messages(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversations.getMessages(id, request.user);
  }
}

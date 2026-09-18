import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @ApiOperation({ summary: '创建 Conversation' })
  @Post()
  create(@Req() request: { user: AuthenticatedUser }) {
    return this.conversations.create(request.user);
  }

  @ApiOperation({ summary: '查询 Conversation 消息' })
  @Get(':id/messages')
  messages(
    @Param('id') id: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.conversations.getMessages(id, request.user);
  }
}

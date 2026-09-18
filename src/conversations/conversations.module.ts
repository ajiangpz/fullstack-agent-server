import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationContextService } from './conversation-context.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationContextService],
  exports: [ConversationsService, ConversationContextService],
})
export class ConversationsModule {}

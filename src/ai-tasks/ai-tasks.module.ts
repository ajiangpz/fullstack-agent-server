import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiTaskProcessor } from './ai-task.processor';
import { AI_CLIENT, AI_TASK_QUEUE } from './ai-task.constants';
import { MockAiClient } from './ai-client';
import { AiTasksController } from './ai-tasks.controller';
import { AiTasksService } from './ai-tasks.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: AI_TASK_QUEUE }),
  ],
  controllers: [AiTasksController],
  providers: [
    AiTasksService,
    AiTaskProcessor,
    MockAiClient,
    { provide: AI_CLIENT, useExisting: MockAiClient },
  ],
})
export class AiTasksModule {}

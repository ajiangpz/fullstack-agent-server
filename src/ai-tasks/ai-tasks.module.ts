import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiTaskProcessor } from './ai-task.processor';
import { AI_PROVIDER, AI_TASK_QUEUE } from './ai-task.constants';
import { AiTasksController } from './ai-tasks.controller';
import { AiTasksService } from './ai-tasks.service';
import { AgentStepService } from './agent-step.service';
import { createAiProvider } from './providers/ai-provider.factory';

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
    AgentStepService,
    { provide: AI_PROVIDER, useFactory: createAiProvider },
  ],
})
export class AiTasksModule {}

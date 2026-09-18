import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesModule } from '../devices/devices.module';
import { AiTaskProcessor } from './ai-task.processor';
import { AI_PROVIDER, AI_TASK_QUEUE } from './ai-task.constants';
import { AiTasksController } from './ai-tasks.controller';
import { AiTasksService } from './ai-tasks.service';
import { AgentStepService } from './agent-step.service';
import { AgentService } from './agent.service';
import { createAiProvider } from './providers/ai-provider.factory';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';
import { ToolRegistry } from './tool-registry';
import { TaskLeaseService } from './task-lease.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DevicesModule,
    BullModule.registerQueue({ name: AI_TASK_QUEUE }),
  ],
  controllers: [AiTasksController],
  providers: [
    AiTasksService,
    AiTaskProcessor,
    AgentService,
    AgentStepService,
    GetDeviceTool,
    ListDevicesTool,
    SearchDevicesTool,
    ToolRegistry,
    TaskLeaseService,
    { provide: AI_PROVIDER, useFactory: createAiProvider },
  ],
})
export class AiTasksModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DevicesModule } from '../devices/devices.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TopologyModule } from '../topology/topology.module';
import { AI_PROVIDER, AI_TASK_QUEUE } from './ai-task.constants';
import { AiTaskEventBus } from './ai-task-event-bus';
import { AiTaskProcessor } from './ai-task.processor';
import { AiTasksController } from './ai-tasks.controller';
import { AiTasksService } from './ai-tasks.service';
import { AgentStepService } from './agent-step.service';
import { AgentService } from './agent.service';
import { createAiProvider } from './providers/ai-provider.factory';
import { TaskLeaseService } from './task-lease.service';
import { ToolRegistry } from './tool-registry';
import { GetDeviceTool } from './tools/get-device.tool';
import { ListDevicesTool } from './tools/list-devices.tool';
import { SearchDevicesTool } from './tools/search-devices.tool';
import { ListNetworkSitesTool } from './tools/list-network-sites.tool';
import { GetTopologyNeighborsTool } from './tools/get-topology-neighbors.tool';
import { GetTopologyLinkTool } from './tools/get-topology-link.tool';
import { FindTopologyPathTool } from './tools/find-topology-path.tool';
import { GetDeviceTopologyMetricsTool } from './tools/get-device-topology-metrics.tool';
import { GetLinkTopologyMetricsTool } from './tools/get-link-topology-metrics.tool';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DevicesModule,
    TopologyModule,
    ConversationsModule,
    BullModule.registerQueue({ name: AI_TASK_QUEUE }),
  ],
  controllers: [AiTasksController],
  providers: [
    AiTasksService,
    AiTaskProcessor,
    AiTaskEventBus,
    AgentService,
    AgentStepService,
    GetDeviceTool,
    ListDevicesTool,
    SearchDevicesTool,
    ListNetworkSitesTool,
    GetTopologyNeighborsTool,
    GetTopologyLinkTool,
    FindTopologyPathTool,
    GetDeviceTopologyMetricsTool,
    GetLinkTopologyMetricsTool,
    ToolRegistry,
    TaskLeaseService,
    { provide: AI_PROVIDER, useFactory: createAiProvider },
  ],
})
export class AiTasksModule {}

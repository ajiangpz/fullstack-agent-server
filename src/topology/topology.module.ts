import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TopologyController } from './topology.controller';
import { TopologyQueryService } from './topology-query.service';
import { TopologyViewService } from './topology-view.service';
import { TOPOLOGY_QUEUE } from './topology.constants';
import { TopologyGateway } from './topology.gateway';
import { TopologyRealtimeBus } from './topology-realtime-bus';
import { TopologyRealtimeCoordinator } from './topology-realtime.coordinator';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: TOPOLOGY_QUEUE })],
  controllers: [TopologyController],
  providers: [
    TopologyQueryService,
    TopologyViewService,
    TopologyRealtimeBus,
    TopologyRealtimeCoordinator,
    TopologyGateway,
  ],
  exports: [
    TopologyQueryService,
    TopologyViewService,
    TopologyRealtimeCoordinator,
  ],
})
export class TopologyModule {}

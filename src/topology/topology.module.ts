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
import { ManualTopologyDiscoveryProvider } from './manual-topology-discovery.provider';
import { TopologyDiscoveryProviderRegistry } from './topology-discovery-provider.registry';
import { TopologyDiscoveryService } from './topology-discovery.service';
import { TopologyObservationResolver } from './topology-observation-resolver';
import { TopologyProcessor } from './topology.processor';
import { TopologyReconciler } from './topology-reconciler';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: TOPOLOGY_QUEUE })],
  controllers: [TopologyController],
  providers: [
    TopologyQueryService,
    TopologyViewService,
    TopologyRealtimeBus,
    TopologyRealtimeCoordinator,
    TopologyGateway,
    ManualTopologyDiscoveryProvider,
    TopologyDiscoveryProviderRegistry,
    TopologyDiscoveryService,
    TopologyObservationResolver,
    TopologyReconciler,
    TopologyProcessor,
  ],
  exports: [
    TopologyQueryService,
    TopologyViewService,
    TopologyRealtimeCoordinator,
    TopologyDiscoveryService,
  ],
})
export class TopologyModule {}

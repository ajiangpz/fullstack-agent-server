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
import { TopologyMetricsService } from './topology-metrics.service';
import { TopologyAgentService } from './topology-agent.service';

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
    TopologyMetricsService,
    TopologyAgentService,
  ],
  exports: [
    TopologyQueryService,
    TopologyViewService,
    TopologyRealtimeCoordinator,
    TopologyDiscoveryService,
    TopologyMetricsService,
    TopologyAgentService,
  ],
})
export class TopologyModule {}

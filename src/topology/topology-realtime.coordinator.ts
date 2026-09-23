import { Injectable, Logger } from '@nestjs/common';
import { TopologyQueryService } from './topology-query.service';
import { TopologyRealtimeBus } from './topology-realtime-bus';
import {
  createTopologyPatch,
  createTopologyResync,
} from './topology-realtime-events';

@Injectable()
export class TopologyRealtimeCoordinator {
  private readonly logger = new Logger(TopologyRealtimeCoordinator.name);

  constructor(
    private readonly queryService: TopologyQueryService,
    private readonly realtimeBus: TopologyRealtimeBus,
  ) {}

  async recordSiteChange(
    siteId: string,
    baseRevision: number,
    revision: number,
  ): Promise<void> {
    try {
      const previous = await this.realtimeBus.getSnapshot(siteId);
      const next = await this.queryService.buildSiteSnapshot(siteId, false);

      const event =
        next.revision !== revision
          ? createTopologyResync(siteId, next.revision, 'concurrent-change')
          : previous?.revision === baseRevision
            ? createTopologyPatch(previous, next) ??
              createTopologyResync(siteId, next.revision, 'revision-gap')
            : createTopologyResync(
                siteId,
                next.revision,
                previous ? 'revision-gap' : 'snapshot-miss',
              );

      await this.realtimeBus.publishSnapshotAndEvent(next, event);
    } catch (error) {
      this.logger.warn(
        'Unable to publish topology change for site ' +
          siteId +
          ': ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }
}

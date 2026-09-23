import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TopologyController } from './topology.controller';
import { TopologyQueryService } from './topology-query.service';
import { TopologyViewService } from './topology-view.service';

@Module({
  imports: [AuthModule],
  controllers: [TopologyController],
  providers: [TopologyQueryService, TopologyViewService],
  exports: [TopologyQueryService, TopologyViewService],
})
export class TopologyModule {}

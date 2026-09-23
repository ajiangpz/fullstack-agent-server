import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TopologyController } from './topology.controller';
import { TopologyQueryService } from './topology-query.service';

@Module({
  imports: [AuthModule],
  controllers: [TopologyController],
  providers: [TopologyQueryService],
  exports: [TopologyQueryService],
})
export class TopologyModule {}

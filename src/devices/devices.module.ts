import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DomainEventsModule } from '../events/domain-events.module';
import { TopologyModule } from '../topology/topology.module';

@Module({
  imports: [PrismaModule, AuthModule, DomainEventsModule, TopologyModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}

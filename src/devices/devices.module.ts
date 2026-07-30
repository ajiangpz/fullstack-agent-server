import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DomainEventsModule } from '../events/domain-events.module';

@Module({
  imports: [PrismaModule, AuthModule, DomainEventsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}

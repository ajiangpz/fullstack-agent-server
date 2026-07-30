import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { DomainEventsModule } from './events/domain-events.module';

@Module({
  imports: [
    DomainEventsModule,
    PrismaModule,
    DevicesModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { DomainEventsModule } from './events/domain-events.module';
import { BullModule } from '@nestjs/bullmq';
import { AiTasksModule } from './ai-tasks/ai-tasks.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    DomainEventsModule,
    PrismaModule,
    DevicesModule,
    AuthModule,
    AuditModule,
    AiTasksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

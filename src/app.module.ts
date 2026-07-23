import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DevicesModule } from './devices/devices.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, DevicesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

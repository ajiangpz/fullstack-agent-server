import 'dotenv/config';

import { Module } from '@nestjs/common';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { DomainEventsModule } from '../events/domain-events.module';

const createJwtOptions = (): JwtModuleOptions => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return {
    secret,
    signOptions: {
      algorithm: 'HS256',
      expiresIn: (process.env.JWT_EXPIRES_IN ??
        '1h') as JwtSignOptions['expiresIn'],
    },
  };
};

@Module({
  imports: [
    DomainEventsModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({ useFactory: createJwtOptions }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

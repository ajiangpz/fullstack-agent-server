import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PublicUser, UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction } from '../generated/prisma/enums';
import { DOMAIN_EVENT_NAME, DomainEvent } from '../events/domain-event';

const scryptAsync = promisify(scrypt);

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    const conflict = await this.usersService.findRegistrationConflict(
      username,
      email,
    );

    if (conflict?.username === username) {
      throw new ConflictException(`Username "${username}" already exists`);
    }

    if (conflict?.email === email) {
      throw new ConflictException(`Email "${email}" already exists`);
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.usersService.create({
      username,
      email,
      passwordHash,
      displayName: dto.displayName?.trim() || null,
    });

    this.eventEmitter.emit(
      DOMAIN_EVENT_NAME,
      new DomainEvent({
        action: AuditAction.USER_REGISTERED,
        resourceType: 'user',
        resourceId: String(user.id),
        actorId: user.id,
        metadata: { username: user.username, email: user.email },
      }),
    );

    return user;
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await this.verifyPassword(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
    const publicUser = await this.usersService.recordLogin(user.id);

    this.eventEmitter.emit(
      DOMAIN_EVENT_NAME,
      new DomainEvent({
        action: AuditAction.USER_LOGGED_IN,
        resourceType: 'user',
        resourceId: String(user.id),
        actorId: user.id,
      }),
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      user: publicUser,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const [algorithm, saltHex, keyHex] = passwordHash.split('$');

    if (
      algorithm !== 'scrypt' ||
      !/^[0-9a-f]{32}$/i.test(saltHex ?? '') ||
      !/^[0-9a-f]{128}$/i.test(keyHex ?? '')
    ) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    return timingSafeEqual(derivedKey, expectedKey);
  }
}

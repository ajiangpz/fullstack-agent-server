import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PublicUser, UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const scryptAsync = promisify(scrypt);

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

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

    return this.usersService.create({
      username,
      email,
      passwordHash,
      displayName: dto.displayName?.trim() || null,
    });
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await this.verifyPassword(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.usersService.recordLogin(user.id);
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

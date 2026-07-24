import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PublicUser, UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

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

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }
}
  
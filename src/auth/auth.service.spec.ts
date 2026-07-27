import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes, scryptSync } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findRegistrationConflict: jest.Mock;
    findByEmail: jest.Mock;
    recordLogin: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findRegistrationConflict: jest.fn(),
      findByEmail: jest.fn(),
      recordLogin: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register a user with a hashed password', async () => {
    const now = new Date();
    const publicUser = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    usersService.findRegistrationConflict.mockResolvedValue(null);
    usersService.create.mockResolvedValue(publicUser);

    await expect(
      service.register({
        username: ' alice ',
        email: ' Alice@Example.com ',
        password: 'StrongPassword123',
        displayName: ' Alice ',
      }),
    ).resolves.toEqual(publicUser);

    expect(usersService.create).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: expect.stringMatching(
        /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/,
      ) as string,
      displayName: 'Alice',
    });
  });

  it('should reject a duplicate username', async () => {
    usersService.findRegistrationConflict.mockResolvedValue({
      username: 'alice',
      email: 'another@example.com',
    });

    await expect(
      service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'StrongPassword123',
      }),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('should reject a duplicate email', async () => {
    usersService.findRegistrationConflict.mockResolvedValue({
      username: 'another',
      email: 'alice@example.com',
    });

    await expect(
      service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'StrongPassword123',
      }),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('should authenticate an active user and record the login', async () => {
    const now = new Date();
    const password = 'StrongPassword123';
    const salt = randomBytes(16);
    const passwordHash = `scrypt$${salt.toString('hex')}$${scryptSync(
      password,
      salt,
      64,
    ).toString('hex')}`;
    const publicUser = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };
    usersService.findByEmail.mockResolvedValue({
      ...publicUser,
      passwordHash,
    });
    usersService.recordLogin.mockResolvedValue(publicUser);
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');

    await expect(
      service.login({ email: ' Alice@Example.com ', password }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      user: publicUser,
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      username: 'alice',
      email: 'alice@example.com',
      role: 'USER',
    });
    expect(usersService.recordLogin).toHaveBeenCalledWith(1);
  });

  it('should reject an unknown email address', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'alice@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.recordLogin).not.toHaveBeenCalled();
  });

  it('should reject an incorrect password', async () => {
    const salt = randomBytes(16);
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: `scrypt$${salt.toString('hex')}$${scryptSync(
        'correct-password',
        salt,
        64,
      ).toString('hex')}`,
      displayName: 'Alice',
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.login({ email: 'alice@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.recordLogin).not.toHaveBeenCalled();
  });

  it('should reject a disabled user', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      passwordHash:
        'scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      displayName: 'Alice',
      role: 'USER',
      status: 'DISABLED',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.login({ email: 'alice@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.recordLogin).not.toHaveBeenCalled();
  });
});

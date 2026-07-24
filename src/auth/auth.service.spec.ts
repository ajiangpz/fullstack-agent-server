import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findRegistrationConflict: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findRegistrationConflict: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
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
});

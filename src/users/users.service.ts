import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PublicUser = Omit<User, 'passwordHash'>;

export type LoginUser = Pick<
  User,
  | 'id'
  | 'username'
  | 'email'
  | 'passwordHash'
  | 'displayName'
  | 'role'
  | 'status'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findRegistrationConflict(
    username: string,
    email: string,
  ): Promise<Pick<User, 'username' | 'email'> | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: {
        username: true,
        email: true,
      },
    });
  }

  findByEmail(email: string): Promise<LoginUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        displayName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  recordLogin(id: number): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Username or email already exists');
      }

      throw error;
    }
  }
}

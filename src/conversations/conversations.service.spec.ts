import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  const user: AuthenticatedUser = {
    id: 7,
    username: 'user',
    email: 'user@example.com',
    role: UserRole.USER,
  };
  const prisma = {
    conversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  let service: ConversationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationsService(prisma as unknown as PrismaService);
  });

  it('creates conversations for the authenticated user', async () => {
    prisma.conversation.create.mockResolvedValue({
      id: 'conv-1',
      ownerId: user.id,
      busy: false,
    });

    await service.create(user);

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { ownerId: user.id },
      select: {
        id: true,
        busy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('returns only owner-scoped conversations and active task id', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      busy: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      tasks: [{ id: 'task-1' }],
    });

    const result = await service.getMessages('conv-1', user);

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1', ownerId: user.id },
      }),
    );
    expect(result.activeTaskId).toBe('task-1');
  });

  it('does not grant administrators cross-owner conversation access', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    const admin = { ...user, role: UserRole.ADMIN };

    await expect(service.getMessages('conv-1', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1', ownerId: admin.id },
      }),
    );
  });
});

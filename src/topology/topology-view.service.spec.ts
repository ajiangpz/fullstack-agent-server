import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveTopologyViewDto } from './dto/topology-view.dto';
import { TopologyViewService } from './topology-view.service';

describe('TopologyViewService', () => {
  let service: TopologyViewService;
  let prisma: any;
  let tx: any;

  const user: AuthenticatedUser = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  const dto: SaveTopologyViewDto = {
    expectedRevision: 0,
    topologyRevision: 7,
    viewport: { x: 10, y: 20, zoom: 1.2 },
    nodes: [
      { nodeId: 'device:12', x: 100, y: 200 },
      { nodeId: 'device:18', x: 300, y: 400 },
    ],
  };

  beforeEach(async () => {
    tx = {
      networkSite: { findFirst: jest.fn().mockResolvedValue({ id: 'site-2' }) },
      device: { findMany: jest.fn().mockResolvedValue([{ id: 12 }, { id: 18 }]) },
      topologyView: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      topologyViewNode: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    prisma = {
      networkSite: { findFirst: jest.fn().mockResolvedValue({ id: 'site-2' }) },
      topologyView: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyViewService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(TopologyViewService);
  });

  it('returns an empty view when the user has no persisted layout', async () => {
    prisma.topologyView.findUnique.mockResolvedValue(null);
    await expect(service.getView('site-2', user)).resolves.toEqual({
      schemaVersion: 1,
      siteId: 'site-2',
      viewId: null,
      revision: 0,
      topologyRevision: null,
      viewport: null,
      nodes: [],
      updatedAt: null,
    });
  });

  it('hides inaccessible sites', async () => {
    prisma.networkSite.findFirst.mockResolvedValue(null);
    await expect(service.getView('foreign-site', user)).rejects.toThrow(NotFoundException);
  });

  it('creates the first layout at revision 1', async () => {
    tx.topologyView.findUnique.mockResolvedValue(null);
    tx.topologyView.create.mockResolvedValue({ id: 'view-1' });
    tx.topologyView.findUniqueOrThrow.mockResolvedValue({
      id: 'view-1', revision: 1, topologyRevision: 7,
      viewportX: 10, viewportY: 20, zoom: 1.2,
      updatedAt: new Date('2026-09-23T08:00:00.000Z'), nodes: dto.nodes,
    });

    const result = await service.saveView('site-2', dto, user);
    expect(tx.topologyView.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ siteId: 'site-2', ownerId: user.id, revision: 1 }),
    }));
    expect(tx.topologyViewNode.createMany).toHaveBeenCalledWith({
      data: dto.nodes.map((node) => ({ viewId: 'view-1', ...node })),
    });
    expect(result.revision).toBe(1);
  });

  it('uses compare-and-swap when updating an existing layout', async () => {
    tx.topologyView.findUnique.mockResolvedValue({ id: 'view-1', revision: 3 });
    tx.topologyView.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.saveView('site-2', { ...dto, expectedRevision: 2 }, user)).rejects.toThrow(ConflictException);
  });

  it('rejects a layout that does not match the current topology node set', async () => {
    await expect(service.saveView('site-2', { ...dto, nodes: dto.nodes.slice(0, 1) }, user)).rejects.toThrow(ConflictException);
    expect(tx.topologyView.create).not.toHaveBeenCalled();
  });
});

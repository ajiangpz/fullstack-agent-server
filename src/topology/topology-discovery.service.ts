import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOPOLOGY_DISCOVERY_JOB,
  TOPOLOGY_QUEUE,
} from './topology.constants';
import {
  CreateTopologyDiscoveryDto,
  TopologyDiscoveryRunDto,
} from './dto/topology-discovery.dto';
import { TopologyDiscoveryProviderRegistry } from './topology-discovery-provider.registry';

@Injectable()
export class TopologyDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: TopologyDiscoveryProviderRegistry,
    @InjectQueue(TOPOLOGY_QUEUE) private readonly queue: Queue,
  ) {}

  async create(
    siteId: string,
    dto: CreateTopologyDiscoveryDto,
    user: AuthenticatedUser,
  ): Promise<TopologyDiscoveryRunDto> {
    await this.requireAccessibleSite(siteId, user);
    this.providers.get(dto.source);

    const run = await this.prisma.discoveryRun.create({
      data: {
        siteId,
        requestedById: user.id,
        source: dto.source,
        requestPayload: dto.observations
          ? ({
              observations: dto.observations,
            } as Prisma.InputJsonValue)
          : undefined,
      },
    });

    try {
      await this.queue.add(
        TOPOLOGY_DISCOVERY_JOB,
        { runId: run.id },
        {
          jobId: 'discovery-' + run.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 86_400, count: 5_000 },
        },
      );
    } catch {
      const failed = await this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Discovery job could not be queued',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'Topology discovery queue is unavailable: ' + failed.id,
      );
    }

    return this.toDto(run);
  }

  async findOne(
    siteId: string,
    runId: string,
    user: AuthenticatedUser,
  ): Promise<TopologyDiscoveryRunDto> {
    await this.requireAccessibleSite(siteId, user);

    const run = await this.prisma.discoveryRun.findFirst({
      where: { id: runId, siteId },
    });
    if (!run) {
      throw new NotFoundException('Discovery run ' + runId + ' not found');
    }
    return this.toDto(run);
  }

  private async requireAccessibleSite(
    siteId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const site = await this.prisma.networkSite.findFirst({
      where: {
        id: siteId,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.id }),
      },
      select: { id: true },
    });
    if (!site) {
      throw new NotFoundException('Network site ' + siteId + ' not found');
    }
  }

  private toDto(run: {
    id: string;
    siteId: string;
    requestedById: number | null;
    source: TopologyDiscoveryRunDto['source'];
    status: TopologyDiscoveryRunDto['status'];
    observationCount: number;
    resolvedObservationCount: number;
    reconciledLinkCount: number;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TopologyDiscoveryRunDto {
    return {
      id: run.id,
      siteId: run.siteId,
      requestedById: run.requestedById,
      source: run.source,
      status: run.status,
      observationCount: run.observationCount,
      resolvedObservationCount: run.resolvedObservationCount,
      reconciledLinkCount: run.reconciledLinkCount,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}

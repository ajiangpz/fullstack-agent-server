import {
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOPOLOGY_DISCOVERY_JOB,
  TOPOLOGY_QUEUE,
  TOPOLOGY_RECONCILE_JOB,
} from './topology.constants';
import { TopologyDiscoveryProviderRegistry } from './topology-discovery-provider.registry';
import { TopologyObservationResolver } from './topology-observation-resolver';
import { TopologyReconciler } from './topology-reconciler';

interface TopologyJobData {
  runId: string;
}

const MAX_PROVIDER_OBSERVATIONS = 5_000;

@Processor(TOPOLOGY_QUEUE, { concurrency: 1 })
export class TopologyProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: TopologyDiscoveryProviderRegistry,
    private readonly resolver: TopologyObservationResolver,
    private readonly reconciler: TopologyReconciler,
    @InjectQueue(TOPOLOGY_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<TopologyJobData, void, string>): Promise<void> {
    if (job.name === TOPOLOGY_DISCOVERY_JOB) {
      await this.processDiscovery(job);
      return;
    }
    if (job.name === TOPOLOGY_RECONCILE_JOB) {
      await this.processReconciliation(job);
      return;
    }
    throw new Error('Unsupported topology job type: ' + job.name);
  }

  private async processDiscovery(
    job: Job<TopologyJobData, void, string>,
  ): Promise<void> {
    const run = await this.prisma.discoveryRun.findUnique({
      where: { id: job.data.runId },
      select: {
        id: true,
        siteId: true,
        source: true,
        status: true,
        requestPayload: true,
        startedAt: true,
      },
    });
    if (!run || run.status === 'FAILED' || run.status === 'COMPLETED') return;

    if (run.status === 'RECONCILING') {
      await this.enqueueReconcile(run.id);
      return;
    }

    await this.prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'DISCOVERING',
        startedAt: run.startedAt ?? new Date(),
        errorMessage: null,
      },
    });

    try {
      const provider = this.providers.get(run.source);
      const observations = await provider.discover({
        runId: run.id,
        siteId: run.siteId,
        requestPayload: run.requestPayload,
      });
      if (observations.length > MAX_PROVIDER_OBSERVATIONS) {
        throw new Error(
          'Discovery provider returned too many observations',
        );
      }

      const resolved = await this.resolver.resolve(
        run.id,
        run.siteId,
        run.source,
        observations,
      );
      const resolvedCount = resolved.filter(
        (observation) => !observation.resolutionError,
      ).length;

      await this.prisma.$transaction(async (tx) => {
        await tx.topologyObservation.deleteMany({
          where: { runId: run.id },
        });
        if (resolved.length > 0) {
          await tx.topologyObservation.createMany({ data: resolved });
        }
        await tx.discoveryRun.update({
          where: { id: run.id },
          data: {
            status: 'RECONCILING',
            observationCount: resolved.length,
            resolvedObservationCount: resolvedCount,
            errorMessage: null,
          },
        });
      });

      await this.enqueueReconcile(run.id);
    } catch (error) {
      await this.handleFailure(job, run.id, error, 'PENDING');
      throw error;
    }
  }

  private async processReconciliation(
    job: Job<TopologyJobData, void, string>,
  ): Promise<void> {
    const run = await this.prisma.discoveryRun.findUnique({
      where: { id: job.data.runId },
      select: { id: true, status: true },
    });
    if (!run || run.status === 'FAILED' || run.status === 'COMPLETED') return;

    try {
      await this.reconciler.reconcile(run.id);
    } catch (error) {
      await this.handleFailure(job, run.id, error, 'RECONCILING');
      throw error;
    }
  }

  private async enqueueReconcile(runId: string): Promise<void> {
    await this.queue.add(
      TOPOLOGY_RECONCILE_JOB,
      { runId },
      {
        jobId: 'reconcile-' + runId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 86_400, count: 5_000 },
      },
    );
  }

  private async handleFailure(
    job: Job<TopologyJobData, void, string>,
    runId: string,
    error: unknown,
    retryStatus: 'PENDING' | 'RECONCILING',
  ): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    const finalAttempt = job.attemptsMade + 1 >= maxAttempts;
    await this.prisma.discoveryRun.updateMany({
      where: {
        id: runId,
        status: { notIn: ['COMPLETED', 'FAILED'] },
      },
      data: {
        status: finalAttempt ? 'FAILED' : retryStatus,
        errorMessage: this.errorMessage(error),
        completedAt: finalAttempt ? new Date() : null,
      },
    });
  }

  private errorMessage(error: unknown): string {
    return (
      error instanceof Error ? error.message : 'Unknown discovery error'
    ).slice(0, 2_000);
  }
}

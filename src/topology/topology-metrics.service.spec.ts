import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { MetricSource, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TopologyMetricsRange } from './dto/topology-metrics.dto';
import { TopologyMetricsService } from './topology-metrics.service';

describe('TopologyMetricsService', () => {
  let service: TopologyMetricsService;
  const prisma: any = {
    networkSite: { findFirst: jest.fn() },
    device: { findMany: jest.fn(), findFirst: jest.fn() },
    topologyLink: { findMany: jest.fn(), findFirst: jest.fn() },
    deviceMetricSample: { createMany: jest.fn() },
    topologyLinkMetricSample: { createMany: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const user: AuthenticatedUser = {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    role: UserRole.USER,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.networkSite.findFirst.mockResolvedValue({ id: 'site-1' });
    prisma.device.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.topologyLink.findMany.mockResolvedValue([{ id: 'link-1' }]);
    prisma.deviceMetricSample.createMany.mockResolvedValue({ count: 1 });
    prisma.topologyLinkMetricSample.createMany.mockResolvedValue({ count: 1 });
    prisma.$transaction = jest.fn(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyMetricsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TopologyMetricsService);
  });

  it('ingests immutable device and link metric samples idempotently', async () => {
    const result = await service.ingest('site-1', {
      source: MetricSource.SNMP,
      devices: [
        {
          deviceId: 1,
          sampledAt: '2026-09-23T12:00:00.000Z',
          rxBitsPerSecond: 1000,
        },
      ],
      links: [
        {
          linkId: 'link-1',
          sampledAt: '2026-09-23T12:00:00.000Z',
          utilizationPercent: 35,
        },
      ],
    });

    expect(prisma.deviceMetricSample.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(prisma.topologyLinkMetricSample.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(result).toEqual({
      acceptedDeviceSamples: 1,
      acceptedLinkSamples: 1,
    });
  });

  it('rejects a metric sample without metric values', async () => {
    await expect(
      service.ingest('site-1', {
        source: MetricSource.MANUAL,
        devices: [
          {
            deviceId: 1,
            sampledAt: '2026-09-23T12:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects targets that do not belong to the site', async () => {
    prisma.device.findMany.mockResolvedValue([]);

    await expect(
      service.ingest('site-1', {
        source: MetricSource.SNMP,
        devices: [
          {
            deviceId: 99,
            sampledAt: '2026-09-23T12:00:00.000Z',
            rxBitsPerSecond: 100,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('queries downsampled device metrics after ownership checks', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 1 });
    prisma.$queryRaw.mockResolvedValue([
      {
        sampledAt: new Date('2026-09-23T12:00:00.000Z'),
        rxBitsPerSecond: 100,
        txBitsPerSecond: 200,
        cpuPercent: 30,
        memoryPercent: 40,
        temperatureCelsius: 50,
      },
    ]);

    const result = await service.getDeviceSeries(
      'site-1',
      1,
      { range: TopologyMetricsRange.ONE_HOUR, points: 60 },
      user,
    );

    expect(result.deviceId).toBe(1);
    expect(result.range).toBe(TopologyMetricsRange.ONE_HOUR);
    expect(result.points[0].sampledAt).toBe(
      '2026-09-23T12:00:00.000Z',
    );
  });

  it('hides metrics for inaccessible sites', async () => {
    prisma.networkSite.findFirst.mockResolvedValue(null);

    await expect(
      service.getDeviceSeries('foreign-site', 1, {}, user),
    ).rejects.toThrow(NotFoundException);
  });
});

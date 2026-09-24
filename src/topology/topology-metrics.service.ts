import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeviceMetricIngestSampleDto,
  DeviceMetricsSeriesDto,
  IngestTopologyMetricsDto,
  TopologyLinkMetricIngestSampleDto,
  TopologyLinkMetricsSeriesDto,
  TopologyMetricsIngestResultDto,
  TopologyMetricsQueryDto,
  TopologyMetricsRange,
} from './dto/topology-metrics.dto';

const RANGE_MS: Record<TopologyMetricsRange, number> = {
  [TopologyMetricsRange.ONE_HOUR]: 60 * 60 * 1000,
  [TopologyMetricsRange.SIX_HOURS]: 6 * 60 * 60 * 1000,
  [TopologyMetricsRange.TWENTY_FOUR_HOURS]: 24 * 60 * 60 * 1000,
  [TopologyMetricsRange.SEVEN_DAYS]: 7 * 24 * 60 * 60 * 1000,
};

interface DeviceMetricRow {
  sampledAt: Date;
  rxBitsPerSecond: number | null;
  txBitsPerSecond: number | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  temperatureCelsius: number | null;
}

interface LinkMetricRow {
  sampledAt: Date;
  aToZBitsPerSecond: number | null;
  zToABitsPerSecond: number | null;
  utilizationPercent: number | null;
  errorRatePercent: number | null;
  packetLossPercent: number | null;
}

@Injectable()
export class TopologyMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    siteId: string,
    dto: IngestTopologyMetricsDto,
  ): Promise<TopologyMetricsIngestResultDto> {
    const deviceSamples = dto.devices ?? [];
    const linkSamples = dto.links ?? [];

    if (deviceSamples.length + linkSamples.length === 0) {
      throw new BadRequestException(
        'At least one device or topology link metric sample is required',
      );
    }

    this.validateDeviceSamples(deviceSamples);
    this.validateLinkSamples(linkSamples);

    const deviceIds = [
      ...new Set(deviceSamples.map((sample) => sample.deviceId)),
    ];
    const linkIds = [...new Set(linkSamples.map((sample) => sample.linkId))];

    const [devices, links] = await Promise.all([
      deviceIds.length > 0
        ? this.prisma.device.findMany({
            where: { siteId, id: { in: deviceIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      linkIds.length > 0
        ? this.prisma.topologyLink.findMany({
            where: { siteId, id: { in: linkIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (devices.length !== deviceIds.length) {
      throw new BadRequestException(
        'One or more device metric targets are not in this site',
      );
    }
    if (links.length !== linkIds.length) {
      throw new BadRequestException(
        'One or more link metric targets are not in this site',
      );
    }

    const [deviceResult, linkResult] = await this.prisma.$transaction([
      this.prisma.deviceMetricSample.createMany({
        data: deviceSamples.map((sample) => ({
          ...sample,
          source: dto.source,
          sampledAt: new Date(sample.sampledAt),
        })),
        skipDuplicates: true,
      }),
      this.prisma.topologyLinkMetricSample.createMany({
        data: linkSamples.map((sample) => ({
          ...sample,
          source: dto.source,
          sampledAt: new Date(sample.sampledAt),
        })),
        skipDuplicates: true,
      }),
    ]);

    return {
      acceptedDeviceSamples: deviceResult.count,
      acceptedLinkSamples: linkResult.count,
    };
  }

  async getDeviceSeries(
    siteId: string,
    deviceId: number,
    query: TopologyMetricsQueryDto,
    user: AuthenticatedUser,
  ): Promise<DeviceMetricsSeriesDto> {
    await this.requireAccessibleSite(siteId, user);

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, siteId },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException('Device ' + deviceId + ' not found');
    }

    const window = this.window(query);
    const rows = await this.prisma.$queryRaw<DeviceMetricRow[]>(Prisma.sql`
      SELECT
        date_bin(
          make_interval(secs => ${window.bucketSeconds}),
          "sampledAt",
          TIMESTAMP '1970-01-01'
        ) AS "sampledAt",
        AVG("rxBitsPerSecond") AS "rxBitsPerSecond",
        AVG("txBitsPerSecond") AS "txBitsPerSecond",
        AVG("cpuPercent") AS "cpuPercent",
        AVG("memoryPercent") AS "memoryPercent",
        AVG("temperatureCelsius") AS "temperatureCelsius"
      FROM "device_metric_samples"
      WHERE "deviceId" = ${deviceId}
        AND "sampledAt" >= ${window.from}
        AND "sampledAt" <= ${window.to}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      deviceId,
      range: window.range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      points: rows.map((row) => ({
        ...row,
        sampledAt: row.sampledAt.toISOString(),
      })),
    };
  }

  async getLinkSeries(
    siteId: string,
    linkId: string,
    query: TopologyMetricsQueryDto,
    user: AuthenticatedUser,
  ): Promise<TopologyLinkMetricsSeriesDto> {
    await this.requireAccessibleSite(siteId, user);

    const link = await this.prisma.topologyLink.findFirst({
      where: { id: linkId, siteId },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('Topology link ' + linkId + ' not found');
    }

    const window = this.window(query);
    const rows = await this.prisma.$queryRaw<LinkMetricRow[]>(Prisma.sql`
      SELECT
        date_bin(
          make_interval(secs => ${window.bucketSeconds}),
          "sampledAt",
          TIMESTAMP '1970-01-01'
        ) AS "sampledAt",
        AVG("aToZBitsPerSecond") AS "aToZBitsPerSecond",
        AVG("zToABitsPerSecond") AS "zToABitsPerSecond",
        AVG("utilizationPercent") AS "utilizationPercent",
        AVG("errorRatePercent") AS "errorRatePercent",
        AVG("packetLossPercent") AS "packetLossPercent"
      FROM "topology_link_metric_samples"
      WHERE "linkId" = ${linkId}
        AND "sampledAt" >= ${window.from}
        AND "sampledAt" <= ${window.to}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      linkId,
      range: window.range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      points: rows.map((row) => ({
        ...row,
        sampledAt: row.sampledAt.toISOString(),
      })),
    };
  }

  private window(query: TopologyMetricsQueryDto) {
    const range = query.range ?? TopologyMetricsRange.SIX_HOURS;
    const points = query.points ?? 180;
    const durationMs = RANGE_MS[range];
    const to = new Date();
    const from = new Date(to.getTime() - durationMs);
    const bucketSeconds = Math.max(
      1,
      Math.ceil(durationMs / 1000 / points),
    );

    return { range, from, to, bucketSeconds };
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

  private validateDeviceSamples(
    samples: DeviceMetricIngestSampleDto[],
  ): void {
    for (const sample of samples) {
      if (
        sample.rxBitsPerSecond === undefined &&
        sample.txBitsPerSecond === undefined &&
        sample.cpuPercent === undefined &&
        sample.memoryPercent === undefined &&
        sample.temperatureCelsius === undefined
      ) {
        throw new BadRequestException(
          'Each device metric sample must contain at least one metric',
        );
      }
    }
  }

  private validateLinkSamples(
    samples: TopologyLinkMetricIngestSampleDto[],
  ): void {
    for (const sample of samples) {
      if (
        sample.aToZBitsPerSecond === undefined &&
        sample.zToABitsPerSecond === undefined &&
        sample.utilizationPercent === undefined &&
        sample.errorRatePercent === undefined &&
        sample.packetLossPercent === undefined
      ) {
        throw new BadRequestException(
          'Each link metric sample must contain at least one metric',
        );
      }
    }
  }
}

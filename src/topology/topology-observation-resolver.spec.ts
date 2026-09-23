import { Test, TestingModule } from '@nestjs/testing';
import {
  DiscoverySource,
  TopologyLinkStatus,
  TopologyLinkType,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TopologyObservationResolver } from './topology-observation-resolver';

describe('TopologyObservationResolver', () => {
  let resolver: TopologyObservationResolver;
  const prisma = {
    device: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyObservationResolver,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    resolver = module.get(TopologyObservationResolver);
  });

  it('resolves site devices and canonicalizes endpoint order', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 9,
        ip: '10.0.0.1',
        macAddress: '00:11:22:33:44:99',
        ports: [{ id: 90, name: 'WAN', ifIndex: 1 }],
      },
      {
        id: 2,
        ip: '10.0.0.2',
        macAddress: '00:11:22:33:44:22',
        ports: [{ id: 20, name: 'GE1', ifIndex: 10 }],
      },
    ]);

    const [resolved] = await resolver.resolve(
      'run-1',
      'site-1',
      DiscoverySource.MANUAL,
      [
        {
          localDeviceId: 9,
          localPortId: 90,
          remoteDeviceId: 2,
          remotePortId: 20,
          linkType: TopologyLinkType.ETHERNET,
          status: TopologyLinkStatus.UP,
          speedMbps: 1000,
          confidence: 1,
          observedAt: new Date('2026-09-23T00:00:00.000Z'),
        },
      ],
    );

    expect(resolved).toMatchObject({
      aDeviceId: 2,
      aPortId: 20,
      zDeviceId: 9,
      zPortId: 90,
      canonicalKey: 'device:2:port:20--device:9:port:90',
      resolutionError: null,
      expiresAt: null,
    });
  });

  it('keeps unresolved evidence without producing a canonical key', async () => {
    prisma.device.findMany.mockResolvedValue([
      {
        id: 1,
        ip: '10.0.0.1',
        macAddress: null,
        ports: [],
      },
    ]);

    const [resolved] = await resolver.resolve(
      'run-1',
      'site-1',
      DiscoverySource.LLDP,
      [
        {
          localDeviceId: 1,
          remoteManagementIp: '10.0.0.99',
          remoteChassisId: 'remote-chassis',
          linkType: TopologyLinkType.ETHERNET,
          status: TopologyLinkStatus.UP,
          confidence: 0.8,
          observedAt: new Date('2026-09-23T00:00:00.000Z'),
        },
      ],
    );

    expect(resolved.canonicalKey).toBeNull();
    expect(resolved.resolutionError).toContain(
      'Remote device could not be resolved',
    );
    expect(resolved.expiresAt).toBeInstanceOf(Date);
  });
});

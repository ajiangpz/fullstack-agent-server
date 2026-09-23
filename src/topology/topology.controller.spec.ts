import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TopologyController } from './topology.controller';
import { TopologyQueryService } from './topology-query.service';
import { TopologyViewService } from './topology-view.service';
import { TopologyDiscoveryService } from './topology-discovery.service';

describe('TopologyController', () => {
  let controller: TopologyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopologyController],
      providers: [
        {
          provide: TopologyQueryService,
          useValue: {},
        },
        {
          provide: TopologyViewService,
          useValue: {},
        },
        {
          provide: TopologyDiscoveryService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TopologyController>(TopologyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each([
    'listSites',
    'getTopology',
    'getTopologyView',
    'saveTopologyView',
    'createTopologyDiscovery',
    'getTopologyDiscovery',
  ] as const)(
    'allows authenticated users to call %s so ownership is enforced in the service',
    (method) => {
      expect(
        Reflect.getMetadata('roles', TopologyController.prototype[method]),
      ).toBeUndefined();
    },
  );
});

import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TopologyController } from './topology.controller';
import { TopologyQueryService } from './topology-query.service';

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

  it.each(['listSites', 'getTopology'] as const)(
    'allows authenticated users to call %s so ownership is enforced in the service',
    (method) => {
      expect(
        Reflect.getMetadata('roles', TopologyController.prototype[method]),
      ).toBeUndefined();
    },
  );
});

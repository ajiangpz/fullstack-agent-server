import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  let controller: DevicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['create', 'update', 'remove'] as const)(
    'restricts %s to administrators',
    (method) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, DevicesController.prototype[method]),
      ).toEqual([UserRole.ADMIN]);
    },
  );

  it.each(['findAll', 'findOne'] as const)(
    'allows any authenticated role to call %s',
    (method) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, DevicesController.prototype[method]),
      ).toBeUndefined();
    },
  );
});

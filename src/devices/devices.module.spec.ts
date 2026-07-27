import { Test, TestingModule } from '@nestjs/testing';
import { DevicesModule } from './devices.module';

describe('DevicesModule', () => {
  it('resolves the authentication guard dependencies', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DevicesModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});

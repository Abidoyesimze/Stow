import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavingsModule } from './savings.module';
import { SavingsController } from './savings.controller';
import { AnchorDeposit } from './entities/anchor-deposit.entity';
import { Balance } from './entities/balance.entity';

describe('SavingsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SavingsModule],
    })
      .overrideProvider(getRepositoryToken(AnchorDeposit))
      .useValue({})
      .overrideProvider(getRepositoryToken(Balance))
      .useValue({})
      .compile();
  });

  it('compiles', () => {
    expect(module).toBeDefined();
  });

  it('boots with a controller that responds on the ping route', () => {
    const controller = module.get<SavingsController>(SavingsController);
    expect(controller.ping()).toEqual({ status: 'ok' });
  });
});

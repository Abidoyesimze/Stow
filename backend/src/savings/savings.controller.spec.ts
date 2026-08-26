import { Test, TestingModule } from '@nestjs/testing';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

describe('SavingsController', () => {
  let controller: SavingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [SavingsService],
    }).compile();

    controller = module.get<SavingsController>(SavingsController);
  });

  describe('ping', () => {
    it('responds with an ok status', () => {
      expect(controller.ping()).toEqual({ status: 'ok' });
    });
  });
});

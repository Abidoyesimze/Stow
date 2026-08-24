import { Test, TestingModule } from '@nestjs/testing';
import { AnchorController } from './anchor.controller';
import { AnchorService } from './anchor.service';
import { User } from '../users/entities/user.entity';

describe('AnchorController', () => {
  let controller: AnchorController;
  let anchorService: { initiateDeposit: jest.Mock };

  const mockUser = { id: 'user-uuid-1' } as User;
  const dto = { asset_code: 'USDC', account: 'GSTELLAR_ACCOUNT' };

  beforeEach(async () => {
    anchorService = {
      initiateDeposit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnchorController],
      providers: [
        {
          provide: AnchorService,
          useValue: anchorService,
        },
      ],
    }).compile();

    controller = module.get<AnchorController>(AnchorController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeposit', () => {
    it('delegates to AnchorService and returns the result', async () => {
      const serviceResult = {
        deposit_id: 'deposit-uuid-1',
        transaction_id: 'txn-id-001',
        interactive_url:
          'https://anchor.example.com/sep24/transactions/deposit?token=abc123',
      };

      anchorService.initiateDeposit.mockResolvedValue(serviceResult);

      const result = await controller.initiateDeposit(mockUser, dto);

      expect(anchorService.initiateDeposit).toHaveBeenCalledWith(
        mockUser.id,
        dto,
      );
      expect(result).toBe(serviceResult);
    });

    it('propagates errors thrown by AnchorService', async () => {
      const error = new Error('Anchor unavailable');
      anchorService.initiateDeposit.mockRejectedValue(error);

      await expect(controller.initiateDeposit(mockUser, dto)).rejects.toThrow(
        'Anchor unavailable',
      );
    });
  });
});

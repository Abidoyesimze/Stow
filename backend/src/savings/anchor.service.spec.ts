import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnchorService } from './anchor.service';
import { AnchorDeposit } from './entities/anchor-deposit.entity';

describe('AnchorService', () => {
  let service: AnchorService;
  let depositRepo: Repository<AnchorDeposit>;

  const mockDepositRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnchorService,
        {
          provide: getRepositoryToken(AnchorDeposit),
          useValue: mockDepositRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AnchorService>(AnchorService);
    depositRepo = module.get<Repository<AnchorDeposit>>(
      getRepositoryToken(AnchorDeposit),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processCallback', () => {
    it('should update deposit status when transaction exists', async () => {
      const existingDeposit = {
        id: 'dep-123',
        transaction_id: 'anchor-tx-123',
        status: 'pending',
        user_id: 'user-456',
        stellar_account: 'GTEST...',
        asset_code: 'USDC',
      } as AnchorDeposit;

      mockDepositRepo.findOne.mockResolvedValue(existingDeposit);
      mockDepositRepo.save.mockResolvedValue({
        ...existingDeposit,
        status: 'completed',
      });

      const result = await service.processCallback('anchor-tx-123', 'completed');

      expect(result).toEqual({
        updated: true,
        deposit_id: 'dep-123',
      });
      expect(depositRepo.findOne).toHaveBeenCalledWith({
        where: { transaction_id: 'anchor-tx-123' },
      });
      expect(depositRepo.save).toHaveBeenCalledWith({
        ...existingDeposit,
        status: 'completed',
      });
    });

    it('should return updated:false when deposit already at target status', async () => {
      const existingDeposit = {
        id: 'dep-123',
        transaction_id: 'anchor-tx-123',
        status: 'completed',
      } as AnchorDeposit;

      mockDepositRepo.findOne.mockResolvedValue(existingDeposit);

      const result = await service.processCallback('anchor-tx-123', 'completed');

      expect(result).toEqual({
        updated: false,
        deposit_id: 'dep-123',
      });
      expect(depositRepo.save).not.toHaveBeenCalled();
    });

    it('should throw error for unknown transaction_id', async () => {
      mockDepositRepo.findOne.mockResolvedValue(null);

      await expect(
        service.processCallback('unknown-tx', 'completed'),
      ).rejects.toThrow('Unknown transaction_id: unknown-tx');

      expect(depositRepo.save).not.toHaveBeenCalled();
    });

    it('should update from pending to processing', async () => {
      const existingDeposit = {
        id: 'dep-456',
        transaction_id: 'anchor-tx-456',
        status: 'pending',
      } as AnchorDeposit;

      mockDepositRepo.findOne.mockResolvedValue(existingDeposit);
      mockDepositRepo.save.mockResolvedValue({
        ...existingDeposit,
        status: 'processing',
      });

      const result = await service.processCallback(
        'anchor-tx-456',
        'processing',
      );

      expect(result.updated).toBe(true);
      expect(depositRepo.save).toHaveBeenCalledWith({
        ...existingDeposit,
        status: 'processing',
      });
    });

    it('should update to failed status', async () => {
      const existingDeposit = {
        id: 'dep-789',
        transaction_id: 'anchor-tx-789',
        status: 'processing',
      } as AnchorDeposit;

      mockDepositRepo.findOne.mockResolvedValue(existingDeposit);
      mockDepositRepo.save.mockResolvedValue({
        ...existingDeposit,
        status: 'failed',
      });

      const result = await service.processCallback('anchor-tx-789', 'failed');

      expect(result.updated).toBe(true);
      expect(depositRepo.save).toHaveBeenCalledWith({
        ...existingDeposit,
        status: 'failed',
      });
    });
  });
});

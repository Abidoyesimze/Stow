import { BadGatewayException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
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
  let configService: { get: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    depositRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ANCHOR_BASE_URL') return ANCHOR_BASE_URL;
        return undefined;
      }),
    };

    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

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
        {
          provide: CACHE_MANAGER,
          useValue: cache,
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

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${ANCHOR_BASE_URL}/sep24/transactions/deposit/interactive`,
        { asset_code: dto.asset_code, account: dto.account },
        expect.objectContaining({ timeout: expect.any(Number) }),
      );

      expect(result.interactive_url).toBe(sep24Response.url);
      expect(result.transaction_id).toBe(sep24Response.id);
      expect(result.deposit_id).toBe(savedDeposit.id);

      expect(depositRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          stellar_account: dto.account,
          asset_code: dto.asset_code,
          transaction_id: sep24Response.id,
          interactive_url: sep24Response.url,
          status: 'pending',
        }),
      );
      expect(depositRepo.save).toHaveBeenCalledWith(savedDeposit);
    });

    it('should throw error for unknown transaction_id', async () => {
      mockDepositRepo.findOne.mockResolvedValue(null);

      await expect(
        service.processCallback('unknown-tx', 'completed'),
      ).rejects.toThrow('Unknown transaction_id: unknown-tx');

      expect(depositRepo.create).not.toHaveBeenCalled();
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

  describe('getQuote', () => {
    const sellAsset = 'iso4217:NGN';
    const buyAsset = 'stellar:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
    const sellAmount = '10000';
    const mockQuote = {
      sell_asset: sellAsset,
      buy_asset: buyAsset,
      sell_amount: sellAmount,
      buy_amount: '9.50',
      price: '0.00095',
      expires_at: '2025-01-01T00:00:30Z',
    };

    it('returns a quote structure from the anchor', async () => {
      cache.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: mockQuote });
      cache.set.mockResolvedValue(undefined);

      const result = await service.getQuote(sellAsset, buyAsset, sellAmount);

      expect(result).toMatchObject({
        sell_asset: sellAsset,
        buy_asset: buyAsset,
        price: expect.any(String),
        expires_at: expect.any(String),
      });
    });

    it('returns cached quote without calling the anchor on repeated requests', async () => {
      cache.get.mockResolvedValue(mockQuote);

      const result = await service.getQuote(sellAsset, buyAsset, sellAmount);

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockQuote);
    });

    it('caches the quote after a fresh upstream fetch', async () => {
      cache.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: mockQuote });
      cache.set.mockResolvedValue(undefined);

      await service.getQuote(sellAsset, buyAsset, sellAmount);

      expect(cache.set).toHaveBeenCalledWith(
        `savings:quote:${sellAsset}:${buyAsset}:${sellAmount}`,
        mockQuote,
        30_000,
      );
    });

    it('throws BadGatewayException when the anchor quote call fails', async () => {
      cache.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      await expect(
        service.getQuote(sellAsset, buyAsset, sellAmount),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});

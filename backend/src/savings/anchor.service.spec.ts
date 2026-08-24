import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { AnchorDeposit } from './entities/anchor-deposit.entity';
import { AnchorService } from './anchor.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnchorService', () => {
  let service: AnchorService;
  let depositRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const ANCHOR_BASE_URL = 'https://anchor.example.com';
  const USER_ID = 'user-uuid-1';
  const dto = { asset_code: 'USDC', account: 'GSTELLAR_ACCOUNT' };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnchorService,
        {
          provide: getRepositoryToken(AnchorDeposit),
          useValue: depositRepo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AnchorService>(AnchorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeposit', () => {
    it('returns an interactive URL and creates a pending deposit record', async () => {
      const sep24Response = {
        type: 'interactive_customer_info_needed',
        url: 'https://anchor.example.com/sep24/transactions/deposit?token=abc123',
        id: 'txn-id-001',
      };

      mockedAxios.post.mockResolvedValue({ data: sep24Response });

      const savedDeposit: Partial<AnchorDeposit> = {
        id: 'deposit-uuid-1',
        user_id: USER_ID,
        stellar_account: dto.account,
        asset_code: dto.asset_code,
        transaction_id: sep24Response.id,
        interactive_url: sep24Response.url,
        status: 'pending',
      };

      depositRepo.create.mockReturnValue(savedDeposit);
      depositRepo.save.mockResolvedValue(savedDeposit);

      const result = await service.initiateDeposit(USER_ID, dto);

      // Verify the anchor was called with correct SEP-24 params
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${ANCHOR_BASE_URL}/sep24/transactions/deposit/interactive`,
        { asset_code: dto.asset_code, account: dto.account },
        expect.objectContaining({ timeout: expect.any(Number) }),
      );

      // Verify the result contains the interactive URL
      expect(result.interactive_url).toBe(sep24Response.url);
      expect(result.transaction_id).toBe(sep24Response.id);
      expect(result.deposit_id).toBe(savedDeposit.id);

      // Verify a deposit record was created with 'pending' status
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

    it('throws BadGatewayException when the anchor call fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.initiateDeposit(USER_ID, dto)).rejects.toThrow(
        BadGatewayException,
      );

      // No deposit record should be created on anchor failure
      expect(depositRepo.create).not.toHaveBeenCalled();
      expect(depositRepo.save).not.toHaveBeenCalled();
    });

    it('does not persist a record when the anchor returns an error response', async () => {
      mockedAxios.post.mockRejectedValue({ response: { status: 400 } });

      await expect(service.initiateDeposit(USER_ID, dto)).rejects.toThrow(
        BadGatewayException,
      );

      expect(depositRepo.save).not.toHaveBeenCalled();
    });
  });
});

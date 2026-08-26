import { Test, TestingModule } from '@nestjs/testing';
import { AnchorCallbackController } from './anchor-callback.controller';
import { AnchorService } from './anchor.service';
import { Sep24CallbackDto } from './dto/sep24-callback.dto';

describe('AnchorCallbackController', () => {
  let controller: AnchorCallbackController;
  let anchorService: AnchorService;

  const mockAnchorService = {
    processCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnchorCallbackController],
      providers: [
        {
          provide: AnchorService,
          useValue: mockAnchorService,
        },
      ],
    }).compile();

    controller = module.get<AnchorCallbackController>(
      AnchorCallbackController,
    );
    anchorService = module.get<AnchorService>(AnchorService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleSep24Callback', () => {
    it('should process valid callback and update status', async () => {
      const dto: Sep24CallbackDto = {
        transaction_id: 'anchor-tx-123',
        status: 'completed',
        event_id: 'evt_123456',
      };

      mockAnchorService.processCallback.mockResolvedValue({
        updated: true,
        deposit_id: 'dep-uuid',
      });

      const result = await controller.handleSep24Callback(dto);

      expect(result).toEqual({
        received: true,
        updated: true,
      });
      expect(anchorService.processCallback).toHaveBeenCalledWith(
        'anchor-tx-123',
        'completed',
      );
    });

    it('should handle idempotent callbacks (already at status)', async () => {
      const dto: Sep24CallbackDto = {
        transaction_id: 'anchor-tx-123',
        status: 'completed',
        event_id: 'evt_123456',
      };

      mockAnchorService.processCallback.mockResolvedValue({
        updated: false,
        deposit_id: 'dep-uuid',
      });

      const result = await controller.handleSep24Callback(dto);

      expect(result).toEqual({
        received: true,
        updated: false,
      });
    });

    it('should process processing status', async () => {
      const dto: Sep24CallbackDto = {
        transaction_id: 'anchor-tx-456',
        status: 'processing',
        event_id: 'evt_789012',
      };

      mockAnchorService.processCallback.mockResolvedValue({
        updated: true,
        deposit_id: 'dep-uuid-2',
      });

      const result = await controller.handleSep24Callback(dto);

      expect(result.received).toBe(true);
      expect(result.updated).toBe(true);
      expect(anchorService.processCallback).toHaveBeenCalledWith(
        'anchor-tx-456',
        'processing',
      );
    });

    it('should process failed status', async () => {
      const dto: Sep24CallbackDto = {
        transaction_id: 'anchor-tx-789',
        status: 'failed',
        message: 'KYC verification failed',
        event_id: 'evt_345678',
      };

      mockAnchorService.processCallback.mockResolvedValue({
        updated: true,
        deposit_id: 'dep-uuid-3',
      });

      const result = await controller.handleSep24Callback(dto);

      expect(result.received).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('should throw error for unknown transaction_id', async () => {
      const dto: Sep24CallbackDto = {
        transaction_id: 'unknown-tx',
        status: 'completed',
        event_id: 'evt_999999',
      };

      mockAnchorService.processCallback.mockRejectedValue(
        new Error('Unknown transaction_id: unknown-tx'),
      );

      await expect(controller.handleSep24Callback(dto)).rejects.toThrow(
        'Unknown transaction_id',
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { UserFlag } from './entities/user-flag.entity';
import { VerifiedAddress } from './entities/verified-address.entity';
import { AnchorDeposit } from '../savings/entities/anchor-deposit.entity';

/** Minimal query-builder stub used by getSavingsOverview */
const makeQb = (rawMany: unknown[], rawOne: unknown) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rawMany),
  getRawOne: jest.fn().mockResolvedValue(rawOne),
});

describe('AdminService – getSavingsOverview', () => {
  let service: AdminService;
  let anchorDepositRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    anchorDepositRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(VerifiedAddress), useValue: {} },
        { provide: getRepositoryToken(UserFlag), useValue: {} },
        {
          provide: getRepositoryToken(AnchorDeposit),
          useValue: anchorDepositRepo,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('when there are deposits across multiple statuses', () => {
    const statusRows = [
      { status: 'pending', count: '5' },
      { status: 'completed', count: '10' },
      { status: 'failed', count: '2' },
    ];
    const accountsRow = { count: '8' };

    beforeEach(() => {
      anchorDepositRepo.createQueryBuilder
        // first call → GROUP BY status
        .mockReturnValueOnce(makeQb(statusRows, null))
        // second call → COUNT(DISTINCT user_id)
        .mockReturnValueOnce(makeQb([], accountsRow));
    });

    it('returns correct total_deposits', async () => {
      const result = await service.getSavingsOverview();
      expect(result.total_deposits).toBe(17); // 5 + 10 + 2
    });

    it('returns correct total_savings_accounts', async () => {
      const result = await service.getSavingsOverview();
      expect(result.total_savings_accounts).toBe(8);
    });

    it('maps status counts correctly and defaults missing statuses to 0', async () => {
      const result = await service.getSavingsOverview();
      expect(result.deposits_by_status).toEqual({
        pending: 5,
        processing: 0, // not in the fixture — should default to 0
        completed: 10,
        failed: 2,
      });
    });

    it('includes a computed_at ISO-8601 timestamp', async () => {
      const before = new Date();
      const result = await service.getSavingsOverview();
      const after = new Date();

      const ts = new Date(result.computed_at);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('when there are no deposits at all (empty table)', () => {
    beforeEach(() => {
      anchorDepositRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([], null))
        .mockReturnValueOnce(makeQb([], { count: '0' }));
    });

    it('returns zero totals without throwing', async () => {
      const result = await service.getSavingsOverview();
      expect(result.total_deposits).toBe(0);
      expect(result.total_savings_accounts).toBe(0);
      expect(result.deposits_by_status).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe('when COUNT DISTINCT returns null (driver edge case)', () => {
    beforeEach(() => {
      anchorDepositRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([], null))
        .mockReturnValueOnce(makeQb([], null)); // getRawOne returns null
    });

    it('treats null as 0 savings accounts', async () => {
      const result = await service.getSavingsOverview();
      expect(result.total_savings_accounts).toBe(0);
    });
  });
});

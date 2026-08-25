import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { UserFollow } from './entities/user-follow.entity';
import { UserReferral } from './entities/user-referral.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AnchorDeposit } from '../savings/entities/anchor-deposit.entity';

describe('UsersService', () => {
  let service: UsersService;

  let preferencesRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const basePrefs: UserPreferences = {
    id: 'prefs-1',
    userId: 'user-1',
    user: undefined as unknown as User,
    email_notifications: true,
    marketing_emails: false,
    goal_created_notifications: true,
    goal_contribution_notifications: true,
    goal_reached_notifications: true,
    deposit_notifications: true,
    withdrawal_notifications: true,
    group_settlement_notifications: true,
    digest_frequency: 'off',
    digest_hour: 8,
    digest_timezone: 'UTC',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    preferencesRepo = {
      findOne: jest.fn().mockResolvedValue({ ...basePrefs }),
      create: jest.fn().mockImplementation((dto) => ({ ...basePrefs, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(UserPreferences), useValue: preferencesRepo },
        { provide: getRepositoryToken(UserFollow), useValue: {} },
        { provide: getRepositoryToken(UserReferral), useValue: {} },
        { provide: getRepositoryToken(Notification), useValue: {} },
        { provide: getRepositoryToken(AnchorDeposit), useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('updatePreferences', () => {
    it('round-trips the savings notification fields', async () => {
      const result = await service.updatePreferences('user-1', {
        goal_created_notifications: false,
        goal_contribution_notifications: false,
        goal_reached_notifications: false,
        deposit_notifications: false,
        withdrawal_notifications: false,
        group_settlement_notifications: false,
      });

      expect(result).toMatchObject({
        goal_created_notifications: false,
        goal_contribution_notifications: false,
        goal_reached_notifications: false,
        deposit_notifications: false,
        withdrawal_notifications: false,
        group_settlement_notifications: false,
      });
      expect(preferencesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_created_notifications: false,
          goal_contribution_notifications: false,
          goal_reached_notifications: false,
          deposit_notifications: false,
          withdrawal_notifications: false,
          group_settlement_notifications: false,
        }),
      );
    });

    it('leaves fields untouched when not present in the update', async () => {
      const result = await service.updatePreferences('user-1', {
        goal_reached_notifications: false,
      });

      expect(result.goal_reached_notifications).toBe(false);
      expect(result.goal_created_notifications).toBe(true);
      expect(result.deposit_notifications).toBe(true);
    });

    it('does not expose any legacy market/prediction fields', async () => {
      const result = await service.updatePreferences('user-1', {});

      expect(result).not.toHaveProperty('market_resolution_notifications');
      expect(result).not.toHaveProperty('competition_notifications');
      expect(result).not.toHaveProperty('leaderboard_notifications');
    });
  });
});

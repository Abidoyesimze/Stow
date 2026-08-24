import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationCategoryPreference } from './entities/notification-category-preference.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepository: Repository<Notification>;

  const userAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4RRJC3XNRBF7XN';

  const mockNotification: Partial<Notification> = {
    id: 1,
    user_address: userAddress,
    type: NotificationType.EventCreated,
    title: 'Test',
    message: 'Test message',
    read: false,
    created_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockResolvedValue(mockNotification),
          },
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: {},
        },
        {
          provide: getRepositoryToken(NotificationCategoryPreference),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationsRepository = module.get(getRepositoryToken(Notification));
  });

  describe('streamForUser', () => {
    it('streams a newly created notification to a subscribed client', async () => {
      const received = firstValueFrom(service.streamForUser(userAddress));

      await service.create(
        userAddress,
        NotificationType.EventCreated,
        'Test',
        'Test message',
      );

      const event = await received;
      expect(event.type).toBe('notification');
      expect(event.data).toEqual(mockNotification);
      expect(event.id).toBe(String(mockNotification.id));
    });

    it('does not deliver notifications addressed to a different user', async () => {
      const events: unknown[] = [];
      const subscription = service
        .streamForUser('SOME_OTHER_ADDRESS')
        .subscribe((event) => events.push(event));

      await service.create(
        userAddress,
        NotificationType.EventCreated,
        'Test',
        'Test message',
      );

      expect(events).toHaveLength(0);
      subscription.unsubscribe();
    });

    it('persists the notification via the repository before publishing', async () => {
      const received = firstValueFrom(service.streamForUser(userAddress));

      await service.create(
        userAddress,
        NotificationType.EventCreated,
        'Test',
        'Test message',
      );

      await received;
      expect(notificationsRepository.save).toHaveBeenCalled();
    });
  });
});

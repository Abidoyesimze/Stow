import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDigestState } from './entities/notification-digest-state.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationCategoryPreference } from './entities/notification-category-preference.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { NotificationGeneratorService } from './notification-generator.service';
import { DigestService } from './digest.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { UserPreferences } from '../users/entities/user-preferences.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationDigestState,
      NotificationPreference,
      NotificationCategoryPreference,
      User,
      UserPreferences,
    ]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    NotificationGeneratorService,
    DigestService,
  ],
  exports: [NotificationsService, EmailService, NotificationGeneratorService],
})
export class NotificationsModule {}

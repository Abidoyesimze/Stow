import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

/**
 * Turns domain events into user notifications.
 *
 * After the pivot from the prediction market, the old match/prediction/event
 * handlers were removed. Implement savings-domain handlers here, e.g.
 * goal reached, locked plan unlocked, group settled, deposit received.
 *
 * TODO(issue): one handler per savings-vault event topic.
 */
@Injectable()
export class NotificationGeneratorService {
  private readonly logger = new Logger(NotificationGeneratorService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** A savings goal reached its target. */
  async handleGoalReached(data: {
    goalId: string;
    owner: string;
    name: string;
    targetAmount: string;
  }): Promise<void> {
    await this.notificationsService.create(
      data.owner,
      NotificationType.GoalReached,
      'Savings goal reached',
      `Your goal "${data.name}" reached its target of ${data.targetAmount}.`,
      { goal_id: data.goalId, target_amount: data.targetAmount },
    );
  }

  /** A locked savings plan passed its unlock time. */
  async handleLockUnlocked(_data: Record<string, unknown>): Promise<void> {
    // TODO(issue): notify the owner their locked funds are now withdrawable.
    this.logger.debug('handleLockUnlocked: not yet implemented');
  }

  /** A group pool was settled and paid out to members. */
  async handleGroupSettled(_data: Record<string, unknown>): Promise<void> {
    // TODO(issue): notify each member of their settled share.
    this.logger.debug('handleGroupSettled: not yet implemented');
  }
}

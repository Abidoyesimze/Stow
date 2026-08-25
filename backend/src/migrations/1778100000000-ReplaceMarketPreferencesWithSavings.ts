import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceMarketPreferencesWithSavings1778100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "market_resolution_notifications",
      DROP COLUMN IF EXISTS "competition_notifications",
      DROP COLUMN IF EXISTS "leaderboard_notifications",
      DROP COLUMN IF EXISTS "event_created_notifications",
      DROP COLUMN IF EXISTS "match_added_notifications",
      DROP COLUMN IF EXISTS "prediction_submitted_notifications",
      DROP COLUMN IF EXISTS "match_resolved_notifications",
      DROP COLUMN IF EXISTS "winner_verified_notifications",
      DROP COLUMN IF EXISTS "event_cancelled_notifications"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "goal_created_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "goal_contribution_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "goal_reached_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "deposit_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "withdrawal_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "group_settlement_notifications" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "group_settlement_notifications",
      DROP COLUMN IF EXISTS "withdrawal_notifications",
      DROP COLUMN IF EXISTS "deposit_notifications",
      DROP COLUMN IF EXISTS "goal_reached_notifications",
      DROP COLUMN IF EXISTS "goal_contribution_notifications",
      DROP COLUMN IF EXISTS "goal_created_notifications"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "market_resolution_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "competition_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "leaderboard_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "event_created_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "match_added_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "prediction_submitted_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "match_resolved_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "winner_verified_notifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "event_cancelled_notifications" boolean NOT NULL DEFAULT true
    `);
  }
}

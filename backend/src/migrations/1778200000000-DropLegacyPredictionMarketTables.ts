import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the prediction-market schema left over from before the pivot to
 * savings. None of these tables have a corresponding TypeORM entity in the
 * current codebase, and no currently-active table has a foreign key into
 * any of them, so this is a one-way cleanup (see `down` below).
 *
 * `IF EXISTS` / `CASCADE` make this safe to run against both a fresh DB
 * (tables were never created) and a populated one (drops dependents, e.g.
 * `predictions` referencing `markets`, in the same statement).
 */
export class DropLegacyPredictionMarketTables1778200000000
  implements MigrationInterface
{
  private readonly legacyTables = [
    'bracket_matchups',
    'bracket_rounds',
    'competition_brackets',
    'competition_participants',
    'competitions',
    'dispute_evidence',
    'dispute_votes',
    'disputes',
    'match_predictions',
    'event_matches',
    'external_match_results',
    'predictions',
    'markets',
    'market_templates',
    'prediction_fraud_flags',
    'creator_event_leaderboard_entries',
    'creator_event_payouts',
    'creator_events',
    'leaderboard_entries',
    'leaderboard_history',
    'leaderboard_snapshots',
    'seasons',
    'comments',
    'user_bookmarks',
    'oracle_submission_flags',
    'oracle_source_reliability',
    'oracle_submissions',
    'activity_logs',
    'flags',
    'user_achievements',
  ];

  private readonly legacyTypes = [
    'competitions_visibility_enum',
    'competition_brackets_status_enum',
    'market_settlement_state',
    'oracle_submissions_review_status_enum',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.legacyTables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    for (const type of this.legacyTypes) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}" CASCADE`);
    }
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: these tables are dead prediction-market
    // schema with no current entities. Restore from a pre-migration backup
    // if the drop ever needs to be undone.
  }
}

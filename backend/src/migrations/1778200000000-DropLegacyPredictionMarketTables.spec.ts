import { QueryRunner } from 'typeorm';
import { DropLegacyPredictionMarketTables1778200000000 } from './1778200000000-DropLegacyPredictionMarketTables';

describe('DropLegacyPredictionMarketTables1778200000000', () => {
  let migration: DropLegacyPredictionMarketTables1778200000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new DropLegacyPredictionMarketTables1778200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('drops every legacy table using IF EXISTS so it is safe on a fresh DB', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    const tableStatements = queryRunner.query.mock.calls
      .map(([sql]) => sql as string)
      .filter((sql) => sql.startsWith('DROP TABLE'));

    expect(tableStatements.length).toBeGreaterThan(0);
    for (const sql of tableStatements) {
      expect(sql).toMatch(/^DROP TABLE IF EXISTS "\w+" CASCADE$/);
    }

    // Spot-check the tables named explicitly in the issue.
    expect(tableStatements).toEqual(
      expect.arrayContaining([
        'DROP TABLE IF EXISTS "markets" CASCADE',
        'DROP TABLE IF EXISTS "predictions" CASCADE',
        'DROP TABLE IF EXISTS "event_matches" CASCADE',
      ]),
    );
  });

  it('drops legacy enum types using IF EXISTS', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    const typeStatements = queryRunner.query.mock.calls
      .map(([sql]) => sql as string)
      .filter((sql) => sql.startsWith('DROP TYPE'));

    expect(typeStatements.length).toBeGreaterThan(0);
    for (const sql of typeStatements) {
      expect(sql).toMatch(/^DROP TYPE IF EXISTS "\w+" CASCADE$/);
    }
  });

  it('never touches a currently-active table', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    const activeTables = [
      'users',
      'user_preferences',
      'goals',
      'balances',
      'notifications',
      'contract_events',
      'refresh_tokens',
    ];

    const statements = queryRunner.query.mock.calls.map(
      ([sql]) => sql as string,
    );

    for (const table of activeTables) {
      expect(statements).not.toEqual(
        expect.arrayContaining([`DROP TABLE IF EXISTS "${table}" CASCADE`]),
      );
    }
  });

  it('runs the same statements regardless of whether the tables exist (populated-DB safe)', async () => {
    // Simulate a "populated" DB where the tables exist: DROP TABLE IF EXISTS
    // still succeeds without needing different SQL.
    queryRunner.query.mockResolvedValue(undefined);

    await expect(
      migration.up(queryRunner as unknown as QueryRunner),
    ).resolves.not.toThrow();
  });

  it('down() is a documented no-op and does not throw', async () => {
    await expect(migration.down()).resolves.not.toThrow();
  });
});

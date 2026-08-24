import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

/**
 * Creates the `goals` and `balances` read-model tables projected by the
 * indexer from the vault contract's goal (create/contribute/reached) and
 * deposit events.
 */
export class CreateGoalsAndBalances1778000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'goals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'on_chain_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'owner',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'target_amount',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'current_amount',
            type: 'varchar',
            default: "'0'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'reached'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'reached_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'goals',
      new TableIndex({
        name: 'UQ_goals_on_chain_id',
        columnNames: ['on_chain_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'goals',
      new TableIndex({
        name: 'IDX_goals_owner',
        columnNames: ['owner'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'balances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'account',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'varchar',
            default: "'0'",
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'balances',
      new TableIndex({
        name: 'UQ_balances_account',
        columnNames: ['account'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('balances', true);
    await queryRunner.dropTable('goals', true);
  }
}

import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

/**
 * Creates the `anchor_deposits` table to persist SEP-24 interactive
 * deposit sessions initiated by users.
 */
export class CreateAnchorDeposits1777900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'anchor_deposits',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stellar_account',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'asset_code',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'transaction_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'interactive_url',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'pending'",
            isNullable: false,
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
      'anchor_deposits',
      new TableIndex({
        name: 'IDX_anchor_deposits_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'anchor_deposits',
      new TableIndex({
        name: 'UQ_anchor_deposits_transaction_id',
        columnNames: ['transaction_id'],
        isUnique: true,
        where: 'transaction_id IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('anchor_deposits', true);
  }
}

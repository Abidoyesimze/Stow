import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateWebAuthnCredentials1778300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webauthn_credentials',
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
            name: 'credential_id',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'public_key',
            type: 'bytea',
            isNullable: false,
          },
          {
            name: 'counter',
            type: 'bigint',
            isNullable: false,
            default: 0,
          },
          {
            name: 'device_type',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'backed_up',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'transports',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'last_used_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'webauthn_credentials',
      new TableIndex({
        name: 'IDX_webauthn_credentials_user_id',
        columnNames: ['user_id'],
      }),
    );

    // credential_id already has a unique index created implicitly by
    // isUnique above (Postgres backs UNIQUE constraints with an index).

    await queryRunner.createForeignKey(
      'webauthn_credentials',
      new TableForeignKey({
        name: 'FK_webauthn_credentials_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'webauthn_credentials',
      'FK_webauthn_credentials_user',
    );
    await queryRunner.dropTable('webauthn_credentials');
  }
}

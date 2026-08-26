import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemovePredictionColumnsFromUser1778400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', [
      'total_predictions',
      'correct_predictions',
      'total_staked_stroops',
      'total_winnings_stroops',
      'reputation_score',
      'season_points',
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'total_predictions',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'correct_predictions',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'total_staked_stroops',
        type: 'bigint',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'total_winnings_stroops',
        type: 'bigint',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'reputation_score',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'season_points',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );
  }
}

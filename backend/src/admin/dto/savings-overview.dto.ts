import { ApiProperty } from '@nestjs/swagger';

/**
 * Aggregate savings metrics returned by GET /admin/savings/overview.
 *
 * Metrics:
 *  - total_value_locked_usdc  — sum of completed deposit amounts (in USDC stroops as string to avoid
 *                               JS number precision loss on large bigint values).
 *  - total_savings_accounts   — number of distinct users who have at least one deposit record.
 *  - deposits_by_status       — count of anchor_deposits rows grouped by status.
 *  - total_deposits           — total number of anchor_deposit rows across all statuses.
 */
export class SavingsDepositsByStatusDto {
  @ApiProperty({ description: 'Number of pending deposits', example: 12 })
  pending: number;

  @ApiProperty({ description: 'Number of deposits currently processing', example: 3 })
  processing: number;

  @ApiProperty({ description: 'Number of completed deposits', example: 204 })
  completed: number;

  @ApiProperty({ description: 'Number of failed deposits', example: 7 })
  failed: number;
}

export class SavingsOverviewDto {
  /**
   * Total number of anchor_deposit rows across all statuses.
   * Useful as a top-level "activity volume" signal.
   */
  @ApiProperty({
    description: 'Total number of deposit records across all statuses',
    example: 226,
  })
  total_deposits: number;

  /**
   * Number of distinct user_ids that appear in anchor_deposits.
   * Approximates "how many unique savers have used the platform".
   */
  @ApiProperty({
    description: 'Number of distinct savings accounts (unique depositing users)',
    example: 187,
  })
  total_savings_accounts: number;

  /**
   * Breakdown of deposit rows by their current status.
   */
  @ApiProperty({
    description: 'Deposit counts grouped by status',
    type: SavingsDepositsByStatusDto,
  })
  deposits_by_status: SavingsDepositsByStatusDto;

  /**
   * ISO-8601 timestamp of when these figures were calculated.
   */
  @ApiProperty({
    description: 'UTC timestamp when these metrics were computed',
    example: '2026-08-24T23:56:35.000Z',
  })
  computed_at: string;
}

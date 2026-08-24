import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AnchorDepositStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Persists a SEP-24 interactive deposit session initiated by a user.
 * The `transaction_id` is the anchor's identifier for the session.
 * The `interactive_url` is where the user completes KYC / local-currency transfer.
 */
@Entity('anchor_deposits')
@Index(['user_id'])
@Index(['transaction_id'], { unique: true })
export class AnchorDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /** Stellar account address of the depositing user */
  @Column({ type: 'varchar' })
  stellar_account: string;

  /** Asset code, e.g. USDC */
  @Column({ type: 'varchar' })
  asset_code: string;

  /** Anchor's identifier for this deposit session (from SEP-24 response) */
  @Column({ type: 'varchar', nullable: true })
  transaction_id: string | null;

  /** Hosted interactive URL the user must visit to complete the deposit */
  @Column({ type: 'varchar', nullable: true })
  interactive_url: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: AnchorDepositStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

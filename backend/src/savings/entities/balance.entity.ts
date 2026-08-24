import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-account savings balance projected from the vault contract's `deposit`
 * (and future `withdraw`) events.
 */
@Entity('balances')
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stellar account address. */
  @Column({ type: 'varchar', unique: true })
  account: string;

  /** Stroop amount, kept as a string to avoid JS number precision loss. */
  @Column({ type: 'varchar', default: '0' })
  amount: string;

  @UpdateDateColumn()
  updated_at: Date;
}

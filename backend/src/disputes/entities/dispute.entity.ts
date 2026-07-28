import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Market } from '../../markets/entities/market.entity';
import { User } from '../../users/entities/user.entity';

export enum DisputeStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export enum DisputeResolution {
  UPHELD = 'upheld',
  OVERTURNED = 'overturned',
}

/**
 * Tracks which SLA clock is currently running for a pending dispute.
 * INITIAL_REVIEW is the first window after creation; a breach of that
 * window escalates the dispute into ESCALATED, which carries its own
 * (shorter) deadline. RESOLVED disputes stop tracking SLA entirely.
 */
export enum DisputeSlaStage {
  INITIAL_REVIEW = 'initial_review',
  ESCALATED = 'escalated',
}

@Entity('disputes')
@Index(['marketId'])
@Index(['disputantId'])
@Index(['status'])
@Index(['resolvedById'])
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'market_id' })
  @Index()
  marketId: string;

  @Column({ name: 'disputant_id' })
  @Index()
  disputantId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.PENDING,
  })
  @Index()
  status: DisputeStatus;

  @Column({
    type: 'enum',
    enum: DisputeResolution,
    nullable: true,
  })
  resolution: DisputeResolution | null;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ name: 'resolved_by_id', nullable: true })
  @Index()
  resolvedById: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({
    name: 'on_chain_dispute_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  onChainDisputeId: string | null;

  @Column({
    name: 'on_chain_resolution_tx',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  onChainResolutionTx: string | null;

  @Column({
    name: 'sla_stage',
    type: 'enum',
    enum: DisputeSlaStage,
    default: DisputeSlaStage.INITIAL_REVIEW,
  })
  @Index()
  slaStage: DisputeSlaStage;

  @Column({ name: 'sla_deadline', type: 'timestamptz' })
  slaDeadline: Date;

  @Column({ name: 'sla_breached_at', type: 'timestamptz', nullable: true })
  slaBreachedAt: Date | null;

  @Column({
    name: 'sla_approaching_notified_at',
    type: 'timestamptz',
    nullable: true,
  })
  slaApproachingNotifiedAt: Date | null;

  @Column({
    name: 'sla_breached_notified_at',
    type: 'timestamptz',
    nullable: true,
  })
  slaBreachedNotifiedAt: Date | null;

  @Column({ name: 'assigned_arbiter_id', nullable: true })
  @Index()
  assignedArbiterId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relationships
  @ManyToOne(() => Market, { eager: true })
  @JoinColumn({ name: 'market_id', referencedColumnName: 'id' })
  market: Market;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'disputant_id', referencedColumnName: 'id' })
  disputant: User;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'resolved_by_id', referencedColumnName: 'id' })
  resolvedBy: User | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'assigned_arbiter_id', referencedColumnName: 'id' })
  assignedArbiter: User | null;
}

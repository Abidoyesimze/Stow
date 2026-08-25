import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A WebAuthn (passkey) public-key credential registered for a user.
 *
 * Populated by a registration flow elsewhere; this entity only needs to
 * support looking a credential up by its id and verifying/updating its
 * signature counter during authentication.
 */
@Entity('webauthn_credentials')
export class WebAuthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Base64url-encoded credential id, as produced by the authenticator. */
  @Index({ unique: true })
  @Column({ name: 'credential_id', type: 'varchar', unique: true })
  credential_id: string;

  /** COSE public key bytes for the credential. */
  @Column({ name: 'public_key', type: 'bytea' })
  public_key: Buffer;

  /** Signature counter, used to detect cloned authenticators. */
  @Column({ type: 'bigint', default: 0 })
  counter: string;

  @Column({ name: 'device_type', type: 'varchar', nullable: true })
  device_type: string | null;

  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backed_up: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  transports: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  last_used_at: Date | null;
}

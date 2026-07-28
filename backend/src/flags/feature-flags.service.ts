import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  FeatureFlag,
  FlagTargetType,
  FlagAttributeOperator,
} from './entities/feature-flag.entity';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import * as crypto from 'crypto';

export interface ResolvedFlagDto {
  key: string;
  name: string;
  is_enabled: boolean;
  targeting_type: string | null;
  targeting_rules: Record<string, unknown> | null;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagsRepository: Repository<FeatureFlag>,
  ) {}

  async create(dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.featureFlagsRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `Feature flag with key "${dto.key}" already exists`,
      );
    }

    const flag = this.featureFlagsRepository.create({
      key: dto.key,
      name: dto.name,
      description: dto.description || null,
      is_enabled: dto.is_enabled ?? false,
      targeting_type: dto.targeting_type || null,
      targeting_rules: dto.targeting_rules || null,
      rollout_percentage: dto.rollout_percentage ?? 0,
    });

    return this.featureFlagsRepository.save(flag);
  }

  async update(
    id: string,
    dto: Partial<CreateFeatureFlagDto>,
  ): Promise<FeatureFlag> {
    const flag = await this.featureFlagsRepository.findOne({ where: { id } });
    if (!flag) {
      throw new NotFoundException(`Feature flag "${id}" not found`);
    }

    if (dto.key !== undefined) flag.key = dto.key;
    if (dto.name !== undefined) flag.name = dto.name;
    if (dto.description !== undefined) flag.description = dto.description;
    if (dto.is_enabled !== undefined) flag.is_enabled = dto.is_enabled;
    if (dto.targeting_type !== undefined)
      flag.targeting_type = dto.targeting_type;
    if (dto.targeting_rules !== undefined)
      flag.targeting_rules = dto.targeting_rules;
    if (dto.rollout_percentage !== undefined)
      flag.rollout_percentage = dto.rollout_percentage;

    return this.featureFlagsRepository.save(flag);
  }

  async delete(id: string): Promise<void> {
    const result = await this.featureFlagsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Feature flag "${id}" not found`);
    }
  }

  async findAll(): Promise<FeatureFlag[]> {
    return this.featureFlagsRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FeatureFlag> {
    const flag = await this.featureFlagsRepository.findOne({ where: { id } });
    if (!flag) {
      throw new NotFoundException(`Feature flag "${id}" not found`);
    }
    return flag;
  }

  /**
   * Resolve all feature flags for a given user.
   * Returns each flag with its resolved enabled status based on targeting rules.
   */
  async resolveFlagsForUser(user: User): Promise<ResolvedFlagDto[]> {
    const flags = await this.featureFlagsRepository.find();

    return flags.map((flag) => {
      const resolved = this.evaluateFlagForUser(flag, user);
      return {
        key: flag.key,
        name: flag.name,
        is_enabled: resolved,
        targeting_type: flag.targeting_type,
        targeting_rules: flag.targeting_rules,
      };
    });
  }

  /**
   * Resolve a single feature flag for a given user.
   */
  async resolveFlagForUser(
    flagKey: string,
    user: User,
  ): Promise<ResolvedFlagDto | null> {
    const flag = await this.featureFlagsRepository.findOne({
      where: { key: flagKey },
    });
    if (!flag) return null;

    const resolved = this.evaluateFlagForUser(flag, user);
    return {
      key: flag.key,
      name: flag.name,
      is_enabled: resolved,
      targeting_type: flag.targeting_type,
      targeting_rules: flag.targeting_rules,
    };
  }

  private evaluateFlagForUser(flag: FeatureFlag, user: User): boolean {
    // Global override: if flag is disabled globally, return false
    if (!flag.is_enabled) return false;

    // No targeting: flag is enabled for everyone
    if (!flag.targeting_type) return true;

    switch (flag.targeting_type) {
      case FlagTargetType.USER_LIST:
        return this.evaluateUserList(flag, user);
      case FlagTargetType.PERCENTAGE:
        return this.evaluatePercentage(flag, user);
      case FlagTargetType.ATTRIBUTE:
        return this.evaluateAttribute(flag, user);
      default:
        return true;
    }
  }

  private evaluateUserList(flag: FeatureFlag, user: User): boolean {
    const rules = flag.targeting_rules as { user_ids?: string[] } | null;
    if (!rules?.user_ids || !Array.isArray(rules.user_ids)) {
      return false;
    }
    return rules.user_ids.includes(user.id);
  }

  private evaluatePercentage(flag: FeatureFlag, user: User): boolean {
    const percentage = Math.min(100, Math.max(0, flag.rollout_percentage));
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;

    // Deterministic bucketing using a hash of flag key + user ID
    const bucket = this.deterministicBucket(flag.key, user.id);
    return bucket < percentage;
  }

  private evaluateAttribute(flag: FeatureFlag, user: User): boolean {
    const rules = flag.targeting_rules as {
      attributes?: Record<string, { operator: string; value: unknown }>;
    } | null;
    if (!rules?.attributes) return false;

    const userAttributes = this.getUserAttributes(user);

    for (const [attrKey, rule] of Object.entries(rules.attributes)) {
      const userValue = userAttributes[attrKey];
      if (userValue === undefined) return false;

      const operator = rule.operator as FlagAttributeOperator;
      const ruleValue = rule.value;

      if (!this.matchesAttribute(userValue, ruleValue, operator)) {
        return false;
      }
    }

    return true;
  }

  private getUserAttributes(user: User): Record<string, unknown> {
    return {
      id: user.id,
      stellar_address: user.stellar_address,
      role: user.role,
      total_predictions: user.total_predictions,
      correct_predictions: user.correct_predictions,
      reputation_score: user.reputation_score,
      season_points: user.season_points,
      is_banned: user.is_banned,
      created_at: user.created_at.toISOString(),
    };
  }

  private matchesAttribute(
    userValue: unknown,
    ruleValue: unknown,
    operator: FlagAttributeOperator,
  ): boolean {
    switch (operator) {
      case FlagAttributeOperator.EQ:
        return String(userValue) === String(ruleValue);
      case FlagAttributeOperator.NEQ:
        return String(userValue) !== String(ruleValue);
      case FlagAttributeOperator.GT:
        return Number(userValue) > Number(ruleValue);
      case FlagAttributeOperator.GTE:
        return Number(userValue) >= Number(ruleValue);
      case FlagAttributeOperator.LT:
        return Number(userValue) < Number(ruleValue);
      case FlagAttributeOperator.LTE:
        return Number(userValue) <= Number(ruleValue);
      case FlagAttributeOperator.IN:
        return (
          Array.isArray(ruleValue) && ruleValue.includes(String(userValue))
        );
      case FlagAttributeOperator.NOT_IN:
        return (
          Array.isArray(ruleValue) && !ruleValue.includes(String(userValue))
        );
      case FlagAttributeOperator.CONTAINS:
        return (
          typeof userValue === 'string' &&
          typeof ruleValue === 'string' &&
          userValue.includes(ruleValue)
        );
      default:
        return false;
    }
  }

  /**
   * Deterministic bucketing for percentage rollout.
   * Uses SHA-256 hash of flag key + user ID to ensure a stable 0-100 bucket per user.
   */
  private deterministicBucket(flagKey: string, userId: string): number {
    const hash = crypto
      .createHash('sha256')
      .update(`${flagKey}:${userId}`)
      .digest('hex');
    const first8 = hash.substring(0, 8);
    const intVal = parseInt(first8, 16);
    return intVal % 100;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal, GoalStatus } from './entities/goal.entity';

export interface GoalSummary {
  total_goals: number;
  active_goals: number;
  reached_goals: number;
  total_target: string;
  total_saved: string;
}

/**
 * Projects the vault contract's goal events (create/contribute/reached) into
 * the `goals` read-model consumed by the API and by notifications.
 */
@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
  ) {}

  async upsertCreated(params: {
    onChainId: string;
    owner: string;
    name: string;
    targetAmount: string;
  }): Promise<Goal> {
    const existing = await this.goalRepository.findOne({
      where: { on_chain_id: params.onChainId },
    });
    if (existing) return existing;

    const goal = this.goalRepository.create({
      on_chain_id: params.onChainId,
      owner: params.owner,
      name: params.name,
      target_amount: params.targetAmount,
      current_amount: '0',
      status: GoalStatus.ACTIVE,
      reached_at: null,
    });
    return this.goalRepository.save(goal);
  }

  async applyContribution(onChainId: string, amount: string): Promise<Goal> {
    const goal = await this.findByOnChainId(onChainId);
    goal.current_amount = (
      BigInt(goal.current_amount) + BigInt(amount)
    ).toString();
    return this.goalRepository.save(goal);
  }

  /** Marks a goal reached. Idempotent: a second call is a no-op (changed=false). */
  async markReached(
    onChainId: string,
  ): Promise<{ goal: Goal; changed: boolean }> {
    const goal = await this.findByOnChainId(onChainId);
    if (goal.status === GoalStatus.REACHED) {
      return { goal, changed: false };
    }
    goal.status = GoalStatus.REACHED;
    goal.reached_at = new Date();
    const saved = await this.goalRepository.save(goal);
    return { goal: saved, changed: true };
  }

  async list(owner?: string): Promise<Goal[]> {
    return this.goalRepository.find({
      where: owner ? { owner } : {},
      order: { created_at: 'DESC' },
    });
  }

  async summary(owner?: string): Promise<GoalSummary> {
    const goals = await this.list(owner);
    const totalTarget = goals.reduce(
      (sum, g) => sum + BigInt(g.target_amount),
      0n,
    );
    const totalSaved = goals.reduce(
      (sum, g) => sum + BigInt(g.current_amount),
      0n,
    );
    return {
      total_goals: goals.length,
      active_goals: goals.filter((g) => g.status === GoalStatus.ACTIVE)
        .length,
      reached_goals: goals.filter((g) => g.status === GoalStatus.REACHED)
        .length,
      total_target: totalTarget.toString(),
      total_saved: totalSaved.toString(),
    };
  }

  private async findByOnChainId(onChainId: string): Promise<Goal> {
    const goal = await this.goalRepository.findOne({
      where: { on_chain_id: onChainId },
    });
    if (!goal) {
      throw new NotFoundException(`Goal ${onChainId} not found`);
    }
    return goal;
  }
}

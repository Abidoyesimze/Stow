import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Goal, GoalStatus } from './entities/goal.entity';
import { GoalsService } from './goals.service';

/**
 * In-memory stand-in for the TypeORM `Repository<Goal>`, keyed the same way
 * the real table is (unique `on_chain_id`). Used to exercise persist/read
 * round trips through GoalsService without a live database connection.
 */
class FakeGoalRepository {
  private readonly store = new Map<string, Goal>();

  create(partial: Partial<Goal>): Goal {
    return { ...partial } as Goal;
  }

  async save(goal: Goal): Promise<Goal> {
    const saved = { ...goal };
    this.store.set(saved.on_chain_id, saved);
    return { ...saved };
  }

  async findOne(options: {
    where: { on_chain_id: string };
  }): Promise<Goal | null> {
    const found = this.store.get(options.where.on_chain_id);
    return found ? { ...found } : null;
  }

  async find(options?: { where?: { owner?: string } }): Promise<Goal[]> {
    const all = [...this.store.values()];
    const filtered = options?.where?.owner
      ? all.filter((g) => g.owner === options.where!.owner)
      : all;
    return filtered.map((g) => ({ ...g }));
  }
}

describe('GoalsService – persistence', () => {
  let service: GoalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: getRepositoryToken(Goal), useValue: new FakeGoalRepository() },
      ],
    }).compile();

    service = module.get(GoalsService);
  });

  it('persists a newly created goal and reads it back with matching fields', async () => {
    await service.upsertCreated({
      onChainId: 'goal-1',
      owner: 'GOWNER1',
      name: 'Holiday fund',
      targetAmount: '1000000',
    });

    const [readBack] = await service.list('GOWNER1');

    expect(readBack.on_chain_id).toBe('goal-1');
    expect(readBack.owner).toBe('GOWNER1');
    expect(readBack.name).toBe('Holiday fund');
    expect(readBack.target_amount).toBe('1000000');
    expect(readBack.current_amount).toBe('0');
    expect(readBack.status).toBe(GoalStatus.ACTIVE);
    expect(readBack.reached_at).toBeNull();
  });

  it('persists a contribution and reads back the updated saved amount', async () => {
    await service.upsertCreated({
      onChainId: 'goal-2',
      owner: 'GOWNER2',
      name: 'Car',
      targetAmount: '500',
    });

    await service.applyContribution('goal-2', '200');

    const [readBack] = await service.list('GOWNER2');
    expect(readBack.current_amount).toBe('200');
  });

  it('persists the reached milestone and reads back reached_at set', async () => {
    await service.upsertCreated({
      onChainId: 'goal-3',
      owner: 'GOWNER3',
      name: 'Bike',
      targetAmount: '100',
    });
    await service.applyContribution('goal-3', '100');
    await service.markReached('goal-3');

    const [readBack] = await service.list('GOWNER3');
    expect(readBack.status).toBe(GoalStatus.REACHED);
    expect(readBack.reached_at).toBeInstanceOf(Date);
  });

  it('reads goals back filtered by owner', async () => {
    await service.upsertCreated({
      onChainId: 'owner-a-goal',
      owner: 'OWNER_A',
      name: 'A',
      targetAmount: '10',
    });
    await service.upsertCreated({
      onChainId: 'owner-b-goal',
      owner: 'OWNER_B',
      name: 'B',
      targetAmount: '20',
    });

    const ownerAGoals = await service.list('OWNER_A');
    expect(ownerAGoals).toHaveLength(1);
    expect(ownerAGoals[0].on_chain_id).toBe('owner-a-goal');
  });
});

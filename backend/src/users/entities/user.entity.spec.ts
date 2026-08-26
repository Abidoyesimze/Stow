import { validate } from 'class-validator';
import { User } from './user.entity';

describe('User Entity', () => {
  it('should create a valid user without prediction fields', async () => {
    const user = new User();
    user.stellar_address = 'GABC123456789DEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890';
    user.username = 'test_user';
    user.role = 'user';

    const errors = await validate(user);
    expect(errors.length).toBe(0);
  });

  it('should not have prediction-related properties', () => {
    const user = new User();
    
    expect(user).not.toHaveProperty('total_predictions');
    expect(user).not.toHaveProperty('correct_predictions');
    expect(user).not.toHaveProperty('total_staked_stroops');
    expect(user).not.toHaveProperty('total_winnings_stroops');
    expect(user).not.toHaveProperty('reputation_score');
    expect(user).not.toHaveProperty('season_points');
  });

  it('should validate role enum', async () => {
    const user = new User();
    user.stellar_address = 'GABC123456789DEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890';
    user.role = 'invalid_role';

    const errors = await validate(user);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('role');
  });

  it('should allow admin role', async () => {
    const user = new User();
    user.stellar_address = 'GABC123456789DEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890';
    user.role = 'admin';

    const errors = await validate(user);
    const roleErrors = errors.filter((e) => e.property === 'role');
    expect(roleErrors.length).toBe(0);
  });

  it('should allow nullable optional fields', async () => {
    const user = new User();
    user.stellar_address = 'GABC123456789DEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890';
    user.role = 'user';
    user.username = null;
    user.avatar_url = null;
    user.email = null;

    const errors = await validate(user);
    expect(errors.length).toBe(0);
  });
});

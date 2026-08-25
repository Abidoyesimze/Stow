import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserFlag } from './entities/user-flag.entity';
import { VerifiedAddress } from './entities/verified-address.entity';
import { AnchorDeposit } from '../savings/entities/anchor-deposit.entity';
import {
  BulkUserAction,
  BulkUserActionDto,
  BulkUserActionResponseDto,
  BulkUserActionResultDto,
} from './dto/bulk-user-action.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListVerifiedAddressesQueryDto } from './dto/list-verified-addresses-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SavingsOverviewDto } from './dto/savings-overview.dto';

/**
 * Administrative operations.
 *
 * After the pivot from the prediction market, this service keeps generic
 * user/role administration. Market/prediction/competition moderation, fee
 * stats, and CSV market import were removed with their modules.
 *
 * TODO(issue): add savings-domain admin (e.g. inspect group pools, flag
 * suspicious accounts) as the savings features land.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(VerifiedAddress)
    private readonly verifiedAddressesRepository: Repository<VerifiedAddress>,
    @InjectRepository(AnchorDeposit)
    private readonly anchorDepositRepository: Repository<AnchorDeposit>,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where(
        'user.username ILIKE :search OR user.stellar_address ILIKE :search',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    queryBuilder.orderBy(`user.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listVerifiedAddresses(query: ListVerifiedAddressesQueryDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.verifiedAddressesRepository.createQueryBuilder('v');

    if (search) {
      qb.where('v.address ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('v.verified_at', 'DESC').skip(skip).take(limit);

    const [addresses, total] = await qb.getManyAndCount();

    const data = addresses.map((a) => ({
      address: a.address,
      verified_at: a.verified_at.toISOString(),
      verified_by: a.verified_by,
      events_created: a.events_created,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async banUser(id: string, reason: string, adminId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_banned) throw new ConflictException('User is already banned');

    user.is_banned = true;
    user.ban_reason = reason;
    user.banned_at = new Date();
    user.banned_by = adminId;

    await this.usersRepository.save(user);
    this.logger.log(`Admin ${adminId} banned user ${id}: ${reason}`);
    return user;
  }

  async unbanUser(id: string, adminId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.is_banned) throw new BadRequestException('User is not banned');

    user.is_banned = false;
    user.ban_reason = null;
    user.banned_at = null;
    user.banned_by = null;

    await this.usersRepository.save(user);
    this.logger.log(`Admin ${adminId} unbanned user ${id}`);
    return user;
  }

  async bulkUserAction(
    dto: BulkUserActionDto,
    adminId: string,
  ): Promise<BulkUserActionResponseDto> {
    const results: BulkUserActionResultDto[] = [];

    for (const userId of dto.user_ids) {
      try {
        await this.usersRepository.manager.transaction(async (manager) => {
          const user = await manager.findOne(User, { where: { id: userId } });
          if (!user) {
            throw new NotFoundException(`User "${userId}" not found`);
          }

          switch (dto.action) {
            case BulkUserAction.Ban:
              if (user.is_banned) {
                throw new ConflictException('User is already banned');
              }
              user.is_banned = true;
              user.ban_reason = dto.reason ?? null;
              user.banned_at = new Date();
              user.banned_by = adminId;
              await manager.save(user);
              break;

            case BulkUserAction.Unban:
              if (!user.is_banned) {
                throw new BadRequestException('User is not banned');
              }
              user.is_banned = false;
              user.ban_reason = null;
              user.banned_at = null;
              user.banned_by = null;
              await manager.save(user);
              break;

            case BulkUserAction.Flag:
              await manager.save(
                UserFlag,
                manager.create(UserFlag, {
                  user_id: user.id,
                  reason: dto.reason ?? null,
                  flagged_by: adminId,
                }),
              );
              break;
          }
        });

        results.push({ user_id: userId, success: true });
      } catch (err) {
        results.push({
          user_id: userId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;

    this.logger.log(
      `Admin ${adminId} performed bulk "${dto.action}" on ${dto.user_ids.length} users: ${succeeded} succeeded, ${
        results.length - succeeded
      } failed`,
    );

    return { results, succeeded, failed: results.length - succeeded };
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    adminId: string,
  ): Promise<User> {
    if (id === adminId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const previousRole = user.role;
    user.role = dto.role;

    await this.usersRepository.save(user);

    this.logger.log(
      `Admin ${adminId} changed role of user ${id} from "${previousRole}" to "${dto.role}"`,
    );

    return user;
  }

  /**
   * Aggregates savings metrics across all anchor_deposits rows.
   *
   * Returns:
   *  - total_deposits           — total number of deposit rows
   *  - total_savings_accounts   — number of distinct users with at least one deposit
   *  - deposits_by_status       — count breakdown by status (pending / processing / completed / failed)
   *  - computed_at              — ISO-8601 timestamp of when the query ran
   */
  async getSavingsOverview(): Promise<SavingsOverviewDto> {
    // Single query: total rows, distinct users, and per-status counts in one pass
    const rows: Array<{ status: string; count: string }> =
      await this.anchorDepositRepository
        .createQueryBuilder('d')
        .select('d.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.status')
        .getRawMany();

    const statusMap: Record<string, number> = {};
    let totalDeposits = 0;
    for (const row of rows) {
      const n = parseInt(row.count, 10);
      statusMap[row.status] = n;
      totalDeposits += n;
    }

    const totalAccounts: { count: string } | undefined =
      await this.anchorDepositRepository
        .createQueryBuilder('d')
        .select('COUNT(DISTINCT d.user_id)', 'count')
        .getRawOne();

    return {
      total_deposits: totalDeposits,
      total_savings_accounts: parseInt(totalAccounts?.count ?? '0', 10),
      deposits_by_status: {
        pending: statusMap['pending'] ?? 0,
        processing: statusMap['processing'] ?? 0,
        completed: statusMap['completed'] ?? 0,
        failed: statusMap['failed'] ?? 0,
      },
      computed_at: new Date().toISOString(),
    };
  }
}

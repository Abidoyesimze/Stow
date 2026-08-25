import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '../common/enums/role.enum';
import { SavingsOverviewDto } from './dto/savings-overview.dto';

const MOCK_OVERVIEW: SavingsOverviewDto = {
  total_deposits: 17,
  total_savings_accounts: 8,
  deposits_by_status: { pending: 5, processing: 0, completed: 10, failed: 2 },
  computed_at: '2026-08-24T23:56:35.000Z',
};

/** Build a test module with CacheModule so CacheInterceptor can be resolved */
async function buildModule(adminService: Partial<AdminService>) {
  return Test.createTestingModule({
    imports: [CacheModule.register()],
    controllers: [AdminController],
    providers: [{ provide: AdminService, useValue: adminService }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();
}

describe('AdminController – GET savings/overview', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  beforeEach(async () => {
    adminService = {
      getSavingsOverview: jest.fn().mockResolvedValue(MOCK_OVERVIEW),
      listUsers: jest.fn(),
      listVerifiedAddresses: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
      bulkUserAction: jest.fn(),
      updateUserRole: jest.fn(),
    } as unknown as jest.Mocked<AdminService>;

    const module: TestingModule = await buildModule(adminService);
    controller = module.get<AdminController>(AdminController);
  });

  describe('getSavingsOverview()', () => {
    it('is defined', () => {
      expect(controller.getSavingsOverview).toBeDefined();
    });

    it('delegates to adminService.getSavingsOverview and returns its result', async () => {
      const result = await controller.getSavingsOverview();

      expect(adminService.getSavingsOverview).toHaveBeenCalledTimes(1);
      expect(result).toEqual(MOCK_OVERVIEW);
    });

    it('returns a response shaped like SavingsOverviewDto', async () => {
      const result = await controller.getSavingsOverview();

      expect(typeof result.total_deposits).toBe('number');
      expect(typeof result.total_savings_accounts).toBe('number');
      expect(result.deposits_by_status).toHaveProperty('pending');
      expect(result.deposits_by_status).toHaveProperty('processing');
      expect(result.deposits_by_status).toHaveProperty('completed');
      expect(result.deposits_by_status).toHaveProperty('failed');
      expect(typeof result.computed_at).toBe('string');
    });
  });
});

/** ----------------------------------------------------------------
 *  Role-guard integration: tests the real RolesGuard with the
 *  @Roles metadata actually attached to the controller and handler.
 *  The test module is compiled so Reflector can read the metadata;
 *  guards are NOT overridden here so the real RolesGuard applies.
 * ---------------------------------------------------------------- */
describe('AdminController savings/overview – role guard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    // Build with no guard overrides so Reflector sees the real metadata
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: { getSavingsOverview: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const reflector = module.get(Reflector);
    guard = new RolesGuard(reflector);
  });

  /**
   * Build a minimal ExecutionContext pointing at the real handler on
   * AdminController so Reflector can read its @Roles metadata.
   */
  const buildCtx = (role: string): ExecutionContext =>
    ({
      getHandler: () => AdminController.prototype.getSavingsOverview,
      getClass: () => AdminController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('allows an admin', () => {
    expect(guard.canActivate(buildCtx(Role.Admin))).toBe(true);
  });

  it('allows a moderator', () => {
    expect(guard.canActivate(buildCtx(Role.Moderator))).toBe(true);
  });

  it('denies a plain user', () => {
    expect(guard.canActivate(buildCtx(Role.User))).toBe(false);
  });

  it('denies a request with no role', () => {
    const ctx = {
      getHandler: () => AdminController.prototype.getSavingsOverview,
      getClass: () => AdminController,
      switchToHttp: () => ({
        getRequest: () => ({ user: {} }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(false);
  });
});

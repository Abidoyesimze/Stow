import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottleTier } from '../common/decorators/throttle-tier.decorator';
import { BalanceService } from './balance.service';

@ApiTags('savings')
@Controller('savings/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * GET /savings/balance/:account
   *
   * Returns the cached savings balance for a Stellar account.
   * Rate limit: read tier — 200 requests / 60 s per user.
   */
  @Get(':account')
  @ThrottleTier('read')
  @ApiOperation({ summary: 'Get savings balance for a Stellar account' })
  @ApiParam({ name: 'account', description: 'Stellar account address' })
  @ApiResponse({ status: 200, description: 'Balance returned (may be cached for up to 10 s)' })
  @ApiResponse({ status: 429, description: 'Too many requests (read tier)' })
  get(@Param('account') account: string) {
    return this.balanceService.get(account);
  }
}

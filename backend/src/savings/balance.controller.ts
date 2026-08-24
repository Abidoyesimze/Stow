import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from './balance.service';

@Controller('savings/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /** GET /savings/balance/:account */
  @Get(':account')
  get(@Param('account') account: string) {
    return this.balanceService.get(account);
  }
}

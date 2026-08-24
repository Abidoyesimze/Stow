import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ThrottleTier } from '../common/decorators/throttle-tier.decorator';
import { User } from '../users/entities/user.entity';
import { AnchorService } from './anchor.service';
import { InitiateDepositDto } from './dto/initiate-deposit.dto';

@Controller('savings/anchor')
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  /**
   * POST /savings/anchor/deposit
   *
   * Initiates a SEP-24 interactive deposit.
   * Returns the anchor-hosted URL the user must visit to complete
   * KYC and the local-currency transfer.
   */
  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  @ThrottleTier('write')
  initiateDeposit(
    @CurrentUser() user: User,
    @Body() dto: InitiateDepositDto,
  ) {
    return this.anchorService.initiateDeposit(user.id, dto);
  }
}

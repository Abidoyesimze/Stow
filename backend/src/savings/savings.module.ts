import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnchorController } from './anchor.controller';
import { AnchorCallbackController } from './anchor-callback.controller';
import { AnchorService } from './anchor.service';
import { AnchorDeposit } from './entities/anchor-deposit.entity';
import { Balance } from './entities/balance.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnchorDeposit, Balance]),
    CacheModule.register({ ttl: 10_000 }),
  ],
  controllers: [AnchorController, BalanceController],
  providers: [AnchorService, BalanceService],
  exports: [AnchorService, BalanceService],
})
export class SavingsModule {}

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnchorController } from './anchor.controller';
import { AnchorService } from './anchor.service';
import { AnchorDeposit } from './entities/anchor-deposit.entity';
import { Balance } from './entities/balance.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';

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

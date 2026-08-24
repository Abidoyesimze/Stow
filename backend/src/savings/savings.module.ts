import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnchorController } from './anchor.controller';
import { AnchorService } from './anchor.service';
import { AnchorDeposit } from './entities/anchor-deposit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnchorDeposit])],
  controllers: [AnchorController],
  providers: [AnchorService],
  exports: [AnchorService],
})
export class SavingsModule {}

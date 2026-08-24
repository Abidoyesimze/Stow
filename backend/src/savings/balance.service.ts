import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './entities/balance.entity';

export interface BalanceView {
  account: string;
  amount: string;
}

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  /** Credits `amount` stroops onto the account's running balance. */
  async credit(account: string, amount: string): Promise<Balance> {
    let balance = await this.balanceRepository.findOne({
      where: { account },
    });
    if (!balance) {
      balance = this.balanceRepository.create({ account, amount: '0' });
    }
    balance.amount = (BigInt(balance.amount) + BigInt(amount)).toString();
    return this.balanceRepository.save(balance);
  }

  async get(account: string): Promise<BalanceView> {
    const balance = await this.balanceRepository.findOne({
      where: { account },
    });
    return { account, amount: balance?.amount ?? '0' };
  }
}

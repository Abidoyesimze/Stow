import { IsNotEmpty, IsString } from 'class-validator';

export class InitiateDepositDto {
  /** Asset code to deposit (e.g. "USDC") */
  @IsString()
  @IsNotEmpty()
  asset_code: string;

  /** Stellar account that will receive the deposit */
  @IsString()
  @IsNotEmpty()
  account: string;
}

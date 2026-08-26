import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateDepositDto {
  /** Asset code to deposit (e.g. "USDC") */
  @ApiProperty({ example: 'USDC', description: 'Asset code to deposit' })
  @IsString()
  @IsNotEmpty()
  asset_code: string;

  /** Stellar account that will receive the deposit */
  @ApiProperty({ example: 'GSTELLAR...', description: 'Stellar account address' })
  @IsString()
  @IsNotEmpty()
  account: string;
}

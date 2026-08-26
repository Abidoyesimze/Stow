import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class Sep24CallbackDto {
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'processing', 'completed', 'failed'])
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsNotEmpty()
  event_id: string;
}

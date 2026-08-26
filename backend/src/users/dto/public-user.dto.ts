import { Expose } from 'class-transformer';

export class PublicUserDto {
  @Expose()
  username: string;

  @Expose()
  stellar_address: string;

  @Expose()
  created_at: Date;
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class SavingsService {
  ping(): { status: string } {
    return { status: 'ok' };
  }
}

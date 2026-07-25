import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MarketsModule } from '../markets/markets.module';
import { CacheWarmingService } from './warming.service';

@Module({
  imports: [CacheModule.register(), MarketsModule, AnalyticsModule],
  providers: [CacheWarmingService],
  exports: [CacheWarmingService],
})
export class CacheWarmingModule {}

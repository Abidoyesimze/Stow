import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { IndexerModule } from '../indexer/indexer.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    CacheModule.register(),
    IndexerModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

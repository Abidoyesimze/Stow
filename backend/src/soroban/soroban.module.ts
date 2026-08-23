import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SorobanService } from './soroban.service';
import { SorobanListener } from './soroban.listener';
import { SystemState } from './entities/system-state.entity';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SystemState])],
  providers: [SorobanService, SorobanListener],
  exports: [SorobanService],
})
export class SorobanModule {}

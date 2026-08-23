import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SorobanService, SorobanRpcEvent } from './soroban.service';
import { SystemState } from './entities/system-state.entity';

const LAST_LEDGER_KEY = 'soroban:last_processed_ledger';

/**
 * Polls the Stow savings-vault contract for events and dispatches them.
 *
 * Skeleton after the pivot: the generic poll loop and ledger checkpointing are
 * kept and working. Per-event decoding (deposit, withdraw, locked_created,
 * goal_reached, group_settled, ...) is stubbed.
 *
 * TODO(issue): implement `processEvent` for each savings-vault event topic.
 */
@Injectable()
export class SorobanListener {
  private readonly logger = new Logger(SorobanListener.name);
  private isPolling = false;

  constructor(
    private readonly sorobanService: SorobanService,
    @InjectRepository(SystemState)
    private readonly systemStateRepository: Repository<SystemState>,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollEvents(): Promise<void> {
    const contractId = process.env.SOROBAN_CONTRACT_ID;
    if (!contractId || contractId === 'your-contract-id-here') {
      return; // Skip polling until the savings-vault contract is deployed.
    }
    if (this.isPolling) {
      this.logger.warn('Soroban listener skipped: previous poll still running');
      return;
    }
    this.isPolling = true;
    try {
      const lastProcessedLedger = await this.getLastProcessedLedger();
      const fromLedger = Math.max(lastProcessedLedger + 1, 1);

      const { events, latestLedger } =
        await this.sorobanService.getEvents(fromLedger);

      if (events.length === 0) {
        if (latestLedger > lastProcessedLedger) {
          await this.persistLastProcessedLedger(latestLedger);
        }
        return;
      }

      let maxProcessedLedger = lastProcessedLedger;
      const ordered = [...events].sort((a, b) => a.ledger - b.ledger);
      for (const event of ordered) {
        await this.processEvent(event);
        if (event.ledger > maxProcessedLedger) {
          maxProcessedLedger = event.ledger;
        }
      }
      await this.persistLastProcessedLedger(
        Math.max(maxProcessedLedger, latestLedger),
      );
    } catch (err) {
      this.logger.error('pollEvents failed', err as Error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Decode and apply a single savings-vault event.
   * TODO(issue): switch on `event.topic[0]` and update savings state.
   */
  private async processEvent(event: SorobanRpcEvent): Promise<void> {
    this.logger.debug(`event ${event.id} topic=${event.topic.join('.')}`);
    // no-op skeleton
    return Promise.resolve();
  }

  private async getLastProcessedLedger(): Promise<number> {
    const row = await this.systemStateRepository.findOne({
      where: { key: LAST_LEDGER_KEY },
    });
    return row ? Number(row.value) : 0;
  }

  private async persistLastProcessedLedger(ledger: number): Promise<void> {
    await this.systemStateRepository.save({
      key: LAST_LEDGER_KEY,
      value: String(ledger),
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market, MarketSettlementState } from './entities/market.entity';
import { SorobanService } from '../soroban/soroban.service';
import { WebhookDispatcherService } from '../webhooks/services/webhook-dispatcher.service';

interface SettlementRetryInfo {
  marketId: string;
  attempts: number;
  lastError?: string;
  nextRetryAt: Date;
}

@Injectable()
export class MarketSettlementScheduler {
  private readonly logger = new Logger(MarketSettlementScheduler.name);
  private readonly MAX_SETTLEMENTS_PER_TICK = 50;
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly INITIAL_BACKOFF_MS = 60000; // 1 minute
  private readonly deadLetterQueue: Map<string, SettlementRetryInfo> = new Map();

  constructor(
    @InjectRepository(Market)
    private readonly marketsRepository: Repository<Market>,
    private readonly sorobanService: SorobanService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSettlement(): Promise<void> {
    try {
      await this.settleEligibleMarkets();
      await this.processRetries();
    } catch (err) {
      this.logger.error('Market settlement sweep failed', err);
    }
  }

  /**
   * Process items in retry queue with exponential backoff
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const retriesToProcess = Array.from(this.deadLetterQueue.entries()).filter(
      ([, info]) => info.nextRetryAt <= now && info.attempts < this.MAX_RETRY_ATTEMPTS,
    );

    for (const [marketId, retryInfo] of retriesToProcess) {
      const market = await this.marketsRepository.findOne({ where: { id: marketId } });
      if (!market) {
        this.deadLetterQueue.delete(marketId);
        continue;
      }

      const settled = await this.settleMarketWithRetry(market, retryInfo);
      if (settled) {
        this.deadLetterQueue.delete(marketId);
        this.logger.log(`Market ${marketId} settled after ${retryInfo.attempts + 1} attempt(s)`);
      } else if (retryInfo.attempts >= this.MAX_RETRY_ATTEMPTS - 1) {
        // Move to permanent dead-letter store
        this.logger.error(
          `Market ${marketId} failed after ${this.MAX_RETRY_ATTEMPTS} attempts, moving to dead-letter store`,
        );
        await this.emitDeadLetterAlert(market, retryInfo);
      }
    }
  }

  /**
   * Emit alert when a settlement moves to dead-letter store
   */
  private async emitDeadLetterAlert(market: Market, retryInfo: SettlementRetryInfo): Promise<void> {
    await this.webhookDispatcher.emit('market.settlement.failed', {
      marketId: market.id,
      onChainMarketId: market.on_chain_market_id,
      attempts: retryInfo.attempts,
      lastError: retryInfo.lastError,
      timestamp: new Date(),
    });
  }

  /**
   * Finds PROPOSED markets whose grace period has elapsed and settles them.
   * Each market is claimed via a conditional UPDATE guarded on its current
   * settlement_state, so calling this concurrently or twice for the same
   * tick settles each eligible market exactly once.
   */
  async settleEligibleMarkets(): Promise<number> {
    const candidates = await this.marketsRepository.find({
      where: { settlement_state: MarketSettlementState.PROPOSED },
      take: this.MAX_SETTLEMENTS_PER_TICK,
    });

    const now = Date.now();
    const due = candidates.filter((market) => {
      if (!market.resolution_proposed_at) {
        return false;
      }
      const deadline =
        market.resolution_proposed_at.getTime() +
        market.grace_period_seconds * 1000;
      return deadline <= now;
    });

    let settledCount = 0;
    for (const market of due) {
      const settled = await this.settleMarket(market);
      if (settled) {
        settledCount++;
      }
    }

    if (settledCount > 0) {
      this.logger.log(`Settled ${settledCount} market(s) past grace period`);
    }

    return settledCount;
  }

  private async settleMarket(market: Market): Promise<boolean> {
    const { affected } = await this.marketsRepository.update(
      { id: market.id, settlement_state: MarketSettlementState.PROPOSED },
      {
        settlement_state: MarketSettlementState.SETTLED,
        is_resolved: true,
        resolved_outcome: market.proposed_outcome as string,
        resolved_at: new Date(),
      },
    );

    if (!affected) {
      this.logger.debug(
        `Market ${market.id} was already settled by another run, skipping`,
      );
      return false;
    }

    try {
      await this.sorobanService.resolveMarket(
        market.on_chain_market_id,
        market.proposed_outcome as string,
      );
    } catch (err) {
      this.logger.error(
        `Soroban settlement call failed for market ${market.id}`,
        err,
      );
      // Add to retry queue with exponential backoff
      await this.addToRetryQueue(market, err instanceof Error ? err.message : 'Unknown error');
      return false;
    }

    await this.webhookDispatcher.emit('market.settled', {
      id: market.id,
      on_chain_market_id: market.on_chain_market_id,
      resolved_outcome: market.proposed_outcome,
      settled_at: new Date(),
    });

    this.logger.log(`Market ${market.id} settled after grace period elapsed`);

    return true;
  }

  /**
   * Settle market with retry tracking
   */
  private async settleMarketWithRetry(
    market: Market,
    retryInfo: SettlementRetryInfo,
  ): Promise<boolean> {
    try {
      await this.sorobanService.resolveMarket(
        market.on_chain_market_id,
        market.proposed_outcome as string,
      );

      await this.webhookDispatcher.emit('market.settled', {
        id: market.id,
        on_chain_market_id: market.on_chain_market_id,
        resolved_outcome: market.proposed_outcome,
        settled_at: new Date(),
      });

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `Retry attempt ${retryInfo.attempts + 1} failed for market ${market.id}: ${errorMsg}`,
      );
      
      retryInfo.attempts++;
      retryInfo.lastError = errorMsg;
      retryInfo.nextRetryAt = this.calculateNextRetry(retryInfo.attempts);
      
      return false;
    }
  }

  /**
   * Add market to retry queue with exponential backoff
   */
  private async addToRetryQueue(market: Market, error: string): Promise<void> {
    if (!this.deadLetterQueue.has(market.id)) {
      this.deadLetterQueue.set(market.id, {
        marketId: market.id,
        attempts: 0,
        lastError: error,
        nextRetryAt: this.calculateNextRetry(0),
      });
      this.logger.log(`Added market ${market.id} to retry queue`);
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(attempts: number): Date {
    const backoffMs = this.INITIAL_BACKOFF_MS * Math.pow(2, attempts);
    return new Date(Date.now() + backoffMs);
  }

  /**
   * Get dead-letter queue contents (admin endpoint)
   */
  getDeadLetterQueue(): SettlementRetryInfo[] {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * Manually retry a failed settlement (admin endpoint)
   */
  async retrySettlement(marketId: string): Promise<boolean> {
    const market = await this.marketsRepository.findOne({ where: { id: marketId } });
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    const retryInfo = this.deadLetterQueue.get(marketId);
    if (!retryInfo) {
      throw new Error(`Market ${marketId} not in retry queue`);
    }

    const settled = await this.settleMarketWithRetry(market, retryInfo);
    if (settled) {
      this.deadLetterQueue.delete(marketId);
    }

    return settled;
  }
}

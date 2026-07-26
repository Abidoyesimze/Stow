import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import {
  ExternalMatchResult,
  ExternalResultStatus,
} from './entities/external-match-result.entity';
import {
  EXTERNAL_RESULT_FEED_CLIENT,
  ExternalMatchResultPayload,
} from './external-result-feed.client';
import type { ExternalResultFeedClient } from './external-result-feed.client';

@Injectable()
export class ExternalResultIngestionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExternalResultIngestionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(ExternalMatchResult)
    private readonly resultRepository: Repository<ExternalMatchResult>,
    @Inject(EXTERNAL_RESULT_FEED_CLIENT)
    private readonly feedClient: ExternalResultFeedClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = this.configService.get<number>(
      'MATCH_RESULTS_POLL_INTERVAL_MS',
      60000,
    );
    if (interval > 0 && this.configService.get<string>('MATCH_RESULTS_FEED_URL')) {
      this.timer = setInterval(() => void this.ingest(), interval);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async ingest(): Promise<void> {
    const results = await this.feedClient.fetchResults();
    for (const result of results) await this.processResult(result);
  }

  private async processResult(
    result: ExternalMatchResultPayload,
  ): Promise<void> {
    const match = await this.matchRepository.findOne({
      where: { external_id: result.externalId },
    });
    if (!match) {
      this.logger.warn(`Unmatched external result: ${result.externalId}`);
      return;
    }

    if (
      match.result_submitted &&
      (match.home_score !== result.homeScore ||
        match.away_score !== result.awayScore ||
        match.winning_team !== result.winningTeam)
    ) {
      this.logger.warn(`Conflicting external result: ${result.externalId}`);
      return;
    }

    const queued = await this.resultRepository.findOne({
      where: { match: { id: match.id } },
    });
    if (queued) {
      if (
        queued.home_score !== result.homeScore ||
        queued.away_score !== result.awayScore ||
        queued.winning_team !== result.winningTeam
      ) {
        this.logger.warn(
          `Conflicting queued external result: ${result.externalId}`,
        );
      }
      return;
    }

    await this.resultRepository.save(
      this.resultRepository.create({
        match,
        external_id: result.externalId,
        home_score: result.homeScore,
        away_score: result.awayScore,
        winning_team: result.winningTeam,
        status: ExternalResultStatus.PENDING_CONFIRMATION,
      }),
    );
  }
}

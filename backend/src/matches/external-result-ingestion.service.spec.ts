import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Match, WinningTeam } from './entities/match.entity';
import {
  ExternalMatchResult,
  ExternalResultStatus,
} from './entities/external-match-result.entity';
import {
  EXTERNAL_RESULT_FEED_CLIENT,
  ExternalResultFeedClient,
} from './external-result-feed.client';
import { ExternalResultIngestionService } from './external-result-ingestion.service';

describe('ExternalResultIngestionService', () => {
  const payload = {
    externalId: 'feed-42',
    homeScore: 2,
    awayScore: 1,
    winningTeam: WinningTeam.TEAM_A,
  };
  const matchRepository = { findOne: jest.fn() };
  const resultRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const feedClient: jest.Mocked<ExternalResultFeedClient> = {
    fetchResults: jest.fn(),
  };
  let service: ExternalResultIngestionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ExternalResultIngestionService,
        { provide: getRepositoryToken(Match), useValue: matchRepository },
        {
          provide: getRepositoryToken(ExternalMatchResult),
          useValue: resultRepository,
        },
        { provide: EXTERNAL_RESULT_FEED_CLIENT, useValue: feedClient },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key, fallback) => fallback) },
        },
      ],
    }).compile();
    service = module.get(ExternalResultIngestionService);
    feedClient.fetchResults.mockResolvedValue([payload]);
  });

  it('maps a result and queues it for confirmation without settling the match', async () => {
    const match = {
      id: 'match-1',
      external_id: payload.externalId,
      result_submitted: false,
      home_score: null,
      away_score: null,
      winning_team: null,
    } as Match;
    matchRepository.findOne.mockResolvedValue(match);
    resultRepository.findOne.mockResolvedValue(null);

    await service.ingest();

    expect(matchRepository.findOne).toHaveBeenCalledWith({
      where: { external_id: payload.externalId },
    });
    expect(resultRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        match,
        status: ExternalResultStatus.PENDING_CONFIRMATION,
        home_score: 2,
        away_score: 1,
      }),
    );
    expect(match.result_submitted).toBe(false);
  });

  it('logs an unmatched external ID and does not queue it', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    matchRepository.findOne.mockResolvedValue(null);

    await service.ingest();

    expect(warning).toHaveBeenCalledWith(
      `Unmatched external result: ${payload.externalId}`,
    );
    expect(resultRepository.save).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it('logs a conflict with a recorded result and does not apply or queue it', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const match = {
      id: 'match-1',
      external_id: payload.externalId,
      result_submitted: true,
      home_score: 0,
      away_score: 0,
      winning_team: WinningTeam.DRAW,
    } as Match;
    matchRepository.findOne.mockResolvedValue(match);

    await service.ingest();

    expect(warning).toHaveBeenCalledWith(
      `Conflicting external result: ${payload.externalId}`,
    );
    expect(resultRepository.save).not.toHaveBeenCalled();
    expect(match.home_score).toBe(0);
    warning.mockRestore();
  });

  it('does not enqueue the same match twice', async () => {
    matchRepository.findOne.mockResolvedValue({
      id: 'match-1',
      result_submitted: false,
    });
    resultRepository.findOne.mockResolvedValue({
      home_score: 2,
      away_score: 1,
      winning_team: WinningTeam.TEAM_A,
    });

    await service.ingest();

    expect(resultRepository.save).not.toHaveBeenCalled();
  });
});

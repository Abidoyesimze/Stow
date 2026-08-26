import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import {
  AnchorDeposit,
  AnchorDepositStatus,
} from './entities/anchor-deposit.entity';
import { InitiateDepositDto } from './dto/initiate-deposit.dto';

export interface DepositInitiationResult {
  deposit_id: string;
  transaction_id: string;
  interactive_url: string;
}

/** Shape of the SEP-24 POST /transactions/deposit/interactive response */
interface Sep24DepositResponse {
  type: string;
  url: string;
  id: string;
}

@Injectable()
export class AnchorService {
  private readonly logger = new Logger(AnchorService.name);

  /** Base URL of the SEP-24 anchor platform (e.g. https://anchor.example.com) */
  private readonly anchorBaseUrl: string;

  constructor(
    @InjectRepository(AnchorDeposit)
    private readonly depositRepo: Repository<AnchorDeposit>,
    private readonly configService: ConfigService,
  ) {
    this.anchorBaseUrl = this.configService.get<string>(
      'ANCHOR_BASE_URL',
      '',
    );
  }

  /**
   * Initiates a SEP-24 interactive deposit with the configured anchor.
   *
   * Steps:
   *  1. POST to the anchor's SEP-24 endpoint requesting an interactive session.
   *  2. Persist a pending AnchorDeposit record with the returned URL and
   *     transaction id.
   *  3. Return the interactive URL to the caller so the frontend can open it.
   */
  async initiateDeposit(
    userId: string,
    dto: InitiateDepositDto,
  ): Promise<DepositInitiationResult> {
    const sep24Url = `${this.anchorBaseUrl}/sep24/transactions/deposit/interactive`;

    let sep24Response: Sep24DepositResponse;
    try {
      const { data } = await axios.post<Sep24DepositResponse>(
        sep24Url,
        {
          asset_code: dto.asset_code,
          account: dto.account,
        },
        { timeout: 10_000 },
      );
      sep24Response = data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `SEP-24 deposit initiation failed for user ${userId}: ${message}`,
      );
      throw new BadGatewayException(
        'Anchor service unavailable. Please try again later.',
      );
    }

    const deposit = this.depositRepo.create({
      user_id: userId,
      stellar_account: dto.account,
      asset_code: dto.asset_code,
      transaction_id: sep24Response.id,
      interactive_url: sep24Response.url,
      status: 'pending' as AnchorDepositStatus,
    });

    await this.depositRepo.save(deposit);

    this.logger.log(
      `SEP-24 deposit initiated: deposit_id=${deposit.id} transaction_id=${sep24Response.id} user=${userId}`,
    );

    return {
      deposit_id: deposit.id,
      transaction_id: sep24Response.id,
      interactive_url: sep24Response.url,
    };
  }

  /**
   * Processes a SEP-24 transaction status callback from the anchor.
   * Updates the deposit record status idempotently.
   *
   * @param transactionId The anchor's transaction identifier
   * @param status The new status from the callback
   * @returns true if the status was updated, false if already at this status
   */
  async processCallback(
    transactionId: string,
    status: AnchorDepositStatus,
  ): Promise<{ updated: boolean; deposit_id: string }> {
    const deposit = await this.depositRepo.findOne({
      where: { transaction_id: transactionId },
    });

    if (!deposit) {
      this.logger.warn(
        `Received callback for unknown transaction_id: ${transactionId}`,
      );
      throw new Error(`Unknown transaction_id: ${transactionId}`);
    }

    if (deposit.status === status) {
      this.logger.debug(
        `Deposit ${deposit.id} already at status ${status}, ignoring callback`,
      );
      return { updated: false, deposit_id: deposit.id };
    }

    deposit.status = status;
    await this.depositRepo.save(deposit);

    this.logger.log(
      `Deposit ${deposit.id} (transaction_id=${transactionId}) status updated to ${status}`,
    );

    return { updated: true, deposit_id: deposit.id };
  }
}

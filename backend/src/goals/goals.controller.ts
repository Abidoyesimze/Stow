import { Controller, Get, Query } from '@nestjs/common';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  /** GET /goals?owner=G... — list goals, optionally filtered by owner. */
  @Get()
  list(@Query('owner') owner?: string) {
    return this.goalsService.list(owner);
  }

  /** GET /goals/summary?owner=G... — aggregate totals across goals. */
  @Get('summary')
  summary(@Query('owner') owner?: string) {
    return this.goalsService.summary(owner);
  }
}

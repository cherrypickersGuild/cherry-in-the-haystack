import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModelUpdatesRankService } from './model-updates-rank.service';

@Controller('stats')
@ApiTags('Stats')
export class StatsController {
  constructor(private readonly modelUpdatesRankService: ModelUpdatesRankService) {}

  @Post('model-updates-rank/build')
  @HttpCode(200)
  @ApiOperation({ summary: '[시스템] MODEL_UPDATES 카테고리 순위 집계 (오늘 기준)' })
  async buildRank(): Promise<{ upserted: number }> {
    return this.modelUpdatesRankService.buildDailyRank();
  }

  @Get('model-updates-rank')
  @ApiOperation({ summary: 'MODEL_UPDATES 카테고리 최신 순위 조회' })
  async getRank(): Promise<any> {
    return this.modelUpdatesRankService.getLatestRank();
  }
}

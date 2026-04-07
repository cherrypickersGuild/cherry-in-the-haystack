import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModelUpdatesRankService } from './model-updates-rank.service';
import { FrameworksRankService } from './frameworks-rank.service';
import { FrameworksService } from './frameworks.service';
import { LandingStatService } from './landing-stat.service';

@Controller('stats')
@ApiTags('Stats')
export class StatsController {
  constructor(
    private readonly modelUpdatesRankService: ModelUpdatesRankService,
    private readonly frameworksRankService: FrameworksRankService,
    private readonly frameworksService: FrameworksService,
    private readonly landingStatService: LandingStatService,
  ) {}

  @Post('model-updates-rank/build')
  @HttpCode(200)
  @ApiOperation({ summary: '[시스템] MODEL_UPDATES 카테고리 순위 집계 (오늘 기준)' })
  async buildModelUpdatesRank(): Promise<{ upserted: number }> {
    return this.modelUpdatesRankService.buildDailyRank();
  }

  @Get('model-updates-rank')
  @ApiOperation({ summary: 'MODEL_UPDATES 카테고리 최신 순위 조회' })
  async getModelUpdatesRank(): Promise<any> {
    return this.modelUpdatesRankService.getLatestRank();
  }

  @Post('frameworks-rank/build')
  @HttpCode(200)
  @ApiOperation({ summary: '[시스템] FRAMEWORKS 카테고리 순위 집계 (오늘 기준)' })
  async buildFrameworksRank(): Promise<{ upserted: number }> {
    return this.frameworksRankService.buildDailyRank();
  }

  @Get('frameworks-rank')
  @ApiOperation({ summary: 'FRAMEWORKS 카테고리 최신 순위 조회' })
  async getFrameworksRank(): Promise<any> {
    return this.frameworksRankService.getLatestRank();
  }

  @Get('frameworks')
  @ApiOperation({ summary: 'FRAMEWORKS 카테고리-엔터티 위계 + 라이징스타 + 아티클 목록' })
  async getFrameworks(): Promise<any> {
    return this.frameworksService.getFrameworks();
  }

  @Post('landing/build')
  @HttpCode(200)
  @ApiOperation({ summary: '[시스템] 랜딩 통계 집계 (treemap + momentum)' })
  async buildLanding(): Promise<{ upserted: number }> {
    return this.landingStatService.buildDailyStat();
  }

  @Get('landing')
  @ApiOperation({ summary: '랜딩 페이지 통계 (treemap, momentum, top articles)' })
  async getLanding(): Promise<any> {
    return this.landingStatService.getLanding();
  }
}

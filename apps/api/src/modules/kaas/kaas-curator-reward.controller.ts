import { Controller, Get, Query, HttpCode, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KaasCuratorRewardService } from './kaas-curator-reward.service';

@Controller('v1/kaas/rewards')
@ApiTags('KaaS — Curator Rewards')
export class KaasCuratorRewardController {
  constructor(private readonly rewardService: KaasCuratorRewardService) {}

  @Get('balance')
  @ApiOperation({ summary: '큐레이터 보상 잔액 조회' })
  async getBalance(@Query('curator') curator: string) {
    return this.rewardService.getBalance(curator);
  }

  @Get('all')
  @ApiOperation({ summary: '전체 큐레이터 보상 현황 (Admin)' })
  async getAllRewards() {
    return this.rewardService.getAllRewards();
  }
}

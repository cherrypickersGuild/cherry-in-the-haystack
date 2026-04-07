import { Controller, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionScheduleService } from './ingestion-schedule.service';

@Controller('schedule')
@ApiTags('Schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: IngestionScheduleService) {}

  @Post('run-pipeline')
  @HttpCode(200)
  @ApiOperation({ summary: '[수동] 파이프라인 사이클 즉시 실행 (ingest → pregen → parse)' })
  async runPipeline(): Promise<{ ok: boolean }> {
    await this.scheduleService.runPipelineCycle();
    return { ok: true };
  }

  @Post('run-daily-stats')
  @HttpCode(200)
  @ApiOperation({ summary: '[수동] 일간 통계 집계 즉시 실행 (MODEL_UPDATES 순위)' })
  async runDailyStats(): Promise<{ ok: boolean }> {
    await this.scheduleService.runDailyStats();
    return { ok: true };
  }
}

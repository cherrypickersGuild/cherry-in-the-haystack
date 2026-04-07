import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PipelineModule } from 'src/modules/pipeline/pipeline.module';
import { StatsModule } from 'src/modules/stats/stats.module';
import { IngestionScheduleService } from './ingestion-schedule.service';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PipelineModule,
    StatsModule,
  ],
  controllers: [ScheduleController],
  providers: [IngestionScheduleService],
})
export class AppScheduleModule {}

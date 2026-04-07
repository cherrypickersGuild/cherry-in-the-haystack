import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/basic-module/database.module';
import { StatsController } from './stats.controller';
import { ModelUpdatesRankService } from './model-updates-rank.service';
import { FrameworksRankService } from './frameworks-rank.service';
import { FrameworksService } from './frameworks.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StatsController],
  providers: [ModelUpdatesRankService, FrameworksRankService, FrameworksService],
  exports: [ModelUpdatesRankService, FrameworksRankService, FrameworksService],
})
export class StatsModule {}

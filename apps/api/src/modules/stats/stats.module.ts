import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/basic-module/database.module';
import { StatsController } from './stats.controller';
import { ModelUpdatesRankService } from './model-updates-rank.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StatsController],
  providers: [ModelUpdatesRankService],
  exports: [ModelUpdatesRankService],
})
export class StatsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PipelineRuntimeStateService } from '../basic-service/pipeline-runtime-state.service';
import { RedisService } from '../basic-service/redis.service';

@Module({
  imports: [ConfigModule],
  providers: [PipelineRuntimeStateService, RedisService],
  exports: [PipelineRuntimeStateService, RedisService],
})
export class PipelineRuntimeStateModule {}

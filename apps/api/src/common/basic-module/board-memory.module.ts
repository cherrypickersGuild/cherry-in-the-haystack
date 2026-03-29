import { Module } from '@nestjs/common';
import { BoardMemoryJoinService } from '../basic-service/board-memory-join.service';
import { PipelineRuntimeStateModule } from './pipeline-runtime-state.module';

@Module({
  imports: [PipelineRuntimeStateModule],
  providers: [BoardMemoryJoinService],
  exports: [BoardMemoryJoinService],
})
export class BoardMemoryModule {}

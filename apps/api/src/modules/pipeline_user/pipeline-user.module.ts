import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/basic-module/database.module';
import { PipelineUserController } from './pipeline-user.controller';
import { UserArticleIngestionService } from './user-article-ingestion.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineUserController],
  providers: [UserArticleIngestionService],
  exports: [UserArticleIngestionService],
})
export class PipelineUserModule {}

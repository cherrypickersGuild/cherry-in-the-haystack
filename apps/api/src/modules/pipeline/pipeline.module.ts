import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/basic-module/database.module';
import { PipelineController } from './pipeline.controller';
import { ArticleIngestionService } from './article-ingestion.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineController],
  providers: [ArticleIngestionService],
  exports: [ArticleIngestionService],
})
export class PipelineModule {}

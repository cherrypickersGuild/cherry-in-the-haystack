import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { ArticleIngestionService } from './article-ingestion.service';
import { IngestDto } from './input-dto/ingest.dto';

@Controller('pipeline')
@ApiTags('Pipeline (System)')
export class PipelineController {
  constructor(private readonly ingestionService: ArticleIngestionService) {}

  @Post('ingest')
  @HttpCode(200)
  @ApiOperation({ summary: '[시스템] article_raw → 시스템 유저 user_article_state 생성' })
  @ApiBody({ type: IngestDto })
  async ingest(
    @Body(new ZodValidationPipe(IngestDto.schema)) dto: IngestDto,
  ): Promise<{ created: boolean }> {
    const created = await this.ingestionService.processNewArticle(dto.articleRawId);
    return { created };
  }
}

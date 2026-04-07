import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { UserArticleIngestionService } from './user-article-ingestion.service';
import { IngestForUserDto } from './input-dto/ingest-user.dto';

@Controller('pipeline_user')
@ApiTags('Pipeline (User)')
export class PipelineUserController {
  constructor(private readonly ingestionService: UserArticleIngestionService) {}

  @Post('ingest')
  @HttpCode(200)
  @ApiOperation({ summary: '[유저] article_raw → 특정 유저 user_article_state 생성' })
  @ApiBody({ type: IngestForUserDto })
  async ingestForUser(
    @Body(new ZodValidationPipe(IngestForUserDto.schema)) dto: IngestForUserDto,
  ): Promise<{ created: boolean }> {
    const created = await this.ingestionService.processNewArticleForUser(
      dto.articleRawId,
      dto.userId,
    );
    return { created };
  }
}

import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { AgentApiKeyGuard } from 'src/middleware/agent-api-key.guard';
import { AgentCommService } from './agent-comm.service';
import { InsertArticleDto } from './input-dto/insert-article.dto';
import { FinishEvaluationDto } from './input-dto/finish-evaluation.dto';

@Controller('agent')
@ApiTags('Agent Communication')
@ApiSecurity('agent-api-key')
@UseGuards(AgentApiKeyGuard)
export class AgentCommController {
  constructor(private readonly service: AgentCommService) {}

  @Post('insert-article')
  @HttpCode(200)
  @ApiOperation({ summary: '기사 삽입 (URL 중복 스킵, 소스 자동 생성)' })
  async insertArticle(
    @Body(new ZodValidationPipe(InsertArticleDto.schema)) dto: InsertArticleDto,
  ) {
    return this.service.insertArticle(dto);
  }

  @Get('ask-evaluation')
  @ApiOperation({
    summary: '평가 실행 패키지 요청 (타입 + 버전 태그 → prompts + catalog + items)',
  })
  @ApiQuery({ name: 'type', required: true, enum: ['ARTICLE_AI', 'NEWSLETTER', 'CONCEPT_PAGE', 'REFINE'], description: '템플릿 타입' })
  @ApiQuery({ name: 'version_tags', required: true, type: String, description: '버전 태그 (쉼표 구분: A 또는 A,B)' })
  async askEvaluation(
    @Query('type') type: string,
    @Query('version_tags') versionTags: string,
  ) {
    const tags = versionTags.split(',').map((t) => t.trim()).filter(Boolean);
    return this.service.buildEvaluationPackage(type, tags);
  }

  @Get('get-prompts')
  @ApiOperation({
    summary: '프롬프트만 반환 (타입 + 버전 태그 → 템플릿 메타 + versions)',
  })
  @ApiQuery({ name: 'type', required: true, enum: ['ARTICLE_AI', 'NEWSLETTER', 'CONCEPT_PAGE', 'REFINE'], description: '템플릿 타입' })
  @ApiQuery({ name: 'version_tags', required: true, type: String, description: '버전 태그 (쉼표 구분: A 또는 A,B,C)' })
  async getPrompts(
    @Query('type') type: string,
    @Query('version_tags') versionTags: string,
  ) {
    const tags = versionTags.split(',').map((t) => t.trim()).filter(Boolean);
    return this.service.getPrompts(type, tags);
  }

  @Post('finish-evaluation')
  @HttpCode(200)
  @ApiOperation({ summary: '평가 결과 저장 (agent_json_raw에 기록)' })
  async finishEvaluation(
    @Body(new ZodValidationPipe(FinishEvaluationDto.schema)) dto: FinishEvaluationDto,
  ) {
    return this.service.saveEvaluationResults(dto.results as Record<string, unknown>[]);
  }
}

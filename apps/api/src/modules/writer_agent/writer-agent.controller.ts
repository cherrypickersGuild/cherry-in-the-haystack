import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { AgentApiKeyGuard } from 'src/middleware/agent-api-key.guard';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';

import { WriterInputRequestDto } from './input-dto/writer-input-request.dto';
import { WriterInputResponseDto } from './input-dto/writer-input-response.dto';
import { RelatedConceptsResponseDto } from './input-dto/related-concepts-response.dto';
import { WriterAgentService } from './writer-agent.service';
import { GraphConceptService } from './graph-concept.service';

@Controller('writer-agent')
@ApiTags('Writer Agent')
@ApiSecurity('agent-api-key')
@UseGuards(AgentApiKeyGuard)
export class WriterAgentController {
  constructor(
    private readonly service: WriterAgentService,
    private readonly graphService: GraphConceptService,
  ) {}

  /* ═══════════════════════════════════════════
     POST /writer-agent/input
     Handbook DB → Writer Agent 가 소비할 evidence 묶음 패키징
  ═══════════════════════════════════════════ */
  @Post('input')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Writer Agent] topic 기반 handbook evidence 묶음 조회',
    description:
      'Backend 가 handbook v2 에서 topic 매칭 evidence 를 SQL 로 모아 패키징하여 Writer Agent 에게 전달. ' +
      '매칭은 concept.canonical_name + concept_alias.alias_text (case-insensitive UNION).',
  })
  async fetchWriterInput(
    @Body(new ZodValidationPipe(WriterInputRequestDto.schema))
    dto: WriterInputRequestDto,
  ): Promise<WriterInputResponseDto> {
    return this.service.buildWriterInput(dto.topic, dto.limit ?? 20);
  }

  /* ═══════════════════════════════════════════
     GET /writer-agent/related-concepts?topic=RAG
     GraphDB(llm-ontology) 에서 topic 의 상위/하위 관련 개념 조회.
     (GraphDB Workbench 개념 탐색 시연을 API 로 재현)
  ═══════════════════════════════════════════ */
  @Get('related-concepts')
  @ApiOperation({
    summary: '[Writer Agent] topic 기반 GraphDB 관련 개념(상위/하위) 조회',
    description:
      'GraphDB(ontology) 에서 topic 개념의 부모(상위)·자식(하위) 개념과 설명을 반환. ' +
      'GraphDB 엔 책 청크가 없으므로 evidence 가 아닌 개념 그래프를 제공.',
  })
  @ApiQuery({ name: 'topic', required: true, example: 'RAG' })
  async getRelatedConcepts(
    @Query('topic') topic: string,
  ): Promise<RelatedConceptsResponseDto> {
    return this.graphService.getRelatedConcepts((topic ?? '').trim());
  }
}

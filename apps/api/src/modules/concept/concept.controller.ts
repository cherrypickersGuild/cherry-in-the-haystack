import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ConceptPageDto, ConceptService } from './concept.service';

/**
 * Learning 개념 페이지 — 공개 읽기 API (인증 없음).
 * writer_agent 는 AgentApiKeyGuard 라 프론트가 못 쓴다 → 별도 공개 엔드포인트.
 */
@Controller('learning/concepts')
@ApiTags('Learning Concepts')
export class ConceptController {
  constructor(private readonly service: ConceptService) {}

  @Get()
  @ApiOperation({ summary: '개념 목록 (온톨로지 전체)' })
  async list() {
    return { items: await this.service.list() };
  }

  @Get(':key')
  @ApiOperation({ summary: '개념 페이지 1장 (slug · 노드명 · 별칭 아무거나)' })
  async get(@Param('key') key: string): Promise<ConceptPageDto> {
    const page = await this.service.getPage(key);
    if (!page) throw new NotFoundException(`unknown concept: ${key}`);
    return page;
  }
}

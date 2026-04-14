import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { KaasKnowledgeService } from './kaas-knowledge.service';

@Controller('v1/kaas/catalog')
@ApiTags('KaaS — Catalog (Public)')
export class KaasCatalogController {
  constructor(private readonly knowledge: KaasKnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '개념 목록 (전체 또는 검색)' })
  @ApiQuery({ name: 'q', required: false, description: '검색어' })
  @ApiQuery({ name: 'category', required: false, description: '카테고리 필터' })
  async findAll(
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    if (q) return this.knowledge.search(q);
    if (category) return this.knowledge.findByCategory(category);
    return this.knowledge.findAll();
  }

  @Get(':conceptId')
  @ApiOperation({ summary: '개념 상세 조회' })
  @ApiParam({ name: 'conceptId', example: 'rag' })
  async findOne(@Param('conceptId') conceptId: string) {
    const concept = await this.knowledge.findById(conceptId);
    if (!concept) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'CONCEPT_NOT_FOUND',
        message: `Concept '${conceptId}' not found`,
      });
    }
    return concept;
  }
}

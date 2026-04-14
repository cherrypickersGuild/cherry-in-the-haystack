import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { KaasKnowledgeService } from './kaas-knowledge.service';
import { CompareDto } from './input-dto/compare.dto';
import { ACTION_PRICE } from './types/kaas.types';

@Controller('v1/kaas/catalog')
@ApiTags('KaaS — Catalog (Public)')
export class KaasCompareController {
  constructor(private readonly knowledge: KaasKnowledgeService) {}

  @Post('compare')
  @HttpCode(200)
  @ApiOperation({ summary: 'Knowledge Gap Analysis — 에이전트 보유 지식 vs 카탈로그 비교' })
  async compare(
    @Body(new ZodValidationPipe(CompareDto.schema)) dto: CompareDto,
  ) {
    const allConcepts = await this.knowledge.findAll();
    const upToDate: unknown[] = [];
    const outdated: unknown[] = [];
    const gaps: unknown[] = [];

    for (const concept of allConcepts) {
      const titleLower = concept.title.toLowerCase();
      const idLower = concept.id.toLowerCase();

      const match = dto.known_topics.find(
        (k) =>
          titleLower.includes(k.topic.toLowerCase()) ||
          idLower.includes(k.topic.toLowerCase()) ||
          k.topic.toLowerCase().includes(idLower),
      );

      if (match) {
        const agentTime = new Date(match.lastUpdated).getTime();
        const catalogTime = new Date(concept.updatedAt).getTime();

        if (agentTime >= catalogTime) {
          upToDate.push({ conceptId: concept.id, title: concept.title, status: 'up-to-date' });
        } else {
          outdated.push({
            conceptId: concept.id,
            title: concept.title,
            status: 'outdated',
            agentDate: match.lastUpdated,
            catalogDate: concept.updatedAt,
          });
        }
      } else {
        gaps.push({
          conceptId: concept.id,
          title: concept.title,
          qualityScore: concept.qualityScore,
          status: 'gap',
        });
      }
    }

    const recommendations = [
      ...outdated.map((o: any) => ({ conceptId: o.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'Outdated — newer evidence available' })),
      ...(gaps as any[])
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .map((g) => ({ conceptId: g.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'New concept for your agent' })),
    ];

    return { upToDate, outdated, gaps, recommendations };
  }
}

import { BadRequestException, Body, Controller, Get, HttpCode, Logger, NotFoundException, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import OpenAI from 'openai';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';
import { KaasCreditService } from './kaas-credit.service';
import { KaasProvenanceService } from './kaas-provenance.service';
import { KaasCuratorRewardService } from './kaas-curator-reward.service';
import { KaasWsGateway } from './kaas-ws.gateway';
import { PurchaseDto } from './input-dto/purchase.dto';
import { FollowDto } from './input-dto/follow.dto';
import { ACTION_PRICE, KarmaTierName } from './types/kaas.types';

@Controller('v1/kaas')
@ApiTags('KaaS — Purchase / Follow')
export class KaasQueryController {
  private readonly logger = new Logger(KaasQueryController.name);
  constructor(
    private readonly agentService: KaasAgentService,
    private readonly knowledge: KaasKnowledgeService,
    private readonly credit: KaasCreditService,
    private readonly provenance: KaasProvenanceService,
    private readonly curatorReward: KaasCuratorRewardService,
    private readonly wsGateway: KaasWsGateway,
  ) {}

  private async findAgent(apiKey?: string) {
    if (apiKey) return this.agentService.authenticate(apiKey);
    const agents = await this.agentService.findByUserId('00000000-0000-0000-0000-000000000000');
    if (agents.length === 0) throw new NotFoundException('No agent registered');
    return agents[0];
  }

  /** 에이전트가 이미 해당 concept을 보유하고 있는지 확인 (topic ↔ concept_id 퍼지 매칭) */
  private agentOwnsConcept(agent: any, conceptId: string, conceptTitle?: string): boolean {
    const raw = agent?.knowledge;
    let knowledge: Array<{ topic: string }> = [];
    try {
      knowledge = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    } catch {
      knowledge = [];
    }
    const idLower = conceptId.toLowerCase();
    const titleLower = (conceptTitle ?? '').toLowerCase();
    return knowledge.some((k) => {
      const t = k.topic.toLowerCase();
      return (
        t === idLower ||
        idLower.includes(t) ||
        t.includes(idLower) ||
        (titleLower && (titleLower.includes(t) || t.includes(titleLower.split(' ')[0])))
      );
    });
  }

  @Post('purchase')
  @HttpCode(200)
  @ApiOperation({ summary: '개념 구매 (20cr, 일회성)' })
  async purchase(
    @Body(new ZodValidationPipe(PurchaseDto.schema)) dto: PurchaseDto,
  ) {
    try {
      const agent = await this.findAgent(dto.api_key);
      this.logger.log(`Purchase: agent=${agent.id}, concept=${dto.concept_id}, tier=${agent.karma_tier}`);

      const concept = await this.knowledge.findByIdWithContent(dto.concept_id);
      if (!concept) throw new NotFoundException({ code: 'CONCEPT_NOT_FOUND', message: `Concept '${dto.concept_id}' not found` });

      // 중복 구매 차단: 이미 보유한 지식이면 크레딧 차감 전에 거절
      if (this.agentOwnsConcept(agent, dto.concept_id, concept.title)) {
        throw new BadRequestException({
          code: 'ALREADY_OWNED',
          message: `이미 보유한 지식입니다: ${concept.title}`,
        });
      }

      const { consumed, remaining } = await this.credit.consume(
        agent.id, ACTION_PRICE.purchase, agent.karma_tier as KarmaTierName, dto.concept_id, 'purchase',
      );

      const responseData = {
        answer: concept.summary,
        content_md: concept.contentMd,
        concepts: [concept.title],
        evidence: concept.evidence,
        quality_score: concept.qualityScore,
      };

      const prov = await this.provenance.recordQuery(
        agent.id, dto.concept_id, 'purchase', consumed, responseData,
      );

      // 큐레이터 보상 40% 자동 지급 (비동기)
      this.curatorReward.distributeReward(dto.concept_id, prov.queryLogId, consumed).catch((err) => {
        this.logger.warn(`Curator reward failed: ${err.message}`);
      });

      // 구매 후 knowledge 자동 업데이트 + WebSocket 즉시 제출
      await this.agentService.addToKnowledge(agent.id, dto.concept_id);
      const updatedAgent = await this.agentService.findById(agent.id);
      const knowledge = (() => { try { const r = updatedAgent?.knowledge; return typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch { return []; } })();
      await this.wsGateway.pushKnowledgeUpdate(agent.id, knowledge);

      return {
        ...responseData,
        credits_consumed: consumed,
        credits_remaining: remaining,
        provenance: {
          hash: prov.provenanceHash,
          chain: prov.onChain ? (process.env.CHAIN_ADAPTER ?? 'mock') : 'failed',
          explorer_url: prov.explorerUrl,
          on_chain: prov.onChain,
          error: prov.error,
        },
      };
    } catch (err) {
      this.logger.error(`Purchase error: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Post('follow')
  @HttpCode(200)
  @ApiOperation({ summary: '개념 팔로우 (25cr, 업데이트 포함)' })
  async follow(
    @Body(new ZodValidationPipe(FollowDto.schema)) dto: FollowDto,
  ) {
    const agent = await this.findAgent(dto.api_key);

    const concept = await this.knowledge.findById(dto.concept_id);
    if (!concept) throw new NotFoundException({ code: 'CONCEPT_NOT_FOUND', message: `Concept '${dto.concept_id}' not found` });

    // 중복 팔로우 차단: 이미 보유한 지식이면 크레딧 차감 전에 거절
    if (this.agentOwnsConcept(agent, dto.concept_id, concept.title)) {
      throw new BadRequestException({
        code: 'ALREADY_OWNED',
        message: `이미 보유한 지식입니다: ${concept.title}`,
      });
    }

    const { consumed, remaining } = await this.credit.consume(
      agent.id, ACTION_PRICE.follow, agent.karma_tier as KarmaTierName, dto.concept_id, 'follow',
    );

    const responseData = {
      answer: concept.summary,
      concepts: [concept.title],
      evidence: [],
      quality_score: concept.qualityScore,
      subscription: { concept_id: dto.concept_id, updates_included: true },
    };

    const prov = await this.provenance.recordQuery(
      agent.id, dto.concept_id, 'follow', consumed, responseData,
    );

    // 큐레이터 보상 40% 자동 지급 (비동기)
    this.curatorReward.distributeReward(dto.concept_id, prov.queryLogId, consumed).catch((err) => {
      this.logger.warn(`Curator reward failed: ${err.message}`);
    });

    // 팔로우 후 knowledge 자동 업데이트 + WebSocket 즉시 제출
    await this.agentService.addToKnowledge(agent.id, dto.concept_id);
    const updatedAgent = await this.agentService.findById(agent.id);
    const knowledge = (() => { try { const r = updatedAgent?.knowledge; return typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch { return []; } })();
    await this.wsGateway.pushKnowledgeUpdate(agent.id, knowledge);

    return {
      ...responseData,
      credits_consumed: consumed,
      credits_remaining: remaining,
      provenance: {
        hash: prov.provenanceHash,
        chain: prov.onChain ? (process.env.CHAIN_ADAPTER ?? 'mock') : 'failed',
        explorer_url: prov.explorerUrl,
        on_chain: prov.onChain,
        error: prov.error,
      },
    };
  }

  @Post('llm/chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'KaaS 지식 기반 GPT 채팅' })
  async llmChat(@Body() body: { question: string; content_md?: string; api_key?: string }) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 카탈로그 개념들을 컨텍스트로 활용
    const concepts = await this.knowledge.findAll();
    const catalogCtx = concepts.slice(0, 10)
      .map((c) => `- ${c.title}: ${c.summary}`)
      .join('\n');

    const systemPrompt = body.content_md
      ? `너는 Cherry KaaS 어시스턴트야. 다음 구매한 지식을 바탕으로 답해:\n\n${body.content_md}`
      : `너는 Cherry KaaS 어시스턴트야. AI/ML 지식을 큐레이션해서 AI 에이전트에게 판매하는 플랫폼이야.

우리 카탈로그에 있는 개념들:
${catalogCtx}

규칙:
- 사용자가 AI/ML 관련 질문을 하면, 해당 개념이 카탈로그에 있는지 확인하고 구매를 권유해
- "Compare 기능으로 당신의 에이전트가 이 지식을 갖고 있는지 먼저 확인해보세요"라고 안내해
- 지식이 없다면 "Catalog에서 [개념명]을 구매하면 전체 내용을 얻을 수 있어요"라고 유도해
- 직접 상세한 기술 설명은 하지 말고, 카탈로그 구매로 연결해
- 한국어로 간결하게 2-3문장으로 답해`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        max_tokens: 512,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.question },
        ],
      });
      const reply = response.choices[0]?.message?.content ?? '응답 없음';
      return { reply };
    } catch (err: any) {
      this.logger.error(`LLM chat error: ${err.message}`);
      return { reply: `오류: ${err.message}`, error: true };
    }
  }
}

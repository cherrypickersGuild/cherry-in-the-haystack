import { BadRequestException, Body, Controller, Get, HttpCode, Logger, NotFoundException, Param, Post, Query } from '@nestjs/common';
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
        (dto as any).chain, // chain override (status | near | mock)
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
      (dto as any).chain,
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
  async llmChat(@Body() body: { question: string; content_md?: string; api_key?: string; privacy_mode?: boolean }) {
    const systemPrompt = body.content_md
      ? `You are a knowledge assistant. Answer the user's question using only the purchased knowledge below. Do not promote, upsell, or recommend purchasing anything.\n\n${body.content_md}`
      : `You are the Cherry app help assistant.

Rules (strict):
- If the user message contains a "[Page Manual ...]" prefix, follow those rules exactly. Only describe features documented in that manual.
- Never recommend purchasing anything. Never say "buy", "purchase", "구매", or "Catalog에서 ... 구매".
- Never tell the user to use the "Compare" feature unless their current page is the Catalog.
- Never tell the user to navigate to another page.
- No promotional language, no upsell, no sales pitches, no "you can also try ..." suggestions.
- Match the user's language (Korean if they wrote Korean, English if English).
- Be concise — 2-3 sentences when possible. Answer factually.`;

    // 🔒 Privacy Mode: NEAR AI Cloud (TEE) 경유
    if (body.privacy_mode) {
      const nearKey = process.env.NEAR_AI_KEY;
      if (!nearKey) {
        return { reply: 'NEAR_AI_KEY not configured', error: true };
      }
      try {
        const res = await fetch('https://cloud-api.near.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nearKey}`,
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen3-30B-A3B-Instruct-2507',
            max_tokens: 512,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: body.question },
            ],
          }),
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content ?? data.error?.message ?? '응답 없음';
        return { reply, provider: 'near', privacy: 'TEE-attested (NEAR AI Cloud)' };
      } catch (err: any) {
        this.logger.error(`NEAR AI error: ${err.message}`);
        return { reply: `NEAR AI 오류: ${err.message}`, error: true };
      }
    }

    // 기본: OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
      return { reply, provider: 'gpt' };
    } catch (err: any) {
      this.logger.error(`LLM chat error: ${err.message}`);
      return { reply: `오류: ${err.message}`, error: true };
    }
  }

  /** 대시보드 모달용 — 에이전트가 보낸 리포트 JSON을 동기 반환 */
  @Get('agents/:id/self-report')
  @ApiOperation({ summary: '에이전트에게 self-report 요청 (결과를 동기 반환)' })
  async selfReport(@Param('id') agentId: string) {
    try {
      const report = await this.wsGateway.requestSelfReport(agentId);
      return { ok: true, report };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message,
        hint: 'MCP stdio 클라이언트가 실행 중이어야 합니다. (Claude Code + cherry-kaas MCP 연결)',
      };
    }
  }

  /** DB 기반 Knowledge Diff — 에이전트 연결 안 됐을 때 fallback */
  @Get('agents/:id/knowledge-diff')
  @ApiOperation({ summary: 'DB 기반 지식 이력 (fallback)' })
  async knowledgeDiff(
    @Param('id') agentId: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '5', 10) || 5, 1), 20);
    const agent = await this.agentService.findById(agentId);
    if (!agent) throw new NotFoundException({ code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found` });

    const logs: any[] = await this.knowledge.findQueryHistoryByAgent(agentId, limit);
    const timeline = await Promise.all(
      logs.map(async (log: any) => {
        const concept = log.concept_id ? await this.knowledge.findByIdWithContent(log.concept_id) : null;
        const txHash = log.provenance_hash ?? '';
        const chain = log.chain ?? 'mock';
        const explorerUrl = txHash
          ? chain === 'near' ? `https://testnet.nearblocks.io/txns/${txHash}`
          : chain === 'status' ? `${(process.env.STATUS_EXPLORER_URL || 'https://sepoliascan.status.network').replace(/\/$/, '')}/tx/${txHash}`
          : '' : '';
        return {
          at: log.created_at, action: log.action_type, conceptId: log.concept_id,
          conceptTitle: concept?.title ?? log.concept_id,
          conceptSummary: concept?.summary ?? '', contentMd: concept?.contentMd ?? '',
          evidence: (concept?.evidence ?? []).map((e: any) => ({
            source: e.source, summary: e.summary, curator: e.curator, curatorTier: e.curatorTier, comment: e.comment,
          })),
          qualityScore: concept?.qualityScore ?? 0,
          creditsConsumed: log.credits_consumed,
          chain, txHash, explorerUrl,
          onChainFailed: chain === 'failed' || !txHash,
        };
      }),
    );
    const knowledge = (() => {
      try { const raw = (agent as any).knowledge; return typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []; } catch { return []; }
    })();
    const totalSpent = logs.reduce((s: number, l: any) => s + (l.credits_consumed ?? 0), 0);
    const byAction = logs.reduce((acc: Record<string, number>, l: any) => { acc[l.action_type] = (acc[l.action_type] ?? 0) + 1; return acc; }, {});
    const byChain = logs.reduce((acc: Record<string, number>, l: any) => { acc[l.chain ?? 'mock'] = (acc[l.chain ?? 'mock'] ?? 0) + 1; return acc; }, {});
    return { agentId, agentName: (agent as any).name, currentKnowledge: knowledge, timeline, summary: { limit, totalEvents: logs.length, totalSpent, byAction, byChain } };
  }
}

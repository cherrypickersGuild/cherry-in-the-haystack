import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Knex } from 'knex';
import { randomBytes } from 'crypto';
import { KaasAgentEntity } from './entity/kaas-agent.entity';
import { getChainAdapter } from './chain-adapter/shared-adapter';
import type { KarmaTier } from './chain-adapter/interface';

@Injectable()
export class KaasAgentService {
  private readonly logger = new Logger(KaasAgentService.name);

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  /** API Key 생성 (256비트 엔트로피) */
  private generateApiKey(): string {
    return 'ck_live_' + randomBytes(32).toString('hex');
  }

  /** 에이전트 등록 */
  async register(
    userId: string,
    dto: { name: string; wallet_address?: string; wallet_type?: 'evm' | 'near'; llm_provider?: string; llm_model?: string; llm_api_key?: string; domain_interests: string[] },
  ): Promise<KaasAgentEntity> {
    const apiKey = this.generateApiKey();

    const [agent] = await this.knex('kaas.agent')
      .insert({
        user_id: userId,
        name: dto.name,
        api_key: apiKey,
        wallet_address: dto.wallet_address ?? null,
        wallet_type: dto.wallet_type ?? 'evm',
        llm_provider: dto.llm_provider ?? 'claude',
        llm_model: dto.llm_model ?? null,
        llm_api_key: dto.llm_api_key ?? null,
        domain_interests: JSON.stringify(dto.domain_interests),
        knowledge: JSON.stringify([]),
      })
      .returning('*');

    this.logger.log(`Agent registered: ${agent.id} — ${dto.name}`);
    return agent;
  }

  /** 사용자의 에이전트 목록 */
  async findByUserId(userId: string): Promise<KaasAgentEntity[]> {
    return this.knex('kaas.agent')
      .where({ user_id: userId, is_active: true })
      .orderBy('created_at', 'desc');
  }

  /** 모든 활성 에이전트 (Agent Trade 등 멀티-에이전트 화면용). */
  async findAllActive(): Promise<KaasAgentEntity[]> {
    return this.knex('kaas.agent')
      .where({ is_active: true })
      .orderBy('created_at', 'desc');
  }

  /** API Key로 에이전트 조회 (인증용) */
  async findByApiKey(apiKey: string): Promise<KaasAgentEntity | null> {
    const agent = await this.knex('kaas.agent')
      .where({ api_key: apiKey, is_active: true })
      .first();
    return agent ?? null;
  }

  /** API Key 인증 — 실패 시 예외 */
  async authenticate(apiKey: string): Promise<KaasAgentEntity> {
    const agent = await this.findByApiKey(apiKey);
    if (!agent) throw new UnauthorizedException('Invalid API Key');
    return agent;
  }

  /** LLM 모델 변경 */
  async updateModel(id: string, llmModel: string): Promise<void> {
    await this.knex('kaas.agent').where({ id }).update({ llm_model: llmModel });
    this.logger.log(`Agent model updated: ${id} → ${llmModel}`);
  }

  /** 에이전트 삭제 (소프트) */
  async deleteAgent(id: string): Promise<void> {
    await this.knex('kaas.agent').where({ id }).update({ is_active: false });
    this.logger.log(`Agent deleted: ${id}`);
  }

  /** ID로 조회 */
  async findById(id: string): Promise<KaasAgentEntity | null> {
    const agent = await this.knex('kaas.agent').where({ id }).first();
    return agent ?? null;
  }

  /** 구매/팔로우 후 knowledge 자동 추가 */
  async addToKnowledge(agentId: string, conceptId: string): Promise<void> {
    const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
    let knowledge: Array<{ topic: string; lastUpdated: string }> = [];
    try {
      const raw = agent?.knowledge;
      knowledge = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch { knowledge = []; }

    const today = new Date().toISOString().slice(0, 10);
    const existing = knowledge.find((k) => k.topic === conceptId);
    if (!existing) {
      knowledge.push({ topic: conceptId, lastUpdated: today });
    } else {
      existing.lastUpdated = today;
    }

    await this.knex('kaas.agent').where({ id: agentId }).update({
      knowledge: JSON.stringify(knowledge),
      updated_at: new Date(),
    });
    this.logger.log(`Knowledge updated: agent=${agentId}, added=${conceptId}, total=${knowledge.length}`);
  }

  /**
   * Read the agent's Karma tier from the Status Network Karma contracts onchain.
   * Falls back to a safe default if the agent has no wallet_address or RPC is down.
   * Also persists the mapped legacy tier (Bronze/Silver/Gold/Platinum) into kaas.agent
   * so that the discount table (KARMA_DISCOUNT) picks it up on the next purchase.
   */
  async refreshKarmaFromOnchain(agentId: string): Promise<KarmaTier & { walletAddress: string | null }> {
    const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
    if (!agent) throw new NotFoundException('agent not found');
    if (!agent.wallet_address) {
      return { tier: 'Bronze', balance: 0, walletAddress: null };
    }

    // Always use the Status adapter for Karma reads (Karma is a Status Network primitive)
    const adapter = getChainAdapter('status');
    const result = await adapter.getKarmaTier(agent.wallet_address);

    // Persist the mapped legacy tier so KaaS discount flow uses the fresh value
    if (agent.karma_tier !== result.tier) {
      await this.knex('kaas.agent').where({ id: agentId }).update({
        karma_tier: result.tier,
        updated_at: new Date(),
      });
      this.logger.log(`Karma tier updated: agent=${agentId} ${agent.karma_tier} → ${result.tier} (onchain=${result.onchainTierName})`);
    }

    return { ...result, walletAddress: agent.wallet_address };
  }
}

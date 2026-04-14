import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Knex } from 'knex';
import { randomBytes } from 'crypto';
import { KaasAgentEntity } from './entity/kaas-agent.entity';

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
    dto: { name: string; wallet_address?: string; llm_provider?: string; llm_model?: string; llm_api_key?: string; domain_interests: string[] },
  ): Promise<KaasAgentEntity> {
    const apiKey = this.generateApiKey();

    const [agent] = await this.knex('kaas.agent')
      .insert({
        user_id: userId,
        name: dto.name,
        api_key: apiKey,
        wallet_address: dto.wallet_address ?? null,
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
}

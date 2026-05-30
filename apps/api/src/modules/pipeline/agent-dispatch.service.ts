import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

import { SYSTEM_USER_ID } from './article-ingestion.service';

@Injectable()
export class AgentDispatchService {
  private readonly logger = new Logger(AgentDispatchService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /**
   * PENDING ai_state 중 agent_json_raw가 없는 기사를
   * 외부 에이전트 API에 배치로 던지고 응답을 agent_json_raw에 저장한다.
   *
   * 외부 에이전트: AGENT_API_URL (env)
   *   POST /api/run
   *   body:  { items: [{ id, title, content }] }
   *   resp:  { items: [{ id, ...agent_json_raw fields }] }
   */
  async dispatchPendingBatch(): Promise<{ dispatched: number; failed: number }> {
    const agentUrl = process.env.AGENT_API_URL?.replace(/\/$/, '');
    if (!agentUrl) {
      this.logger.warn('AGENT_API_URL not set — skipping dispatch');
      return { dispatched: 0, failed: 0 };
    }

    // PENDING이면서 agent_json_raw가 아직 없는 행
    const pending = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        aai.id          AS ai_state_id,
        ar.title,
        ar.content_raw  AS content
      FROM content.user_article_ai_state aai
      JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
      WHERE aai.user_id = :systemUserId::UUID
        AND aai.ai_status = 'PENDING'
        AND aai.agent_json_raw IS NULL
      ORDER BY ar.published_at DESC
      LIMIT 200
    `, { systemUserId: SYSTEM_USER_ID });

    if (pending.rows.length === 0) {
      this.logger.log('No pending items to dispatch');
      return { dispatched: 0, failed: 0 };
    }

    this.logger.log(`Dispatching ${pending.rows.length} items to agent API`);

    const items = pending.rows.map((r: any) => ({
      id: r.ai_state_id,
      title: r.title ?? '',
      content: r.content ?? '',
    }));

    let responseItems: any[] = [];
    try {
      const res = await fetch(`${agentUrl}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        signal: AbortSignal.timeout(120_000), // 2분
      });
      if (!res.ok) {
        throw new Error(`Agent API returned ${res.status}: ${await res.text()}`);
      }
      const data = await res.json() as { items?: any[] };
      responseItems = data.items ?? [];
    } catch (err) {
      this.logger.error('Agent API call failed', err);
      return { dispatched: 0, failed: pending.rows.length };
    }

    // id 기준으로 응답 매핑 (agent가 id를 echo해주면 사용, 아니면 순서로 매핑)
    const byId = new Map<string, any>(
      responseItems
        .filter((r: any) => r?.id)
        .map((r: any) => [r.id, r]),
    );

    let dispatched = 0;
    let failed = 0;

    for (let i = 0; i < pending.rows.length; i++) {
      const row = pending.rows[i];
      const result = byId.get(row.ai_state_id) ?? responseItems[i] ?? null;

      if (!result) {
        failed++;
        continue;
      }

      // id 필드 제거 후 agent_json_raw 저장
      const { id: _drop, ...agentJson } = result;

      try {
        await this.knex('content.user_article_ai_state')
          .where({ id: row.ai_state_id })
          .update({
            agent_json_raw: JSON.stringify(agentJson),
            updated_at: new Date(),
          });
        dispatched++;
      } catch (err) {
        this.logger.error(`Failed to save agent_json_raw for ${row.ai_state_id}`, err);
        failed++;
      }
    }

    this.logger.log(`dispatchPendingBatch done — dispatched: ${dispatched}, failed: ${failed}`);
    return { dispatched, failed };
  }
}

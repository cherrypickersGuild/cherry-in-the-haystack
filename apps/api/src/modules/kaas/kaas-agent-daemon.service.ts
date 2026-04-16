import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { io as ioClient, Socket } from 'socket.io-client';

/**
 * KaaS Agent Daemon — NestJS 서버 시작 시 자동으로 WebSocket 에이전트 접속.
 *
 * 로컬이든 배포든 NestJS가 뜨면 에이전트가 자동으로 붙음.
 * Claude Code에 의존하지 않음.
 *
 * 환경변수:
 *   KAAS_WS_URL — WebSocket 접속 대상 (기본: https://solteti.site, 로컬: http://localhost:4000)
 *   KAAS_AGENT_API_KEY — 에이전트 인증 키
 */
@Injectable()
export class KaasAgentDaemonService implements OnModuleInit {
  private readonly logger = new Logger(KaasAgentDaemonService.name);
  private socket: Socket | null = null;

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  async onModuleInit() {
    const apiKey = process.env.KAAS_AGENT_API_KEY;
    if (!apiKey) {
      this.logger.warn('KAAS_AGENT_API_KEY not set — agent daemon disabled');
      return;
    }

    // 서버 WebSocket 준비될 시간 확보
    setTimeout(() => this.connect(apiKey), 3000);
  }

  private connect(apiKey: string) {
    const wsUrl = process.env.KAAS_WS_URL ?? 'https://solteti.site';
    this.logger.log(`Connecting to ${wsUrl}/kaas ...`);

    this.socket = ioClient(`${wsUrl}/kaas`, {
      path: '/socket.io',
      auth: { api_key: apiKey },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
    });

    this.socket.on('connect', () => {
      this.logger.log(`Connected (sid=${this.socket!.id})`);
    });

    this.socket.on('connected', (data: any) => {
      this.logger.log(`Authenticated: ${data.agentName} (${data.agentId})`);
    });

    this.socket.on('connect_error', (err) => {
      this.logger.warn(`Connection failed: ${err.message}`);
    });

    this.socket.on('disconnect', (reason) => {
      this.logger.warn(`Disconnected: ${reason}`);
    });

    // Compare 요청 → DB에서 knowledge 읽어서 응답
    this.socket.on('request_knowledge', async () => {
      this.logger.log('request_knowledge received');
      try {
        const agent = await this.findAgentByKey(apiKey);
        if (!agent) return;
        const knowledge = this.parseKnowledge(agent.knowledge);
        this.socket!.emit('submit_knowledge', knowledge);
        this.logger.log(`Submitted ${knowledge.length} topics`);
      } catch (err: any) {
        this.logger.error(`request_knowledge failed: ${err.message}`);
      }
    });

    // Self-report 요청 → DB에서 조회해서 리포트 생성
    this.socket.on('request_self_report', async (req: any) => {
      this.logger.log('request_self_report received');
      try {
        const agent = await this.findAgentByKey(apiKey);
        if (!agent) return;

        const knowledge = this.parseKnowledge(agent.knowledge);
        const recentLogs = await this.knex('kaas.query_log')
          .where({ agent_id: agent.id })
          .orderBy('created_at', 'desc')
          .limit(10);

        const recentEvents = await Promise.all(
          recentLogs.map(async (log: any) => {
            const concept = log.concept_id
              ? await this.knex('kaas.concept').where({ id: log.concept_id }).select('title', 'quality_score').first()
              : null;
            return {
              at: log.created_at,
              action: log.action_type,
              conceptId: log.concept_id,
              conceptTitle: concept?.title ?? log.concept_id,
              creditsConsumed: log.credits_consumed,
              qualityScore: concept?.quality_score ?? 0,
              chain: log.chain ?? 'status',
              txHash: log.provenance_hash ?? '',
              onChain: !!log.provenance_hash,
            };
          }),
        );

        const totalSpent = recentEvents.reduce((s, e) => s + (e.creditsConsumed ?? 0), 0);

        const report = {
          reporter: 'cherry-kaas-agent-daemon',
          reported_at: new Date().toISOString(),
          triggered_by: 'request',
          current_knowledge: knowledge,
          recent_events: recentEvents,
          summary: {
            total_events: recentEvents.length,
            credits_spent: totalSpent,
          },
          session_pid: process.pid,
          uptime_seconds: Math.floor(process.uptime()),
        };

        this.socket!.emit('submit_self_report', report);
        this.logger.log(`Self-report submitted (${recentEvents.length} events, ${totalSpent}cr spent)`);
      } catch (err: any) {
        this.logger.error(`request_self_report failed: ${err.message}`);
      }
    });
  }

  private async findAgentByKey(apiKey: string) {
    return this.knex('kaas.agent').where({ api_key: apiKey }).first();
  }

  private parseKnowledge(raw: any): Array<{ topic: string; lastUpdated: string }> {
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
      return arr.map((k: any) => ({
        topic: k.topic ?? k.name ?? '',
        lastUpdated: k.lastUpdated ?? k.last_updated ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }
}

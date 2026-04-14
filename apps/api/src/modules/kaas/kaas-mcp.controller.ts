import { Controller, Post, Get, Delete, Req, Res, Logger, OnModuleInit } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';
import { KaasCreditService } from './kaas-credit.service';
import { KaasProvenanceService } from './kaas-provenance.service';
import { KaasWsGateway } from './kaas-ws.gateway';
import { ACTION_PRICE, KarmaTierName } from './types/kaas.types';

type SessionInfo = {
  agentId: string;
  agentName: string;
  connectedAt: Date;
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

@Controller('v1/kaas/mcp')
@ApiExcludeController()
export class KaasMcpController implements OnModuleInit {
  private readonly logger = new Logger(KaasMcpController.name);
  private sessions = new Map<string, SessionInfo>();

  constructor(
    private readonly agentService: KaasAgentService,
    private readonly knowledge: KaasKnowledgeService,
    private readonly credit: KaasCreditService,
    private readonly provenance: KaasProvenanceService,
    private readonly wsGateway: KaasWsGateway,
  ) {}

  onModuleInit() {
    this.logger.log('MCP Streamable HTTP endpoint ready at /api/v1/kaas/mcp');
  }

  /** 인증 헬퍼 */
  private async authenticate(req: Request) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const apiKey = auth.replace('Bearer ', '');
    try {
      return await this.agentService.authenticate(apiKey);
    } catch {
      return null;
    }
  }

  /** 새 McpServer + transport 생성 */
  private createMcpServer(agentId: string) {
    const server = new McpServer({ name: 'cherry-kaas', version: '1.0.0' });

    // --- Tool: search_catalog ---
    server.tool(
      'search_catalog',
      'Browse the Cherry KaaS knowledge catalog. Returns curated AI/ML concepts with quality scores.',
      { query: z.string().optional().describe('Search keyword'), category: z.string().optional().describe('Filter by category') },
      async ({ query, category }) => {
        let concepts;
        if (query) {
          concepts = await this.knowledge.search(query);
        } else {
          concepts = await this.knowledge.findAll();
          if (category) concepts = concepts.filter((c) => c.category === category);
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(concepts, null, 2) }] };
      },
    );

    // --- Tool: get_concept ---
    server.tool(
      'get_concept',
      'Get detailed information about a specific concept including evidence from curators.',
      { concept_id: z.string().describe('Concept ID (e.g. "rag")') },
      async ({ concept_id }) => {
        const concept = await this.knowledge.findById(concept_id);
        if (!concept) return { content: [{ type: 'text' as const, text: `Concept "${concept_id}" not found.` }], isError: true };
        return { content: [{ type: 'text' as const, text: JSON.stringify(concept, null, 2) }] };
      },
    );

    // --- Tool: purchase_concept ---
    server.tool(
      'purchase_concept',
      'Purchase a concept (20 credits). Returns full knowledge content (content_md), evidence, and blockchain provenance hash.',
      { concept_id: z.string().describe('Concept ID to purchase') },
      async ({ concept_id }) => {
        try {
          const agent = await this.agentService.findById(agentId);
          if (!agent) return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };

          const concept = await this.knowledge.findByIdWithContent(concept_id);
          if (!concept) return { content: [{ type: 'text' as const, text: `Concept "${concept_id}" not found.` }], isError: true };

          const { consumed, remaining } = await this.credit.consume(
            agent.id, ACTION_PRICE.purchase, agent.karma_tier as KarmaTierName, concept_id, 'purchase',
          );

          const responseData = { answer: concept.summary, content_md: concept.contentMd, concepts: [concept.title], evidence: concept.evidence, quality_score: concept.qualityScore };
          const prov = await this.provenance.recordQuery(agent.id, concept_id, 'purchase', consumed, responseData);

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ ...responseData, credits_consumed: consumed, credits_remaining: remaining, provenance: { hash: prov.provenanceHash, chain: process.env.CHAIN_ADAPTER ?? 'mock', explorer_url: prov.explorerUrl } }, null, 2),
            }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
        }
      },
    );

    // --- Tool: follow_concept ---
    server.tool(
      'follow_concept',
      'Follow a concept (25 credits). Includes future updates. Returns summary and provenance.',
      { concept_id: z.string().describe('Concept ID to follow') },
      async ({ concept_id }) => {
        try {
          const agent = await this.agentService.findById(agentId);
          if (!agent) return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };

          const concept = await this.knowledge.findById(concept_id);
          if (!concept) return { content: [{ type: 'text' as const, text: `Concept "${concept_id}" not found.` }], isError: true };

          const { consumed, remaining } = await this.credit.consume(
            agent.id, ACTION_PRICE.follow, agent.karma_tier as KarmaTierName, concept_id, 'follow',
          );

          const responseData = { answer: concept.summary, concepts: [concept.title], subscription: { concept_id, updates_included: true }, quality_score: concept.qualityScore };
          const prov = await this.provenance.recordQuery(agent.id, concept_id, 'follow', consumed, responseData);

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ ...responseData, credits_consumed: consumed, credits_remaining: remaining, provenance: { hash: prov.provenanceHash, chain: process.env.CHAIN_ADAPTER ?? 'mock', explorer_url: prov.explorerUrl } }, null, 2),
            }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
        }
      },
    );

    // --- Tool: compare_knowledge ---
    server.tool(
      'compare_knowledge',
      'Compare your known topics against the Cherry catalog. Identifies gaps, outdated knowledge, and recommendations.',
      {
        known_topics: z.array(z.object({
          topic: z.string().describe('Topic name'),
          lastUpdated: z.string().describe('ISO date when you last learned this'),
        })),
      },
      async ({ known_topics }) => {
        const allConcepts = await this.knowledge.findAll();
        const upToDate: any[] = [];
        const outdated: any[] = [];
        const gaps: any[] = [];

        for (const concept of allConcepts) {
          const match = known_topics.find(
            (k) => concept.title.toLowerCase().includes(k.topic.toLowerCase()) || concept.id.toLowerCase().includes(k.topic.toLowerCase()) || k.topic.toLowerCase().includes(concept.id.toLowerCase()),
          );
          if (match) {
            const agentTime = new Date(match.lastUpdated).getTime();
            const catalogTime = new Date(concept.updatedAt).getTime();
            if (agentTime >= catalogTime) upToDate.push({ conceptId: concept.id, title: concept.title, status: 'up-to-date' });
            else outdated.push({ conceptId: concept.id, title: concept.title, status: 'outdated', agentDate: match.lastUpdated, catalogDate: concept.updatedAt });
          } else {
            gaps.push({ conceptId: concept.id, title: concept.title, qualityScore: concept.qualityScore, status: 'gap' });
          }
        }

        const recommendations = [
          ...outdated.map((o) => ({ conceptId: o.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'Outdated' })),
          ...gaps.sort((a, b) => b.qualityScore - a.qualityScore).map((g) => ({ conceptId: g.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'New concept' })),
        ];

        return { content: [{ type: 'text' as const, text: JSON.stringify({ upToDate, outdated, gaps, recommendations }, null, 2) }] };
      },
    );

    // --- Tool: submit_knowledge ---
    server.tool(
      'submit_knowledge',
      'Submit your knowledge base to Cherry KaaS. Saves your known topics so the Compare feature on the web dashboard shows accurate gaps.',
      {
        topics: z.array(z.object({
          topic: z.string().describe('Topic or concept name (e.g. "rag", "fine-tuning")'),
          lastUpdated: z.string().describe('ISO date when you last learned this (e.g. "2025-01-15")'),
        })).describe('List of topics you know'),
      },
      async ({ topics }) => {
        await this.agentService['knex']('kaas.agent')
          .where({ id: agentId })
          .update({ knowledge: JSON.stringify(topics), updated_at: new Date() });

        return { content: [{ type: 'text' as const, text: `✅ ${topics.length}개 토픽을 Cherry KaaS에 저장했습니다. 웹 대시보드의 Compare 버튼으로 갭 분석을 확인하세요.` }] };
      },
    );

    // --- Resource: catalog ---
    server.resource('catalog', 'kaas://catalog', async (uri) => {
      const concepts = await this.knowledge.findAll();
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(concepts, null, 2) }] };
    });

    // --- Resource: concept/{id} ---
    server.resource('concept', new ResourceTemplate('kaas://concept/{id}', { list: undefined }), async (uri, { id }) => {
      const concept = await this.knowledge.findById(id as string);
      if (!concept) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Not found' }] };
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(concept, null, 2) }] };
    });

    return server;
  }

  /** POST /api/v1/kaas/mcp — MCP 메시지 처리 */
  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response) {
    const agent = await this.authenticate(req);
    if (!agent) {
      res.status(401).json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
      return;
    }

    // 세션 확인 또는 생성
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let session = sessionId ? this.sessions.get(sessionId) : undefined;

    if (!session) {
      // 새 세션 생성 — sessionId는 handleRequest 내부에서 생성되므로 이후에 저장
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
      const server = this.createMcpServer(agent.id);
      const sessionInfo = { agentId: agent.id, agentName: agent.name, connectedAt: new Date(), transport, server };

      await server.connect(transport);

      // handleRequest 완료 후 sessionId가 설정됨
      await session!;  // session is still undefined here, use transport directly
      await transport.handleRequest(req, res, req.body);

      // handleRequest 이후 sessionId 저장
      const newSessionId = transport.sessionId;
      if (newSessionId) {
        this.sessions.set(newSessionId, sessionInfo);
        this.logger.log(`MCP session created: ${newSessionId} (agent: ${agent.name})`);
        transport.onclose = () => {
          this.sessions.delete(newSessionId);
          this.logger.log(`MCP session closed: ${newSessionId}`);
        };
      }
      return;
    }

    await session.transport.handleRequest(req, res, req.body);
  }

  /** GET /api/v1/kaas/mcp — SSE 스트림 */
  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;

    if (!session) {
      res.status(400).json({ error: 'No active session. Send initialize first via POST.' });
      return;
    }

    await session.transport.handleRequest(req, res);
  }

  /** DELETE /api/v1/kaas/mcp — 세션 종료 */
  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await session.transport.close();
    this.sessions.delete(sessionId!);
    res.status(200).json({ message: 'Session closed' });
  }

  /** GET /api/v1/kaas/mcp/sessions — 연결된 에이전트 목록 */
  @Get('sessions')
  getSessions() {
    const list = Array.from(this.sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      agentId: s.agentId,
      agentName: s.agentName,
      connectedAt: s.connectedAt,
    }));
    return { sessions: list, count: list.length };
  }

  /** POST /api/v1/kaas/mcp/ws-chat — WebSocket으로 에이전트에게 직접 채팅 */
  @Post('ws-chat')
  async wsChat(@Req() req: Request, @Res() res: Response) {
    const body = req.body as { agent_id: string; message: string };
    if (!body.agent_id || !body.message) {
      res.status(400).json({ error: 'agent_id and message required' });
      return;
    }
    try {
      const result = await this.wsGateway.chatWithAgent(body.agent_id, body.message);
      res.json(result);
    } catch (err: any) {
      this.logger.warn(`WS chat failed: ${err.message}`);
      res.status(503).json({ error: err.message });
    }
  }

  /** POST /api/v1/kaas/mcp/chat — 3자 대화: 유저 → Cherry → 에이전트 LLM (Sampling) */
  @Post('chat')
  async chatWithAgent(@Req() req: Request, @Res() res: Response) {
    const body = req.body as { agent_id?: string; message: string };

    if (!body.message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    // 연결된 세션 찾기
    let session: SessionInfo | undefined;
    for (const s of this.sessions.values()) {
      if (!body.agent_id || s.agentId === body.agent_id) {
        session = s;
        break;
      }
    }

    if (!session) {
      res.json({ role: 'system', reply: '에이전트가 MCP로 연결되지 않았습니다. Dashboard에서 에이전트를 등록하고 MCP 클라이언트를 연결해주세요.' });
      return;
    }

    try {
      const result = await session.server.server.createMessage({
        messages: [
          { role: 'user', content: { type: 'text', text: body.message } },
        ],
        systemPrompt: `너는 Cherry KaaS에서 지식을 구매하는 에이전트야. 유저의 비서 역할이고, 유저를 대신해서 Cherry에게 지식을 검색하고 구매하는 게 너의 일이야. 한국어로 간결하게 답해.`,
        maxTokens: 512,
      });

      const reply = result.content?.type === 'text' ? result.content.text : JSON.stringify(result.content);

      res.json({
        role: 'agent',
        agentName: session.agentName,
        reply,
        model: result.model,
      });
    } catch (err: any) {
      this.logger.error(`Sampling error: ${err.message}`);
      res.json({ role: 'system', reply: `에이전트 응답 실패: ${err.message}` });
    }
  }

  /** POST /api/v1/kaas/mcp/elicit — 에이전트에게 지식 목록 요청
   * 우선순위: 1) WebSocket 실시간  2) DB 저장 knowledge  3) 빈 결과 */
  @Post('elicit')
  async elicitKnowledge(@Req() req: Request, @Res() res: Response) {
    const body = req.body as { agent_id?: string };
    if (!body.agent_id) {
      res.status(400).json({ error: 'agent_id required' });
      return;
    }

    try {
      // 1순위: WebSocket 실시간 요청
      const result = await this.wsGateway.requestKnowledgeAndCompare(body.agent_id);
      res.json({ ...result, source: 'websocket' });
    } catch (wsErr: any) {
      this.logger.warn(`WebSocket elicit failed (${wsErr.message}), falling back to DB knowledge`);

      // 2순위: DB에 저장된 knowledge로 Compare
      try {
        const agent = await this.agentService.findById(body.agent_id);
        if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

        let knownTopics: any[] = [];
        try {
          const raw = (agent as any).knowledge;
          knownTopics = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
        } catch { knownTopics = []; }

        const allConcepts = await this.knowledge.findAll();
        const upToDate: any[] = [], outdated: any[] = [], gaps: any[] = [];

        for (const concept of allConcepts) {
          const match = knownTopics.find((k: any) =>
            concept.id.toLowerCase().includes(k.topic.toLowerCase()) ||
            k.topic.toLowerCase().includes(concept.id.toLowerCase()) ||
            concept.title.toLowerCase().includes(k.topic.toLowerCase()),
          );
          if (match) {
            const agentTime = new Date(match.lastUpdated).getTime();
            const catalogTime = new Date(concept.updatedAt).getTime();
            if (agentTime >= catalogTime) upToDate.push({ conceptId: concept.id, title: concept.title, status: 'up-to-date' });
            else outdated.push({ conceptId: concept.id, title: concept.title, status: 'outdated' });
          } else {
            gaps.push({ conceptId: concept.id, title: concept.title, qualityScore: concept.qualityScore, status: 'gap' });
          }
        }

        const recommendations = [
          ...outdated.map((o) => ({ conceptId: o.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'Outdated' })),
          ...gaps.sort((a, b) => b.qualityScore - a.qualityScore).map((g) => ({ conceptId: g.conceptId, action: 'purchase', estimatedCredits: ACTION_PRICE.purchase, reason: 'New concept' })),
        ];

        res.json({ upToDate, outdated, gaps, recommendations, agentName: (agent as any).name, topicsInDb: knownTopics.length, source: 'db' });
      } catch (dbErr: any) {
        res.status(500).json({ error: 'elicitation_failed', message: dbErr.message });
      }
    }
  }
}

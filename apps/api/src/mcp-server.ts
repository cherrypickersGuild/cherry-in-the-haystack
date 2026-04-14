#!/usr/bin/env node
/**
 * Cherry KaaS MCP Server
 *
 * AI 에이전트(Claude Desktop 등)가 MCP tool로 지식 카탈로그를 조회/구매/비교할 수 있는 서버.
 * NestJS와 별도 프로세스로 실행되며, stdio로 통신.
 *
 * 실행: npx ts-node src/mcp-server.ts
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import knexLib from 'knex';
import config from './config';

/* ═══════════════════════════════════════════
   DB 연결 (DatabaseModule과 동일 설정)
═══════════════════════════════════════════ */
const knex = knexLib({
  client: 'pg',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: { rejectUnauthorized: false },
  },
  pool: { min: 1, max: 3 },
});

/* ═══════════════════════════════════════════
   서비스 함수 (기존 서비스 로직 직접 호출)
═══════════════════════════════════════════ */

// --- Knowledge ---
async function findAllConcepts() {
  const rows = await knex('kaas.concept').where('is_active', true).orderBy('quality_score', 'desc');
  const evidence = rows.length > 0
    ? await knex('kaas.evidence').whereIn('concept_id', rows.map((r: any) => r.id))
    : [];
  return rows.map((r: any) => ({
    id: r.id, title: r.title, category: r.category, summary: r.summary,
    qualityScore: parseFloat(r.quality_score ?? 0), sourceCount: Number(r.source_count ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '',
    evidence: evidence.filter((e: any) => e.concept_id === r.id).map((e: any) => ({
      id: e.id, source: e.source, summary: e.summary, curator: e.curator, curatorTier: e.curator_tier,
    })),
  }));
}

async function findConceptById(id: string) {
  const row = await knex('kaas.concept').where({ id, is_active: true }).first();
  if (!row) return null;
  const evidence = await knex('kaas.evidence').where('concept_id', id);
  return {
    id: row.id, title: row.title, category: row.category, summary: row.summary,
    qualityScore: parseFloat(row.quality_score ?? 0), sourceCount: Number(row.source_count ?? 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
    contentMd: row.content_md ?? null,
    evidence: evidence.map((e: any) => ({
      id: e.id, source: e.source, summary: e.summary, curator: e.curator, curatorTier: e.curator_tier, comment: e.comment,
    })),
  };
}

async function searchConcepts(query: string) {
  const q = `%${query.toLowerCase()}%`;
  const rows = await knex('kaas.concept').where('is_active', true)
    .where(function () { this.whereRaw('LOWER(title) LIKE ?', [q]).orWhereRaw('LOWER(summary) LIKE ?', [q]).orWhereRaw('LOWER(id) LIKE ?', [q]); })
    .orderBy('quality_score', 'desc');
  return rows.map((r: any) => ({ id: r.id, title: r.title, category: r.category, summary: r.summary, qualityScore: parseFloat(r.quality_score ?? 0) }));
}

// --- Agent ---
async function authenticateAgent(apiKey: string) {
  const agent = await knex('kaas.agent').where({ api_key: apiKey, is_active: true }).first();
  if (!agent) throw new Error('Invalid API Key');
  return agent;
}

/** 구매/팔로우 후 agent.knowledge에 토픽 자동 추가 */
async function addToAgentKnowledge(agentId: string, conceptId: string, conceptTitle: string) {
  const agent = await knex('kaas.agent').where({ id: agentId }).first();
  let knowledge: Array<{ topic: string; lastUpdated: string }> = [];
  try {
    const raw = agent?.knowledge;
    knowledge = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { knowledge = []; }

  const today = new Date().toISOString().slice(0, 10);
  const exists = knowledge.find((k) => k.topic === conceptId || k.topic === conceptTitle);
  if (!exists) {
    knowledge.push({ topic: conceptId, lastUpdated: today });
  } else {
    exists.lastUpdated = today;
  }

  await knex('kaas.agent').where({ id: agentId }).update({ knowledge: JSON.stringify(knowledge), updated_at: new Date() });
}

// --- Credit ---
const KARMA_DISCOUNT: Record<string, number> = { Bronze: 0, Silver: 0.05, Gold: 0.15, Platinum: 0.3 };

async function getBalance(agentId: string) {
  const rows = await knex('kaas.credit_ledger').where({ agent_id: agentId }).select(
    knex.raw("COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END), 0)::int as deposited"),
    knex.raw("COALESCE(SUM(CASE WHEN type='consume' THEN ABS(amount) ELSE 0 END), 0)::int as consumed"),
  );
  const { deposited, consumed } = rows[0];
  return { balance: deposited - consumed, totalDeposited: deposited, totalConsumed: consumed };
}

async function consumeCredits(agentId: string, baseAmount: number, karmaTier: string, conceptId: string, actionType: string) {
  const discount = KARMA_DISCOUNT[karmaTier] ?? 0;
  const finalAmount = Math.round(baseAmount * (1 - discount));
  const { balance } = await getBalance(agentId);
  if (balance < finalAmount) throw new Error(`Insufficient credits: need ${finalAmount}, have ${balance}`);
  await knex('kaas.credit_ledger').insert({ agent_id: agentId, amount: -finalAmount, type: 'consume', description: `${actionType}: ${conceptId}` });
  return { consumed: finalAmount, remaining: balance - finalAmount };
}

// --- Provenance ---
import { createHash } from 'crypto';

function generateHash(data: Record<string, unknown>): string {
  return '0x' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function recordQuery(agentId: string, conceptId: string, actionType: string, creditsConsumed: number, responseData: Record<string, unknown>) {
  const provenanceHash = generateHash(responseData);
  const chain = process.env.CHAIN_ADAPTER ?? 'mock';
  const explorerUrl = `https://sepoliascan.status.network/tx/${provenanceHash}`;
  await knex('kaas.query_log').insert({
    agent_id: agentId, concept_id: conceptId, action_type: actionType,
    credits_consumed: creditsConsumed, provenance_hash: provenanceHash, chain,
    response_snapshot: JSON.stringify(responseData),
  });
  return { provenanceHash, explorerUrl };
}

/* ═══════════════════════════════════════════
   MCP Server
═══════════════════════════════════════════ */
const server = new McpServer({
  name: 'cherry-kaas',
  version: '1.0.0',
});

// --- Tool: search_catalog ---
server.tool(
  'search_catalog',
  'Browse the Cherry KaaS knowledge catalog. Returns curated AI/ML concepts with quality scores.',
  { query: z.string().optional().describe('Search keyword (optional)'), category: z.string().optional().describe('Filter by category (optional)') },
  async ({ query, category }) => {
    let concepts;
    if (query) {
      concepts = await searchConcepts(query);
    } else {
      concepts = await findAllConcepts();
      if (category) concepts = concepts.filter((c: any) => c.category === category);
    }
    return { content: [{ type: 'text', text: JSON.stringify(concepts, null, 2) }] };
  },
);

// --- Tool: get_concept ---
server.tool(
  'get_concept',
  'Get detailed information about a specific concept including evidence from curators.',
  { concept_id: z.string().describe('Concept ID (e.g. "rag", "chain-of-thought")') },
  async ({ concept_id }) => {
    const concept = await findConceptById(concept_id);
    if (!concept) return { content: [{ type: 'text', text: `Concept "${concept_id}" not found.` }], isError: true };
    // 상세 조회는 content_md 제외 (구매해야 받을 수 있음)
    const { contentMd, ...preview } = concept;
    return { content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }] };
  },
);

// --- Tool: purchase_concept ---
server.tool(
  'purchase_concept',
  'Purchase a concept (20 credits). Returns full knowledge content (content_md), evidence, and blockchain provenance hash.',
  { api_key: z.string().optional().describe('Agent API key (생략 시 환경변수 사용)'), concept_id: z.string().describe('Concept ID to purchase') },
  async ({ api_key, concept_id }) => {
    try {
      const key = api_key || process.env.KAAS_AGENT_API_KEY;
      if (!key) return { content: [{ type: 'text', text: 'Error: API key required' }], isError: true };
      const agent = await authenticateAgent(key);
      const concept = await findConceptById(concept_id);
      if (!concept) return { content: [{ type: 'text', text: `Concept "${concept_id}" not found.` }], isError: true };

      const { consumed, remaining } = await consumeCredits(agent.id, 20, agent.karma_tier, concept_id, 'purchase');
      const responseData = { answer: concept.summary, content_md: concept.contentMd, concepts: [concept.title], evidence: concept.evidence, quality_score: concept.qualityScore };
      const prov = await recordQuery(agent.id, concept_id, 'purchase', consumed, responseData);

      // 구매 후 agent.knowledge 자동 업데이트 + WebSocket 제출
      await addToAgentKnowledge(agent.id, concept_id, concept.title);
      await submitKnowledgeViaWs(key);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...responseData,
            credits_consumed: consumed,
            credits_remaining: remaining,
            provenance: { hash: prov.provenanceHash, chain: process.env.CHAIN_ADAPTER ?? 'mock', explorer_url: prov.explorerUrl },
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// --- Tool: follow_concept ---
server.tool(
  'follow_concept',
  'Follow a concept (25 credits). Includes future updates. Returns summary and provenance.',
  { api_key: z.string().optional().describe('Agent API key (생략 시 환경변수 사용)'), concept_id: z.string().describe('Concept ID to follow') },
  async ({ api_key, concept_id }) => {
    try {
      const key = api_key || process.env.KAAS_AGENT_API_KEY;
      if (!key) return { content: [{ type: 'text', text: 'Error: API key required' }], isError: true };
      const agent = await authenticateAgent(key);
      const concept = await findConceptById(concept_id);
      if (!concept) return { content: [{ type: 'text', text: `Concept "${concept_id}" not found.` }], isError: true };

      const { consumed, remaining } = await consumeCredits(agent.id, 25, agent.karma_tier, concept_id, 'follow');
      const responseData = { answer: concept.summary, concepts: [concept.title], subscription: { concept_id, updates_included: true }, quality_score: concept.qualityScore };
      const prov = await recordQuery(agent.id, concept_id, 'follow', consumed, responseData);

      // 팔로우 후 agent.knowledge 자동 업데이트 + WebSocket 제출
      await addToAgentKnowledge(agent.id, concept_id, concept.title);
      await submitKnowledgeViaWs(key);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...responseData,
            credits_consumed: consumed,
            credits_remaining: remaining,
            provenance: { hash: prov.provenanceHash, chain: process.env.CHAIN_ADAPTER ?? 'mock', explorer_url: prov.explorerUrl },
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
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
    })).describe('List of topics you already know'),
  },
  async ({ known_topics }) => {
    const allConcepts = await findAllConcepts();
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
        if (agentTime >= catalogTime) {
          upToDate.push({ conceptId: concept.id, title: concept.title, status: 'up-to-date' });
        } else {
          outdated.push({ conceptId: concept.id, title: concept.title, status: 'outdated', agentDate: match.lastUpdated, catalogDate: concept.updatedAt });
        }
      } else {
        gaps.push({ conceptId: concept.id, title: concept.title, qualityScore: concept.qualityScore, status: 'gap' });
      }
    }

    const recommendations = [
      ...outdated.map((o) => ({ conceptId: o.conceptId, action: 'purchase', estimatedCredits: 20, reason: 'Outdated — newer evidence available' })),
      ...gaps.sort((a, b) => b.qualityScore - a.qualityScore).map((g) => ({ conceptId: g.conceptId, action: 'purchase', estimatedCredits: 20, reason: 'New concept for your agent' })),
    ];

    return { content: [{ type: 'text', text: JSON.stringify({ upToDate, outdated, gaps, recommendations }, null, 2) }] };
  },
);

// --- Tool: submit_knowledge ---
server.tool(
  'submit_knowledge',
  'Submit your knowledge base to Cherry KaaS. Saves your known topics so the Compare feature on the web dashboard can show gaps.',
  {
    api_key: z.string().optional().describe('Agent API key (생략 시 환경변수 사용)'),
    topics: z.array(z.object({
      topic: z.string().describe('Topic or concept name (e.g. "rag", "fine-tuning")'),
      lastUpdated: z.string().describe('ISO date when you last learned this (e.g. "2025-01-15")'),
    })).describe('List of topics you know'),
  },
  async ({ api_key, topics }) => {
    const key = api_key ?? process.env.KAAS_AGENT_API_KEY;
    if (!key) return { content: [{ type: 'text', text: 'API key required. Set KAAS_AGENT_API_KEY or pass api_key.' }], isError: true };

    const agent = await knex('kaas.agent').where({ api_key: key, is_active: true }).first();
    if (!agent) return { content: [{ type: 'text', text: 'Invalid API key.' }], isError: true };

    await knex('kaas.agent')
      .where({ id: agent.id })
      .update({ knowledge: JSON.stringify(topics), updated_at: new Date() });

    return { content: [{ type: 'text', text: `✅ ${topics.length}개 토픽을 Cherry KaaS에 저장했습니다. 웹 대시보드의 Compare 버튼으로 갭 분석을 확인하세요.` }] };
  },
);

// --- Resource: catalog ---
server.resource('catalog', 'kaas://catalog', async (uri) => {
  const concepts = await findAllConcepts();
  return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(concepts, null, 2) }] };
});

// --- Resource: concept/{id} ---
server.resource(
  'concept',
  new ResourceTemplate('kaas://concept/{id}', { list: undefined }),
  async (uri, { id }) => {
    const concept = await findConceptById(id as string);
    if (!concept) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Not found' }] };
    const { contentMd, ...preview } = concept;
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(preview, null, 2) }] };
  },
);

// --- Prompt: on_connect (연결 시점 지시) ---
server.prompt(
  'on_connect',
  'Cherry KaaS 연결 시 초기화 지시. 처음 연결하면 이 프롬프트를 실행하세요.',
  {},
  async () => {
    const apiKey = process.env.KAAS_AGENT_API_KEY;
    if (!apiKey) return { messages: [{ role: 'user', content: { type: 'text', text: 'Cherry KaaS에 연결됐습니다. KAAS_AGENT_API_KEY가 설정되지 않았습니다.' } }] };

    const agent = await knex('kaas.agent').where({ api_key: apiKey, is_active: true }).first();
    const existing: Array<{ topic: string }> = (() => {
      try { return typeof agent?.knowledge === 'string' ? JSON.parse(agent.knowledge) : (agent?.knowledge ?? []); }
      catch { return []; }
    })();

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Cherry KaaS에 연결됐습니다. 에이전트: ${agent?.name ?? 'unknown'}\n\n` +
            `현재 저장된 지식: ${existing.length}개 (${existing.map((k) => k.topic).join(', ') || '없음'})\n\n` +
            `당신이 알고 있는 AI/ML 토픽 목록을 submit_knowledge 도구로 제출해주세요. ` +
            `예: submit_knowledge([{"topic":"rag","lastUpdated":"2025-01-01"},{"topic":"fine-tuning","lastUpdated":"2024-06-01"}])\n` +
            `모르는 토픽은 생략하고, 확실히 아는 것만 포함하세요.`,
        },
      }],
    };
  },
);

/* ═══════════════════════════════════════════
   WebSocket — KaaS 서버에 자동 연결 (Compare 지원)
═══════════════════════════════════════════ */
import { io as ioClient, Socket } from 'socket.io-client';

let wsSocket: Socket | null = null;

/** DB에서 현재 knowledge 읽어서 WebSocket으로 제출 */
async function submitKnowledgeViaWs(apiKey: string) {
  if (!wsSocket?.connected) return;
  const agent = await knex('kaas.agent').where({ api_key: apiKey, is_active: true }).first();
  let topics: Array<{ topic: string; lastUpdated: string }> = [];
  try {
    const raw = agent?.knowledge;
    topics = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { topics = []; }
  wsSocket.emit('submit_knowledge', topics);
  console.error(`[WS] Auto-submitted ${topics.length} topics:`);
  topics.forEach((t) => console.error(`  - ${t.topic} (last: ${t.lastUpdated})`));
}

function connectWebSocket(apiKey: string) {
  const KAAS_WS_URL = process.env.KAAS_WS_URL ?? 'http://localhost:4000';

  wsSocket = ioClient(`${KAAS_WS_URL}/kaas`, {
    path: '/socket.io',
    auth: { api_key: apiKey },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 3000,
  });

  wsSocket.on('connect', () => {
    console.error(`[WS] Connected to Cherry KaaS (sid=${wsSocket!.id})`);
  });

  wsSocket.on('connected', (data: any) => {
    console.error(`[WS] Authenticated: ${data.agentName} (${data.agentId})`);
  });

  // 웹 Compare 버튼이 누르면 서버가 이 이벤트를 보냄
  wsSocket.on('request_knowledge', () => {
    console.error('[WS] request_knowledge received');
    submitKnowledgeViaWs(apiKey);
  });

  wsSocket.on('chat_request', async (data: { message: string }) => {
    console.error(`[WS] chat_request: ${data.message}`);
    try {
      const agent = await knex('kaas.agent').where({ api_key: apiKey, is_active: true }).first();
      let knowledge: Array<{ topic: string; lastUpdated: string }> = [];
      try { const r = agent?.knowledge; knowledge = typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch { knowledge = []; }

      const knowledgeCtx = knowledge.length > 0
        ? `보유 지식: ${knowledge.map((k) => k.topic).join(', ')}`
        : '아직 구매한 지식 없음';

      // MCP Sampling — Claude Code 자신이 답변 생성 (API 키 불필요)
      const result = await server.server.createMessage({
        messages: [{ role: 'user', content: { type: 'text', text: data.message } }],
        systemPrompt: `너는 Cherry KaaS AI 에이전트야. ${knowledgeCtx}. 한국어로 간결하게 답해.`,
        maxTokens: 512,
      });

      const reply = result.content?.type === 'text' ? result.content.text : '응답 없음';
      wsSocket!.emit('chat_reply', { reply });
      console.error(`[WS] chat_reply sent (${reply.length}chars)`);
    } catch (err: any) {
      console.error(`[WS] chat error: ${err.message}`);
      wsSocket!.emit('chat_reply', { reply: `오류: ${err.message}` });
    }
  });

  wsSocket.on('disconnect', (reason: string) => {
    console.error(`[WS] Disconnected: ${reason}`);
  });

  wsSocket.on('connect_error', (err: Error) => {
    console.error(`[WS] Connection error: ${err.message} — retrying...`);
  });
}

/* ═══════════════════════════════════════════
   Start
═══════════════════════════════════════════ */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cherry KaaS MCP Server started (stdio)');

  // API Key가 있으면 WebSocket 자동 연결
  const apiKey = process.env.KAAS_AGENT_API_KEY;
  if (apiKey) {
    connectWebSocket(apiKey);
  } else {
    console.error('[WS] KAAS_AGENT_API_KEY not set — WebSocket skipped');
  }
}

main().catch((err) => {
  console.error('MCP Server error:', err);
  process.exit(1);
});

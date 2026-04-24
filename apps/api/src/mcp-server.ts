#!/usr/bin/env node
/**
 * Cherry KaaS MCP Server
 *
 * AI 에이전트(Claude Desktop 등)가 MCP tool로 지식 카탈로그를 조회/구매/비교할 수 있는 서버.
 * NestJS와 별도 프로세스로 실행되며, stdio로 통신.
 *
 * KAAS_WS_URL: WebSocket 접속 대상.
 *   - Claude Code --env로 전달하면 dotenv가 덮어쓰지 않음 (dotenv 기본 동작).
 *   - 대시보드 명령어에 포함됨: --env KAAS_WS_URL=https://solteti.site
 *
 * 실행: npx ts-node src/mcp-server.ts
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import knexLib from 'knex';
import config from './config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Bench tool impls — reused so Claude Code hits the SAME seeded data the
// web benchmark uses. See apps/docs/install-skill/1-work-guidelines.md.
import { searchMarketplace } from './modules/bench/tools/marketplace.tool';
import { fetchCryptoPrice } from './modules/bench/tools/coingecko.tool';

/* ═══════════════════════════════════════════
   Skills directory helpers
   - stdio MCP는 유저 로컬 PC에서 실행 → ~/.claude/skills/ 접근 가능
   - purchase 시 이 디렉터리 하위 폴더로 저장 지시 → self-report에서 목록 조회
═══════════════════════════════════════════ */
const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');

/** Skill 폴더 슬러그 — 컨셉당 고유 경로 */
function skillDirFor(conceptId: string): string {
  return `~/.claude/skills/cherry-${conceptId}`;
}

/** 실제 파일시스템의 ~/.claude/skills/ 하위 폴더 + SKILL.md 존재 여부 스캔 */
function scanSavedSkills(): Array<{ dir: string; hasSkillMd: boolean; sizeBytes: number; mtime: string | null }> {
  try {
    if (!fs.existsSync(SKILLS_DIR)) return [];
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const dirPath = path.join(SKILLS_DIR, e.name);
        const skillMd = path.join(dirPath, 'SKILL.md');
        let hasSkillMd = false;
        let sizeBytes = 0;
        let mtime: string | null = null;
        try {
          const st = fs.statSync(skillMd);
          hasSkillMd = st.isFile();
          sizeBytes = st.size;
          mtime = st.mtime.toISOString();
        } catch { /* 없으면 false */ }
        return { dir: `~/.claude/skills/${e.name}`, hasSkillMd, sizeBytes, mtime };
      });
  } catch {
    return [];
  }
}

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
}, {
  capabilities: {
    logging: {}, // Claude Code에 logging notifications 전송 가능
    tools: {},
    resources: {},
  },
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

// --- Tool: search_marketplace (bench Set 2 Hunter) ---
// Exposes the SAME seeded marketplace data the web benchmark uses, so Claude
// Code agents running `cherry hunter` mode produce comparable results.
server.tool(
  'search_marketplace',
  "Search the Cherry-seeded marketplace (laptops / hardware listings). Returns { listings: [{id, title, price, seller, posted_at, sealed, brand, model}], matchCount }. Match rule: ALL whitespace-separated tokens in `query` must appear in the listing's brand+model+title (case-insensitive). IMPORTANT: pass ONLY the brand + model tokens, like `LG Gram 16`. Do NOT add generic words such as 'laptop', 'notebook', 'computer', 'sealed' — use the `sealed_only` boolean for that. Example call: { query: 'LG Gram 16', max_price: 700, sealed_only: true }.",
  {
    query: z.string().describe("Free-text query, e.g. 'LG Gram 16'."),
    max_price: z.number().optional().describe('Upper bound (exclusive) on price in USD.'),
    sealed_only: z.boolean().optional().describe('If true, only return sealed items.'),
  },
  async ({ query, max_price, sealed_only }) => {
    // Strip common generic words Claude Code tends to append — the match rule
    // requires ALL tokens to hit listing.brand+model+title, so "laptop" etc.
    // would zero out valid results. Same spirit as sealed_only being a field.
    const STOP = new Set([
      'laptop', 'laptops', 'notebook', 'notebooks', 'computer', 'computers',
      'pc', 'pcs', 'sealed', 'new', 'used', 'opened', 'box',
    ]);
    const cleaned = query
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t.toLowerCase()))
      .join(' ')
      .trim() || query; // fall back to original if stop-filter left nothing
    const result = searchMarketplace({ query: cleaned, max_price, sealed_only });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// --- Tool: get_crypto_price (bench Set 1 Oracle + Set 4 Quant) ---
// Hits CoinGecko free API with 60s fresh cache + 5min stale fallback. Same
// handler the web bench uses — results match across channels.
server.tool(
  'get_crypto_price',
  "Fetch the current USD price and 24h percent change for a cryptocurrency from CoinGecko. Returns { symbol, priceUsd, change24hPct, fetchedAt, source }. Use this for the Oracle / Quant builds.",
  {
    symbol: z.string().describe("Ticker symbol, e.g. 'BTC', 'ETH', 'SOL'."),
  },
  async ({ symbol }) => {
    try {
      const result = await fetchCryptoPrice(symbol);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `get_crypto_price error: ${msg}` }], isError: true };
    }
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
// stdio MCP는 자기 자신이 웹소켓 연결을 보유하고 있으므로, 직접 로컬에서 파일 저장.
// 서버 /purchase 엔드포인트를 호출해도 되지만 라운드트립 절약 위해 DB 직접 접근.
// 단 동일 설계 원칙 유지: 반드시 파일 저장 성공 후에 크레딧 차감 & provenance 기록.
// ALREADY_OWNED 재구매는 크레딧 차감 없이 파일만 재저장.
server.tool(
  'purchase_concept',
  'Purchase a concept (20 credits). Saves the content to ~/.claude/skills/cherry-<id>/SKILL.md locally, then deducts credits and records provenance. Returns saved_path.',
  { api_key: z.string().optional().describe('Agent API key (생략 시 환경변수 사용)'), concept_id: z.string().describe('Concept ID to purchase') },
  async ({ api_key, concept_id }) => {
    try {
      const key = api_key || process.env.KAAS_AGENT_API_KEY;
      if (!key) return { content: [{ type: 'text', text: 'Error: API key required' }], isError: true };
      const agent = await authenticateAgent(key);
      const concept = await findConceptById(concept_id);
      if (!concept) return { content: [{ type: 'text', text: `Concept "${concept_id}" not found.` }], isError: true };

      // 재소유 여부 판단 (agent.knowledge 퍼지 매칭)
      let knowledgeList: Array<{ topic: string }> = [];
      try {
        const raw = agent.knowledge;
        knowledgeList = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      } catch { knowledgeList = []; }
      const idLower = concept_id.toLowerCase();
      const titleLower = concept.title.toLowerCase();
      const isReowned = knowledgeList.some((k) => {
        const t = k.topic.toLowerCase();
        return t === idLower || idLower.includes(t) || t.includes(idLower) ||
          titleLower.includes(t) || t.includes(titleLower.split(' ')[0]);
      });

      // [2] Reserve — purchase_delivery 레코드
      const { randomUUID } = await import('crypto');
      const requestId = randomUUID();
      const targetDir = path.join(os.homedir(), '.claude', 'skills', `cherry-${concept_id}`);
      const targetFile = path.join(targetDir, 'SKILL.md');

      try {
        await knex('kaas.purchase_delivery').insert({
          request_id: requestId,
          agent_id: agent.id,
          concept_id,
          state: 'pending',
          credit_reserved: isReowned ? 0 : 20,
          is_reowned: isReowned,
        });
      } catch (e: any) {
        console.error(`[purchase] purchase_delivery insert failed: ${e.message}`);
      }

      // [3] Deliver — 로컬 파일 저장 (stdio는 같은 프로세스에서 직접 수행)
      let savedPath: string;
      let sizeBytes: number;
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        const body = [
          '---',
          `name: ${concept.title}`,
          `description: ${(concept.summary ?? '').replace(/\n/g, ' ')}`,
          '---',
          '',
          concept.contentMd ?? '',
        ].join('\n');
        fs.writeFileSync(targetFile, body, 'utf8');
        const stat = fs.statSync(targetFile);
        savedPath = targetFile;
        sizeBytes = stat.size;
      } catch (err: any) {
        await knex('kaas.purchase_delivery').where({ request_id: requestId }).update({
          state: 'cancelled',
          error_reason: `Local save failed: ${err.message}`,
          completed_at: new Date(),
        }).catch(() => { /* ignore */ });
        return { content: [{ type: 'text', text: `Error: Local file save failed — ${err.message}. No credits deducted.` }], isError: true };
      }

      // [4] Finalize — 파일 저장 성공 시에만 크레딧 차감 + provenance
      const responseData = { answer: concept.summary, content_md: concept.contentMd, concepts: [concept.title], evidence: concept.evidence, quality_score: concept.qualityScore };
      let consumed = 0;
      let remaining = 0;
      let prov: any = null;

      if (!isReowned) {
        try {
          const creditResult = await consumeCredits(agent.id, 20, agent.karma_tier, concept_id, 'purchase');
          consumed = creditResult.consumed;
          remaining = creditResult.remaining;
          prov = await recordQuery(agent.id, concept_id, 'purchase', consumed, responseData);
          await addToAgentKnowledge(agent.id, concept_id, concept.title);
          await submitKnowledgeViaWs(key);
        } catch (err: any) {
          // 크레딧 차감 실패(잔액 부족 등) — 파일은 이미 저장됐으므로 cancelled 로 막고 파일은 그대로 둠
          await knex('kaas.purchase_delivery').where({ request_id: requestId }).update({
            state: 'cancelled',
            error_reason: `Finalize failed: ${err.message}`,
            completed_at: new Date(),
          }).catch(() => { /* ignore */ });
          return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
        }
      } else {
        const { balance } = await getBalance(agent.id);
        remaining = balance;
      }

      await knex('kaas.purchase_delivery').where({ request_id: requestId }).update({
        state: 'complete',
        saved_path: savedPath,
        size_bytes: sizeBytes,
        completed_at: new Date(),
      }).catch(() => { /* ignore */ });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...responseData,
            is_reowned: isReowned,
            saved_path: savedPath,
            size_bytes: sizeBytes,
            credits_consumed: consumed,
            credits_remaining: remaining,
            provenance: prov ? { hash: prov.provenanceHash, chain: process.env.CHAIN_ADAPTER ?? 'mock', explorer_url: prov.explorerUrl } : null,
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

// --- Tool: get_room_history ---
// Claude가 최근 대화 내용을 조회 (컨텍스트 파악용)
server.tool(
  'get_room_history',
  'Get the recent chat history from the Cherry KaaS web console room. Use this before replying to understand context. Returns last N messages (from/to/content).',
  {
    limit: z.number().optional().describe('Max messages to return (default 10, max 20)'),
  },
  async ({ limit }) => {
    const history = (global as any).__getRoomHistory?.() ?? [];
    const n = Math.min(Math.max(limit ?? 10, 1), 20);
    const recent = history.slice(-n);
    if (recent.length === 0) {
      return { content: [{ type: 'text', text: '(no messages yet)' }] };
    }
    const formatted = recent.map((m: any) =>
      `[${m.timestamp ?? ''}] ${m.from} → ${m.to}: ${m.content}`
    ).join('\n');
    return { content: [{ type: 'text', text: `Recent room messages (${recent.length}):\n\n${formatted}` }] };
  },
);

// --- Tool: reply_to_room ---
// Claude Code 사용자가 Claude에게 "답해" 지시 → Claude가 이 tool을 호출해 웹 콘솔에 메시지 전달
// 3자 대화 (user ↔ claude ↔ cherry) 에서 Claude가 응답하는 유일한 경로
server.tool(
  'reply_to_room',
  'Send a reply message to the Cherry KaaS web console chat room. Use this when the user asks you to respond to a message from the room (user or cherry). The reply will appear in the web console chat.',
  {
    content: z.string().describe('The reply message content (what Claude wants to say)'),
    to: z.enum(['user', 'cherry']).optional().describe('Recipient (default: reply to the last sender)'),
  },
  async ({ content, to }) => {
    const pending = (global as any).__pendingRoomMessage?.();
    const recipient = to ?? pending?.from ?? 'user';

    if (!wsSocket || !wsSocket.connected) {
      return { content: [{ type: 'text', text: '⚠ WebSocket not connected. Cannot send reply.' }], isError: true };
    }

    const msg = {
      from: 'claude',
      to: recipient,
      content,
      timestamp: new Date().toISOString(),
    };
    wsSocket.emit('room_message', msg);
    (global as any).__appendRoomHistory?.(msg); // Claude 자신의 응답도 히스토리에
    (global as any).__clearPendingRoomMessage?.();

    return {
      content: [{
        type: 'text',
        text: `✅ Reply sent to room (to=${recipient}, ${content.length} chars). Visible on the web console.`,
      }],
    };
  },
);

// --- Tool: generate_self_report ---
// 사용자가 Claude에게 "내 상태 리포트 대시보드에 올려줘"라고 하면 이 툴이 호출됨.
// Claude Code 채팅에 tool call이 시각적으로 표시됨 → "Claude가 직접 했다"는 증거.
server.tool(
  'generate_self_report',
  'Generate a self-report of your current knowledge state and push it to the Cherry KaaS dashboard. Use this when the user asks you to report your state or prove your learning. The report is signed by this agent process.',
  {
    api_key: z.string().optional().describe('Agent API key (생략 시 환경변수 사용)'),
  },
  async ({ api_key }) => {
    const key = api_key ?? process.env.KAAS_AGENT_API_KEY;
    if (!key) return { content: [{ type: 'text', text: 'API key required. Set KAAS_AGENT_API_KEY or pass api_key.' }], isError: true };

    const agent = await knex('kaas.agent').where({ api_key: key, is_active: true }).first();
    if (!agent) return { content: [{ type: 'text', text: 'Invalid API key.' }], isError: true };

    // 1. 자기 knowledge 파싱
    let knowledge: Array<{ topic: string; lastUpdated: string }> = [];
    try {
      const r = agent.knowledge;
      knowledge = typeof r === 'string' ? JSON.parse(r) : Array.isArray(r) ? r : [];
    } catch { knowledge = []; }

    // 2. 최근 5건 이력
    const recentLogs = await knex('kaas.query_log')
      .where({ agent_id: agent.id })
      .orderBy('created_at', 'desc')
      .limit(5);

    const timeline = await Promise.all(recentLogs.map(async (log: any) => {
      const concept = log.concept_id
        ? await knex('kaas.concept').where({ id: log.concept_id }).first()
        : null;
      const evidence = concept
        ? await knex('kaas.evidence').where({ concept_id: concept.id })
        : [];
      const contentMd: string = String((concept as any)?.content_md ?? '');
      return {
        at: log.created_at,
        action: log.action_type,
        conceptId: log.concept_id,
        conceptTitle: concept?.title ?? log.concept_id,
        contentSize: contentMd.length,
        contentPreview: contentMd.slice(0, 80),
        evidenceCount: evidence.length,
        evidence: evidence.map((e: any) => ({ source: e.source, summary: e.summary, curator: e.curator, curatorTier: e.curator_tier })),
        qualityScore: Number(concept?.quality_score ?? 0),
        creditsConsumed: log.credits_consumed,
        chain: log.chain,
        txHash: log.provenance_hash,
        onChain: log.chain !== 'failed' && !!log.provenance_hash,
      };
    }));

    // 3. 로컬에 저장된 스킬 파일목록 (stdio 실행 환경의 ~/.claude/skills/ 스캔)
    const savedSkills = scanSavedSkills();

    const report = {
      report_version: '1.0.0',
      reporter: 'cherry-kaas-mcp-stdio',
      reported_at: new Date().toISOString(),
      session_pid: process.pid,
      uptime_seconds: Math.floor(process.uptime()),
      node_version: process.version,
      triggered_by: 'mcp-tool-call',  // ← 이게 중요: 툴 호출로 생성됨을 명시
      agent: {
        id: agent.id, name: agent.name, wallet_address: agent.wallet_address,
        karma_tier: agent.karma_tier, created_at: agent.created_at,
      },
      current_knowledge: knowledge,
      recent_events: timeline,
      local_skills: {
        base_dir: '~/.claude/skills',
        count: savedSkills.length,
        items: savedSkills,
      },
      summary: {
        total_knowledge: knowledge.length,
        recent_events: timeline.length,
        credits_spent: timeline.reduce((s: number, e: any) => s + (e.creditsConsumed ?? 0), 0),
        chains_used: [...new Set(timeline.map((e: any) => e.chain).filter(Boolean))],
        local_skills_saved: savedSkills.filter((s) => s.hasSkillMd).length,
      },
      signature: {
        type: 'agent-tool-invoked',
        note: 'Generated by Claude calling the generate_self_report MCP tool. Visible in Claude Code chat as a tool call.',
      },
    };

    // WebSocket으로 대시보드에 push
    if (wsSocket && wsSocket.connected) {
      wsSocket.emit('submit_self_report', report);
    }

    // Claude가 사용자에게 보여줄 요약
    const skillLines = savedSkills.length === 0
      ? ['  (no skills saved locally yet)']
      : savedSkills.map((s) => {
          const sizeKb = (s.sizeBytes / 1024).toFixed(1);
          const flag = s.hasSkillMd ? '✓' : '✗';
          return `  ${flag} ${s.dir}/SKILL.md${s.hasSkillMd ? ` (${sizeKb} KB)` : ' (missing)'}`;
        });

    const summaryText = [
      `✅ Self-report generated and pushed to dashboard.`,
      ``,
      `📊 Summary:`,
      `- Agent: ${agent.name}`,
      `- PID: ${process.pid} · Uptime: ${Math.floor(process.uptime())}s`,
      `- Knowledge: ${knowledge.length} topics`,
      `- Recent events: ${timeline.length}`,
      `- Credits spent: ${report.summary.credits_spent}cr`,
      `- On-chain: ${report.summary.chains_used.join(', ') || 'none'}`,
      ``,
      `📁 Local skills (scanned from ~/.claude/skills/):`,
      ...skillLines,
      ``,
      `The report is now visible on the Cherry KaaS dashboard (Knowledge Diff modal).`,
    ].join('\n');

    return { content: [{ type: 'text', text: summaryText }] };
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
  const KAAS_WS_URL = process.env.KAAS_WS_URL ?? 'https://solteti.site';
  console.error(`[WS] Connecting to ${KAAS_WS_URL}/kaas ...`);

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

  wsSocket.on('connect_error', (err) => {
    console.error(`[WS] Connection failed: ${err.message}`);
  });

  wsSocket.on('disconnect', (reason) => {
    console.error(`[WS] Disconnected: ${reason}`);
  });

  wsSocket.on('connected', (data: any) => {
    console.error(`[WS] Authenticated: ${data.agentName} (${data.agentId})`);
  });

  // 웹 Compare 버튼이 누르면 서버가 이 이벤트를 보냄
  wsSocket.on('request_knowledge', () => {
    console.error('[WS] request_knowledge received');
    submitKnowledgeViaWs(apiKey);
  });

  /* ═══════════════════════════════════════════
     save_skill_request — 서버가 구매된 content 전달
     이 프로세스가 fs.writeFileSync로 ~/.claude/skills/<dir>/SKILL.md 저장
     성공 시 save_skill_ack, 실패 시 save_skill_error 응답
  ═══════════════════════════════════════════ */
  wsSocket.on('save_skill_request', (req: {
    request_id: string;
    concept_id: string;
    title: string;
    summary: string;
    content_md: string;
    target_dir: string;   // "~/.claude/skills/cherry-<id>"
    target_file: string;  // "~/.claude/skills/cherry-<id>/SKILL.md"
  }) => {
    console.error(`[WS] 📥 save_skill_request RECEIVED: request=${req.request_id} concept=${req.concept_id} title="${req.title}" bytes=${(req.content_md ?? '').length}`);
    try {
      // ~ 확장 (os.homedir()로 치환)
      const expand = (p: string) => p.startsWith('~')
        ? path.join(os.homedir(), p.slice(1).replace(/^\/+/, ''))
        : p;
      const absDir = expand(req.target_dir);
      const absFile = expand(req.target_file);
      console.error(`[WS]   target_dir=${absDir}`);
      console.error(`[WS]   target_file=${absFile}`);

      fs.mkdirSync(absDir, { recursive: true });
      console.error(`[WS]   ✓ mkdir ok`);

      // YAML frontmatter + content_md
      const body = [
        '---',
        `name: ${req.title}`,
        `description: ${(req.summary ?? '').replace(/\n/g, ' ')}`,
        '---',
        '',
        req.content_md ?? '',
      ].join('\n');

      fs.writeFileSync(absFile, body, 'utf8');
      const stat = fs.statSync(absFile);
      console.error(`[WS]   ✓ wrote ${stat.size} bytes`);

      wsSocket!.emit('save_skill_ack', {
        request_id: req.request_id,
        saved_path: absFile,
        size_bytes: stat.size,
      });
      console.error(`[WS] 📤 save_skill_ack SENT: ${absFile} (${stat.size} bytes)`);
    } catch (err: any) {
      console.error(`[WS] ✗ save_skill FAILED: ${err.message}`);
      console.error(err.stack);
      try {
        wsSocket!.emit('save_skill_error', {
          request_id: req.request_id,
          message: err.message ?? String(err),
        });
      } catch { /* ignore */ }
    }
  });

  /* ═══════════════════════════════════════════
     delete_skill_request — 서버가 ~/.claude/skills/<dir> 삭제 요청
     install-build 고아 정리용. target_dir 은 반드시 cherry-* 로 끝나야 함.
  ═══════════════════════════════════════════ */
  wsSocket.on('delete_skill_request', (req: {
    request_id: string;
    target_dir: string;  // "~/.claude/skills/cherry-<short>"
  }) => {
    console.error(`[WS] 📥 delete_skill_request RECEIVED: request=${req.request_id} target=${req.target_dir}`);
    try {
      // ~ 확장
      const expand = (p: string) => p.startsWith('~')
        ? path.join(os.homedir(), p.slice(1).replace(/^\/+/, ''))
        : p;
      const absDir = expand(req.target_dir);
      const resolved = path.resolve(absDir);

      // 방어 1: 반드시 ~/.claude/skills/ 하위
      const skillsRoot = path.resolve(path.join(os.homedir(), '.claude', 'skills'));
      if (!resolved.startsWith(skillsRoot + path.sep)) {
        wsSocket!.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: `target_dir is outside ~/.claude/skills/ — refusing (${resolved})`,
        });
        return;
      }
      // 방어 2: 반드시 cherry- 접두사로 끝남
      const baseName = path.basename(resolved);
      if (!/^cherry-[a-z0-9-]+$/.test(baseName)) {
        wsSocket!.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: `target_dir basename is not a cherry-* dir (${baseName})`,
        });
        return;
      }

      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
        console.error(`[WS]   ✓ removed ${resolved}`);
        wsSocket!.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: true,
          removed_path: resolved,
        });
      } else {
        console.error(`[WS]   - already absent: ${resolved}`);
        wsSocket!.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: 'target_dir does not exist (already removed)',
        });
      }
    } catch (err: any) {
      console.error(`[WS] ✗ delete_skill FAILED: ${err.message}`);
      try {
        wsSocket!.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: err.message ?? String(err),
        });
      } catch { /* ignore */ }
    }
  });

  // 에이전트 self-report 요청 (심사용 학습 증명)
  // → 에이전트 프로세스에서 직접 자기 상태 introspect 하여 서버로 전송
  wsSocket.on('request_self_report', async (req: any) => {
    console.error(`[WS] request_self_report received: ${JSON.stringify(req)}`);

    // 공개 로그 파일 — 시연 시 `tail -f /tmp/cherry-kaas-agent.log` 로 확인
    const AGENT_LOG = '/tmp/cherry-kaas-agent.log';
    const writeAgentLog = async (icon: string, msg: string) => {
      try {
        const fs = await import('fs/promises');
        const line = `[${new Date().toISOString()}] [pid=${process.pid}] ${icon} ${msg}\n`;
        await fs.appendFile(AGENT_LOG, line);
      } catch { /* ignore */ }
    };

    // Claude Code MCP 디버그 패널에 표시 (sendLoggingMessage)
    const logToClient = async (level: 'info' | 'notice' | 'warning' | 'error', data: string) => {
      try {
        await server.server.sendLoggingMessage({
          level,
          logger: 'cherry-kaas-self-report',
          data,
        });
      } catch (e: any) {
        console.error(`[WS] logging notification failed: ${e.message}`);
      }
    };

    await writeAgentLog('📡', `Received self-report request from Cherry KaaS server`);
    await logToClient('notice', `📡 Received self-report request at ${new Date().toISOString()}`);
    try {
      // 1. 에이전트 본인 정보
      const agent = await knex('kaas.agent').where({ api_key: apiKey, is_active: true }).first();
      if (!agent) throw new Error('Agent record not found');

      // 2. 에이전트가 아는 자기 knowledge (로컬에서 직접 파싱)
      let knowledge: Array<{ topic: string; lastUpdated: string }> = [];
      try {
        const r = agent.knowledge;
        knowledge = typeof r === 'string' ? JSON.parse(r) : Array.isArray(r) ? r : [];
      } catch { knowledge = []; }

      // 3. 에이전트 세션의 최근 구매/팔로우 이력 (에이전트가 직접 조회)
      const recentLogs = await knex('kaas.query_log')
        .where({ agent_id: agent.id })
        .orderBy('created_at', 'desc')
        .limit(5);

      // 4. 각 로그에 concept 세부(agent 프로세스가 직접 조회하여 구성)
      const timeline = await Promise.all(recentLogs.map(async (log: any) => {
        // is_active 조건 빼서 비활성 concept도 찾도록 (content는 여전히 있을 수 있음)
        const concept = log.concept_id
          ? await knex('kaas.concept').where({ id: log.concept_id }).first()
          : null;
        const evidence = concept
          ? await knex('kaas.evidence').where({ concept_id: concept.id })
          : [];

        // content_md 추출 — knex는 컬럼명 그대로 반환 (snake_case)
        const contentMd: string = String((concept as any)?.content_md ?? (concept as any)?.contentMd ?? '');

        return {
          at: log.created_at,
          action: log.action_type,
          conceptId: log.concept_id,
          conceptTitle: concept?.title ?? log.concept_id,
          contentSize: contentMd.length,
          contentPreview: contentMd.slice(0, 80), // 디버그: 실제 내용 프리뷰
          evidenceCount: evidence.length,
          evidence: evidence.map((e: any) => ({
            source: e.source,
            summary: e.summary,
            curator: e.curator,
            curatorTier: e.curator_tier,
          })),
          qualityScore: Number(concept?.quality_score ?? 0),
          creditsConsumed: log.credits_consumed,
          chain: log.chain,
          txHash: log.provenance_hash,
          onChain: log.chain !== 'failed' && !!log.provenance_hash,
        };
      }));

      await writeAgentLog('🔍', `Introspection: ${knowledge.length} knowledge topics, ${timeline.length} recent events found`);
      await logToClient('info', `🔍 Agent introspection: ${knowledge.length} knowledge topics, ${timeline.length} recent events found in my state.`);

      // 5. 에이전트가 자체 서명한 리포트
      const report = {
        report_version: '1.0.0',
        reporter: 'cherry-kaas-mcp-stdio',
        reported_at: new Date().toISOString(),
        session_pid: process.pid,
        uptime_seconds: Math.floor(process.uptime()),
        node_version: process.version,

        agent: {
          id: agent.id,
          name: agent.name,
          wallet_address: agent.wallet_address,
          karma_tier: agent.karma_tier,
          created_at: agent.created_at,
        },

        current_knowledge: knowledge,
        recent_events: timeline,

        summary: {
          total_knowledge: knowledge.length,
          recent_events: timeline.length,
          credits_spent: timeline.reduce((s: number, e: any) => s + (e.creditsConsumed ?? 0), 0),
          chains_used: [...new Set(timeline.map((e: any) => e.chain).filter(Boolean))],
        },

        signature: {
          type: 'agent-self-declared',
          note: 'This report is generated by the agent process, not the server. Each recent_event has on-chain verification via txHash.',
        },
      };

      wsSocket!.emit('submit_self_report', report);
      console.error(`[WS] submit_self_report sent (${timeline.length} events, ${knowledge.length} topics)`);
      await writeAgentLog('📤', `Self-report signed and submitted. size=${JSON.stringify(report).length}B, events=${timeline.length}, topics=${knowledge.length}`);
      await writeAgentLog('─', '─'.repeat(60));
      await logToClient('notice', `📤 Self-report signed and submitted to server. PID=${process.pid}, uptime=${Math.floor(process.uptime())}s, size=${JSON.stringify(report).length} bytes.`);
    } catch (err: any) {
      console.error(`[WS] self-report error: ${err.message}`);
      await writeAgentLog('❌', `Self-report failed: ${err.message}`);
      await logToClient('error', `❌ Self-report generation failed: ${err.message}`);
      wsSocket!.emit('submit_self_report', { error: err.message });
    }
  });

  // 3자 대화 Chat Room: to=claude 메시지 수신 시
  // Claude Code CLI는 MCP Sampling 미지원 → MCP logging notification으로 Claude Code에 알림
  // → 사용자가 Claude에게 "답해" 지시 → Claude가 reply_to_room tool 호출
  // Claude가 맥락을 알도록 최근 room 메시지 히스토리도 유지
  const roomHistory: any[] = []; // 최대 20개 유지 (메모리)
  let pendingRoomMessage: any = null;

  // 자기 자신의 메시지도 히스토리에 기록 (reply_to_room에서 사용)
  (global as any).__appendRoomHistory = (m: any) => {
    roomHistory.push(m);
    if (roomHistory.length > 20) roomHistory.shift();
  };

  wsSocket.on('room_message', async (msg: any) => {
    if (!msg) return;
    // 히스토리 누적 (모든 메시지)
    roomHistory.push(msg);
    if (roomHistory.length > 20) roomHistory.shift();

    if (msg.to !== 'claude' || msg.from === 'claude') return;
    console.error(`[WS room] ${msg.from} → claude: ${msg.content?.slice(0, 60)}`);
    pendingRoomMessage = msg;
    try {
      // 최근 대화 컨텍스트 포함
      const recentCtx = roomHistory.slice(-8).map((m: any) =>
        `  ${m.from} → ${m.to}: ${String(m.content).slice(0, 120)}`
      ).join('\n');
      await server.server.sendLoggingMessage({
        level: 'notice',
        logger: 'cherry-kaas-room',
        data: `💬 새 메시지 ${msg.from} → claude: "${msg.content}"\n\n[최근 대화]\n${recentCtx}\n\n👉 이어서 답하려면 Claude에게 "reply_to_room tool로 답해"라고 말하세요.`,
      }).catch(() => {});
    } catch (e: any) {
      console.error(`[WS room] notification failed: ${e.message}`);
    }
  });

  (global as any).__pendingRoomMessage = () => pendingRoomMessage;
  (global as any).__clearPendingRoomMessage = () => { pendingRoomMessage = null; };
  (global as any).__getRoomHistory = () => roomHistory.slice();

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

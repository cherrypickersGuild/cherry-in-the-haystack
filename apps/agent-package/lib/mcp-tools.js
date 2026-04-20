/**
 * MCP 도구 핸들러 — 서버 HTTP API 호출.
 * DB 직접 접속 없음. 모든 데이터는 서버에서 가져옴.
 */

const { z } = require('zod');

/** 서버 API 호출 헬퍼 */
async function api(baseUrl, method, path, apiKey, body) {
  const url = `${baseUrl}/api${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (method === 'GET') {
    // api_key를 query로
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = apiKey ? `${url}${sep}api_key=${apiKey}` : url;
    const res = await fetch(fullUrl, opts);
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // POST/PATCH — api_key를 body로
  opts.body = JSON.stringify({ ...body, api_key: apiKey });
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

function txt(content) {
  return { content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] };
}

function registerTools(server, apiKey, baseUrl) {

  // ── search_catalog ──
  server.tool(
    'search_catalog',
    'Search the Cherry KaaS knowledge catalog. Returns curated AI/ML concepts with quality scores.',
    { query: z.string().optional().describe('Search keyword (optional)'), category: z.string().optional().describe('Filter by category') },
    async ({ query, category }) => {
      try {
        let path = '/v1/kaas/catalog';
        const params = [];
        if (query) params.push(`q=${encodeURIComponent(query)}`);
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (params.length) path += '?' + params.join('&');

        const data = await api(baseUrl, 'GET', path, null);
        const concepts = Array.isArray(data) ? data : [];
        const summary = concepts.map(c =>
          `- ${c.id} (★${c.qualityScore ?? c.quality_score ?? 0}) — ${c.title}: ${c.summary?.slice(0, 80)}...`
        ).join('\n');
        return txt(summary || 'No concepts found.');
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ── get_concept ──
  server.tool(
    'get_concept',
    'Get detailed information about a specific concept including evidence from curators.',
    { concept_id: z.string().describe('Concept ID (e.g. "rag", "chain-of-thought")') },
    async ({ concept_id }) => {
      try {
        const data = await api(baseUrl, 'GET', `/v1/kaas/catalog/${encodeURIComponent(concept_id)}`, null);
        return txt(data);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ── purchase_concept ──
  server.tool(
    'purchase_concept',
    'Purchase a concept (20 credits base, Karma tier discount applied). Returns full knowledge content, evidence, and provenance.',
    { concept_id: z.string().describe('Concept ID to purchase') },
    async ({ concept_id }) => {
      try {
        const data = await api(baseUrl, 'POST', '/v1/kaas/purchase', apiKey, { concept_id });
        return txt(data);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ── follow_concept ──
  server.tool(
    'follow_concept',
    'Follow a concept (25 credits). Includes future updates. Returns summary and provenance.',
    { concept_id: z.string().describe('Concept ID to follow') },
    async ({ concept_id }) => {
      try {
        const data = await api(baseUrl, 'POST', '/v1/kaas/follow', apiKey, { concept_id });
        return txt(data);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ── compare_knowledge ──
  server.tool(
    'compare_knowledge',
    'Compare your knowledge against the Cherry catalog. Identifies gaps, outdated knowledge, and recommendations.',
    {
      known_topics: z.array(z.object({
        topic: z.string(),
        lastUpdated: z.string().optional(),
      })).describe('List of topics you already know'),
    },
    async ({ known_topics }) => {
      try {
        const data = await api(baseUrl, 'POST', '/v1/kaas/catalog/compare', apiKey, { known_topics });
        return txt(data);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ── generate_self_report ──
  server.tool(
    'generate_self_report',
    'Generate a self-report of your current knowledge state and push it to the Cherry KaaS server.',
    {},
    async () => {
      try {
        if (!_socket || !_socket.connected) {
          return { content: [{ type: 'text', text: 'WebSocket not connected. Cannot submit self-report.' }], isError: true };
        }

        const { fetchAgentData, parseKnowledge, scanLocalSkills } = require('./ws-client.js');
        const { agents, history } = await fetchAgentData(baseUrl, apiKey);
        const agent = agents[0];
        const knowledge = agent ? parseKnowledge(agent.knowledge) : [];

        const recentEvents = history.slice(0, 10).map(log => ({
          at: log.created_at ?? log.timestamp,
          action: log.action_type ?? log.actionType ?? 'purchase',
          conceptId: log.concept_id ?? log.conceptId,
          conceptTitle: log.concept_title ?? log.conceptTitle ?? log.concept_id ?? log.conceptId,
          creditsConsumed: log.credits_consumed ?? log.creditsConsumed ?? 0,
          qualityScore: 0,
          chain: log.chain ?? 'status',
          txHash: log.provenance_hash ?? log.provenanceHash ?? '',
          onChain: !!(log.provenance_hash ?? log.provenanceHash),
        }));

        const totalSpent = recentEvents.reduce((s, e) => s + (e.creditsConsumed ?? 0), 0);
        const localSkills = scanLocalSkills();

        const report = {
          reporter: 'cherry-kaas-agent',
          reported_at: new Date().toISOString(),
          triggered_by: 'agent',
          current_knowledge: knowledge,
          recent_events: recentEvents,
          local_skills: localSkills,
          summary: {
            total_events: recentEvents.length,
            credits_spent: totalSpent,
          },
          session_pid: process.pid,
          uptime_seconds: Math.floor(process.uptime()),
        };

        _socket.emit('submit_self_report', report);

        return txt(`Self-report submitted: ${knowledge.length} topics, ${recentEvents.length} recent events, ${totalSpent}cr spent, ${localSkills.count} local skills.`);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // ─── A2A: send_agent_task ───
  server.tool(
    'send_agent_task',
    'Send a task to another Cherry-registered agent via A2A protocol.',
    {
      executor_agent_id: z.string().describe('Target agent UUID'),
      text: z.string().describe('Message text'),
      task_type: z.string().optional(),
      session_id: z.string().optional(),
    },
    async ({ executor_agent_id, text, task_type, session_id }) => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/kaas/a2a`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tasks/send',
            params: {
              executorAgentId: executor_agent_id,
              taskType: task_type ?? 'message',
              sessionId: session_id,
              message: {
                role: 'user',
                parts: [{ type: 'text', text }],
              },
            },
          }),
        });
        const data = await res.json();
        if (data.error) {
          return { content: [{ type: 'text', text: `A2A error: ${data.error.message}` }], isError: true };
        }
        return txt(`Task sent: ${data.result.id} (state: ${data.result.status.state})`);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    },
  );

  // ─── A2A: read_agent_inbox ───
  server.tool(
    'read_agent_inbox',
    'Read tasks sent to this agent by other agents.',
    {
      status: z.string().optional().describe('Filter by status (submitted/completed/failed)'),
      limit: z.number().optional(),
    },
    async ({ status, limit }) => {
      try {
        const url = new URL(`${baseUrl}/api/v1/kaas/a2a/inbox`);
        if (status) url.searchParams.set('status', status);
        if (limit) url.searchParams.set('limit', String(limit));
        const res = await fetch(url.toString(), { headers: { 'x-api-key': apiKey } });
        const data = await res.json();
        if (!Array.isArray(data)) {
          return { content: [{ type: 'text', text: `Inbox error: ${JSON.stringify(data)}` }], isError: true };
        }
        if (data.length === 0) return txt('Inbox empty.');
        const lines = data.map((t) => {
          const textPart = t.message?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
          const from = t['x-cherry']?.initiator_name ?? '?';
          return `[${t.status.state}] ${t.id.slice(0, 8)} from ${from}: ${textPart}`;
        });
        return txt(`Inbox (${data.length}):\n${lines.join('\n')}`);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    },
  );

  // ─── A2A: respond_to_task ───
  server.tool(
    'respond_to_task',
    'Respond to a task received from another agent.',
    {
      task_id: z.string(),
      text: z.string(),
      status: z.enum(['completed', 'failed']).optional(),
    },
    async ({ task_id, text, status }) => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/kaas/a2a`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tasks/respond',
            params: {
              taskId: task_id,
              status: status ?? 'completed',
              output: { parts: [{ type: 'text', text }] },
            },
          }),
        });
        const data = await res.json();
        if (data.error) {
          return { content: [{ type: 'text', text: `A2A error: ${data.error.message}` }], isError: true };
        }
        return txt(`Responded to ${task_id.slice(0, 8)}: ${data.result.status.state}`);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    },
  );

  process.stderr.write(`[cherry-kaas-agent] ${9} MCP tools registered\n`);
}

/** WebSocket 인스턴스 주입 — agent.js에서 연결 후 호출 */
let _socket = null;
function setSocket(socket) { _socket = socket; }

module.exports = { registerTools, setSocket };

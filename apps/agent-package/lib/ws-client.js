/**
 * WebSocket 클라이언트 — 서버와 상시 연결.
 * self-report, compare, 3자 대화 등 서버가 먼저 요청하는 이벤트 처리.
 */

const { io } = require('socket.io-client');

/** 서버 API 호출 (보고서용 데이터 조회) */
async function fetchAgentData(baseUrl, apiKey) {
  try {
    // 에이전트 정보 (knowledge 포함)
    const agentsRes = await fetch(`${baseUrl}/api/v1/kaas/agents?api_key=${apiKey}`);
    const agents = await agentsRes.json();
    // api_key로 매칭되는 에이전트 찾기 (목록에서 현재 에이전트)
    // 서버는 api_key 기반으로 에이전트를 식별하므로 balance 조회로 확인
    const balRes = await fetch(`${baseUrl}/api/v1/kaas/credits/balance?api_key=${apiKey}`);
    const balance = await balRes.json();

    // 구매 이력
    const histRes = await fetch(`${baseUrl}/api/v1/kaas/credits/history?api_key=${apiKey}`);
    const history = await histRes.json();

    return { agents: Array.isArray(agents) ? agents : [], balance, history: Array.isArray(history) ? history : [] };
  } catch (err) {
    process.stderr.write(`[WS] fetchAgentData failed: ${err.message}\n`);
    return { agents: [], balance: {}, history: [] };
  }
}

/** 에이전트의 knowledge 파싱 */
function parseKnowledge(raw) {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    return arr.map(k => ({
      topic: k.topic ?? k.name ?? '',
      lastUpdated: k.lastUpdated ?? k.last_updated ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function connectWebSocket(apiKey, baseUrl) {
  process.stderr.write(`[WS] Connecting to ${baseUrl}/kaas ...\n`);

  const socket = io(`${baseUrl}/kaas`, {
    path: '/socket.io',
    auth: { api_key: apiKey },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 5000,
  });

  socket.on('connect', () => {
    process.stderr.write(`[WS] Connected (sid=${socket.id})\n`);
  });

  socket.on('connected', (data) => {
    process.stderr.write(`[WS] Authenticated: ${data.agentName} (${data.agentId})\n`);
  });

  socket.on('connect_error', (err) => {
    process.stderr.write(`[WS] Connection failed: ${err.message}\n`);
  });

  socket.on('disconnect', (reason) => {
    process.stderr.write(`[WS] Disconnected: ${reason}\n`);
  });

  // ── Compare 요청 → 보유 지식 제출 ──
  socket.on('request_knowledge', async () => {
    process.stderr.write('[WS] request_knowledge received\n');
    try {
      const { agents } = await fetchAgentData(baseUrl, apiKey);
      // 첫 번째 에이전트의 knowledge (api_key로 등록한 에이전트)
      const agent = agents[0];
      const knowledge = agent ? parseKnowledge(agent.knowledge) : [];
      socket.emit('submit_knowledge', knowledge);
      process.stderr.write(`[WS] Submitted ${knowledge.length} topics\n`);
    } catch (err) {
      process.stderr.write(`[WS] request_knowledge error: ${err.message}\n`);
    }
  });

  // ── Self-report 요청 → 보고서 생성 + 제출 ──
  socket.on('request_self_report', async (req) => {
    process.stderr.write(`[WS] request_self_report received\n`);
    try {
      const { agents, history } = await fetchAgentData(baseUrl, apiKey);
      const agent = agents[0];
      const knowledge = agent ? parseKnowledge(agent.knowledge) : [];

      const recentEvents = history.slice(0, 10).map(log => ({
        at: log.created_at ?? log.timestamp,
        action: log.action_type ?? log.actionType ?? 'purchase',
        conceptId: log.concept_id ?? log.conceptId,
        conceptTitle: log.concept_id ?? log.conceptId,
        creditsConsumed: log.credits_consumed ?? log.creditsConsumed ?? 0,
        qualityScore: 0,
        chain: log.chain ?? 'status',
        txHash: log.provenance_hash ?? log.provenanceHash ?? '',
        onChain: !!(log.provenance_hash ?? log.provenanceHash),
      }));

      const totalSpent = recentEvents.reduce((s, e) => s + (e.creditsConsumed ?? 0), 0);

      const report = {
        reporter: 'cherry-kaas-agent',
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

      socket.emit('submit_self_report', report);
      process.stderr.write(`[WS] Self-report submitted (${recentEvents.length} events, ${totalSpent}cr)\n`);
    } catch (err) {
      process.stderr.write(`[WS] request_self_report error: ${err.message}\n`);
    }
  });

  // ── 3자 대화 수신 ──
  socket.on('room_message', (msg) => {
    process.stderr.write(`[WS] Room message from ${msg.from}: ${msg.content?.slice(0, 50)}...\n`);
  });

  return socket;
}

module.exports = { connectWebSocket, fetchAgentData, parseKnowledge };

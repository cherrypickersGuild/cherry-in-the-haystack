/**
 * WebSocket 클라이언트 — 서버와 상시 연결.
 * self-report, compare, 3자 대화 등 서버가 먼저 요청하는 이벤트 처리.
 */

const { io } = require('socket.io-client');

/** 서버 API 호출 (보고서용 데이터 조회) */
async function fetchAgentData(baseUrl, apiKey) {
  try {
    // 에이전트 정보 (knowledge 포함) — /agents/me는 api_key 인증 (JWT 불필요)
    const meRes = await fetch(`${baseUrl}/api/v1/kaas/agents/me?api_key=${apiKey}`);
    const me = await meRes.json();
    const agents = me?.id ? [me] : [];
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

// Scan ~/.claude/skills/cherry-<id>/ — list of skills actually saved to disk.
function scanLocalSkills() {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const baseDir = path.join(os.homedir(), '.claude', 'skills');
  const result = {
    count: 0,
    base_dir: '~/.claude/skills',
    items: [],
  };

  try {
    if (!fs.existsSync(baseDir)) return result;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith('cherry-')) continue;

      const dir = path.join(baseDir, entry.name);
      const skillFile = path.join(dir, 'SKILL.md');
      let hasSkillMd = false;
      let sizeBytes = 0;
      let mtime = null;

      try {
        const st = fs.statSync(skillFile);
        hasSkillMd = st.isFile();
        sizeBytes = st.size;
        mtime = st.mtime.toISOString();
      } catch {
        try {
          const dstat = fs.statSync(dir);
          mtime = dstat.mtime.toISOString();
        } catch {}
      }

      result.items.push({ dir, hasSkillMd, sizeBytes, mtime });
    }
    result.count = result.items.length;
  } catch (err) {
    process.stderr.write(`[WS] scanLocalSkills error: ${err.message}\n`);
  }

  return result;
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
        triggered_by: 'request',
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

      socket.emit('submit_self_report', report);
      process.stderr.write(
        `[WS] Self-report submitted (${recentEvents.length} events, ${totalSpent}cr, ${localSkills.count} local skills)\n`
      );
    } catch (err) {
      process.stderr.write(`[WS] request_self_report error: ${err.message}\n`);
    }
  });

  // ── 3자 대화 수신 ──
  socket.on('room_message', (msg) => {
    process.stderr.write(`[WS] Room message from ${msg.from}: ${msg.content?.slice(0, 50)}...\n`);
  });

  // ── A2A task 수신 ──
  socket.on('a2a_task_received', (task) => {
    const textPart = task.message?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
    const from = task['x-cherry']?.initiator_name ?? task['x-cherry']?.initiator_id?.slice(0, 8) ?? 'unknown';
    process.stderr.write(`[A2A] ← incoming task ${task.id.slice(0, 8)} from ${from}: ${textPart}\n`);
  });

  socket.on('a2a_task_completed', (task) => {
    const textPart = task.artifact?.parts?.find((p) => p.type === 'text')?.text ?? '(no text)';
    process.stderr.write(`[A2A] ✓ task ${task.id.slice(0, 8)} completed: ${textPart}\n`);
  });

  socket.on('a2a_task_canceled', (task) => {
    process.stderr.write(`[A2A] ✗ task ${task.id.slice(0, 8)} canceled\n`);
  });

  // ── Purchase delivery: save skill to local filesystem and ack ──
  socket.on('save_skill_request', (req) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    process.stderr.write(
      `[WS] 📥 save_skill_request RECEIVED: request=${req?.request_id} concept=${req?.concept_id} title=${req?.title}\n`
    );
    try {
      const expand = (p) => {
        if (!p) return p;
        if (p.startsWith('~')) {
          return path.join(os.homedir(), p.slice(1).replace(/^\/+/, ''));
        }
        return p;
      };
      const absDir = expand(req.target_dir);
      const absFile = expand(req.target_file);

      if (!absDir || !absFile) {
        throw new Error(`Invalid target paths: dir=${absDir} file=${absFile}`);
      }

      fs.mkdirSync(absDir, { recursive: true });
      process.stderr.write(`[WS]    mkdir ok: ${absDir}\n`);

      const descLine = String(req.summary ?? '').replace(/\n/g, ' ').trim();
      const body = [
        '---',
        `name: ${req.title ?? req.concept_id ?? 'skill'}`,
        `description: ${descLine}`,
        '---',
        '',
        req.content_md ?? '',
      ].join('\n');

      fs.writeFileSync(absFile, body, 'utf8');
      const stat = fs.statSync(absFile);

      socket.emit('save_skill_ack', {
        request_id: req.request_id,
        saved_path: absFile,
        size_bytes: stat.size,
      });
      process.stderr.write(
        `[WS] 📤 save_skill_ack SENT: ${absFile} (${stat.size} bytes)\n`
      );
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write(`[WS] ✗ save_skill FAILED: ${msg}\n`);
      try {
        socket.emit('save_skill_error', {
          request_id: req && req.request_id,
          message: msg,
        });
      } catch {}
    }
  });

  // ── Install Skill: remove a cherry-* skill dir for Build A → B transitions ──
  socket.on('delete_skill_request', (req) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    process.stderr.write(
      `[WS] 📥 delete_skill_request RECEIVED: request=${req?.request_id} target=${req?.target_dir}\n`
    );
    try {
      const expand = (p) => {
        if (!p) return p;
        if (p.startsWith('~')) {
          return path.join(os.homedir(), p.slice(1).replace(/^\/+/, ''));
        }
        return p;
      };
      const absDir = expand(req.target_dir);
      const resolved = path.resolve(absDir);
      const skillsRoot = path.resolve(path.join(os.homedir(), '.claude', 'skills'));

      // Defense 1: must be under ~/.claude/skills/
      if (!resolved.startsWith(skillsRoot + path.sep)) {
        socket.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: `target_dir is outside ~/.claude/skills/ — refusing (${resolved})`,
        });
        return;
      }
      // Defense 2: basename must match cherry-* pattern
      const baseName = path.basename(resolved);
      if (!/^cherry-[a-z0-9-]+$/.test(baseName)) {
        socket.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: `target_dir basename is not a cherry-* dir (${baseName})`,
        });
        return;
      }

      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
        process.stderr.write(`[WS]   ✓ removed ${resolved}\n`);
        socket.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: true,
          removed_path: resolved,
        });
      } else {
        process.stderr.write(`[WS]   - already absent: ${resolved}\n`);
        socket.emit('delete_skill_ack', {
          request_id: req.request_id,
          deleted: false,
          error_reason: 'target_dir does not exist (already removed)',
        });
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write(`[WS] ✗ delete_skill FAILED: ${msg}\n`);
      try {
        socket.emit('delete_skill_ack', {
          request_id: req && req.request_id,
          deleted: false,
          error_reason: msg,
        });
      } catch {}
    }
  });

  return socket;
}

module.exports = { connectWebSocket, fetchAgentData, parseKnowledge, scanLocalSkills };

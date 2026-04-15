import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';

type KnowledgeTopic = { topic: string; lastUpdated: string };

@WebSocketGateway({ namespace: '/kaas', cors: { origin: '*' } })
export class KaasWsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(KaasWsGateway.name);

  // agentId → socket
  private agentSockets = new Map<string, Socket>();

  constructor(
    private readonly agentService: KaasAgentService,
    private readonly knowledge: KaasKnowledgeService,
  ) {}

  async handleConnection(socket: Socket) {
    const apiKey = socket.handshake.auth?.api_key || socket.handshake.headers?.['x-api-key'];
    // role: "agent" (MCP stdio) | "user" (web viewer). 기본은 agent (기존 호환).
    const role = (socket.handshake.auth?.role as string) || 'agent';
    if (!apiKey) {
      socket.emit('error', { message: 'API key required' });
      socket.disconnect();
      return;
    }
    try {
      const agent = await this.agentService.authenticate(apiKey as string);
      socket.data.agentId = agent.id;
      socket.data.agentName = agent.name;
      socket.data.role = role;

      // 모두 room에 참여 (agent_id 기반)
      socket.join(`room:${agent.id}`);

      // "agent" role만 agentSockets에 등록 (MCP 리다이렉트 대상)
      if (role === 'agent') {
        // 동일 agent_id 기존 연결 있으면 해제 (중복 응답 방지)
        const existing = this.agentSockets.get(agent.id);
        if (existing && existing.id !== socket.id) {
          this.logger.log(`Disconnecting stale agent socket for ${agent.id}`);
          try { existing.disconnect(true); } catch { /* ignore */ }
        }
        this.agentSockets.set(agent.id, socket);
      }
      this.logger.log(`WS connected: ${agent.name} (${agent.id}) as role=${role}`);
      socket.emit('connected', { agentId: agent.id, agentName: agent.name, role });
    } catch {
      socket.emit('error', { message: 'Invalid API key' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const agentId = socket.data?.agentId;
    const role = socket.data?.role;
    if (agentId) {
      if (role === 'agent') this.agentSockets.delete(agentId);
      this.logger.log(`WS disconnected: ${socket.data.agentName} (role=${role})`);
    }
  }

  /** 에이전트가 지식 제출 → DB 저장 */
  @SubscribeMessage('submit_knowledge')
  async handleSubmitKnowledge(
    @ConnectedSocket() socket: Socket,
    @MessageBody() topics: KnowledgeTopic[],
  ) {
    const agentId = socket.data?.agentId;
    if (!agentId) return;

    await this.agentService['knex']('kaas.agent')
      .where({ id: agentId })
      .update({ knowledge: JSON.stringify(topics), updated_at: new Date() });

    this.logger.log(`Knowledge submitted: agent=${agentId}, topics=${topics.length}`);
    socket.emit('knowledge_saved', { count: topics.length });
  }

  /** 에이전트가 self-report 제출.
   *  - `triggered_by === 'request'` (HTTP가 요청해서 응답으로 온 것): `requestSelfReport()`의 `socket.once`가 받아 HTTP로 반환. 브로드캐스트 X.
   *  - 그 외(자발적/autonomous): 모든 웹 클라이언트에 브로드캐스트.
   *  이렇게 해야 HTTP 경로와 WS 경로가 같은 payload를 중복 전송하지 않는다. */
  @SubscribeMessage('submit_self_report')
  handleAgentReport(@ConnectedSocket() socket: Socket, @MessageBody() report: any) {
    const agentId = socket.data?.agentId;
    if (!agentId) return;
    const triggeredBy = report?.triggered_by ?? 'request';
    this.logger.log(`Self-report from agent=${agentId} (${report?.reporter ?? 'unknown'}, triggered_by=${triggeredBy})`);
    if (triggeredBy === 'request') return; // HTTP 경로에서 socket.once로 처리하므로 여기서는 skip
    this.server?.emit('agent_report_pushed', { agentId, report });
  }

  /** 웹에서 Compare 요청 → 연결된 에이전트에게 지식 요청 → gap 분석 반환 */
  async requestKnowledgeAndCompare(agentId: string): Promise<{
    upToDate: any[]; outdated: any[]; gaps: any[]; recommendations: any[]; agentName: string;
  }> {
    const socket = this.agentSockets.get(agentId);
    if (!socket) throw new Error('에이전트가 WebSocket으로 연결되지 않았습니다.');

    // 에이전트에게 지식 요청 (10초 타임아웃)
    const topics: KnowledgeTopic[] = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Knowledge request timed out (10s)')), 10000);
      socket.emit('request_knowledge', { message: 'Cherry KaaS Compare: 보유 지식 목록을 제출해주세요.' });
      socket.once('submit_knowledge', (data: KnowledgeTopic[]) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // gap 분석
    const allConcepts = await this.knowledge.findAll();
    const upToDate: any[] = [];
    const outdated: any[] = [];
    const gaps: any[] = [];

    for (const concept of allConcepts) {
      const match = topics.find((k) =>
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
      ...outdated.map((o) => ({ conceptId: o.conceptId, action: 'purchase', estimatedCredits: 20, reason: 'Outdated' })),
      ...gaps.sort((a, b) => b.qualityScore - a.qualityScore).map((g) => ({ conceptId: g.conceptId, action: 'purchase', estimatedCredits: 20, reason: 'New concept' })),
    ];

    return { upToDate, outdated, gaps, recommendations, agentName: socket.data.agentName };
  }

  /** 구매/팔로우 후 에이전트에게 최신 knowledge 즉시 제출 요청 */
  async pushKnowledgeUpdate(agentId: string, knowledge: Array<{ topic: string; lastUpdated: string }>) {
    const socket = this.agentSockets.get(agentId);
    if (!socket) return;
    socket.emit('submit_knowledge', knowledge);
    this.logger.log(`Knowledge push → agent=${agentId}, topics=${knowledge.length}: [${knowledge.map((k) => k.topic).join(', ')}]`);
  }

  /** 에이전트에게 self-report 요청 → 에이전트 프로세스에서 직접 생성한 JSON 리포트 수신
   *  (대시보드 모달용: 응답을 기다려서 반환) */
  async requestSelfReport(agentId: string): Promise<any> {
    const socket = this.agentSockets.get(agentId);
    if (!socket) {
      throw new Error('에이전트가 WebSocket으로 연결되지 않았습니다. (MCP stdio 클라이언트 실행 필요)');
    }

    const report = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Self-report request timed out (15s)')), 15000);
      socket.emit('request_self_report', {
        requested_at: new Date().toISOString(),
        requested_by: 'cherry-kaas-server',
        scope: 'last 5 events',
      });
      socket.once('submit_self_report', (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    this.logger.log(`Self-report received from agent=${agentId}: ${JSON.stringify(report).length} bytes`);
    return report;
  }


  /** 웹 채팅 → 에이전트에게 메시지 전달 → 응답 반환 (10초 타임아웃) */
  async chatWithAgent(agentId: string, message: string): Promise<{ reply: string; agentName: string }> {
    const socket = this.agentSockets.get(agentId);
    if (!socket) throw new Error('에이전트가 WebSocket으로 연결되지 않았습니다.');

    const reply = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chat timed out (10s)')), 10000);
      socket.emit('chat_request', { message });
      socket.once('chat_reply', (data: { reply: string }) => {
        clearTimeout(timeout);
        resolve(data.reply);
      });
    });

    return { reply, agentName: socket.data.agentName };
  }

  /** 연결된 에이전트 목록 */
  getConnectedAgents() {
    return Array.from(this.agentSockets.entries()).map(([id, s]) => ({
      agentId: id,
      agentName: s.data.agentName,
      connectedAt: s.handshake.time,
    }));
  }

  /* ════════════════════════════════════════════════════════════
     Chat Room — User ↔ Claude ↔ Cherry 3자 대화
     모든 참여자가 한 room에 있고 {from, to, content}로 라우팅.
     ════════════════════════════════════════════════════════════ */

  /** Room에 메시지 분배.
   *  - user role 소켓(웹): 모든 메시지 볼 수 있게 broadcast
   *  - claude 대상: canonical agent socket 하나에만 emit (중복 응답 방지)
   *  - cherry 대상: 서버 내부 bot 트리거
   *
   *  NOTE: @WebSocketServer 로 주입된 this.server 는 이미 /kaas 네임스페이스.
   *  따라서 this.server.in(room).fetchSockets() 로 접근. .of('/kaas') 하면 중첩됨. */
  private async emitToRoom(agentId: string, msg: RoomMessage, exceptSocketId?: string) {
    const room = `room:${agentId}`;
    // 1) user role 소켓(웹)에 broadcast — 중복 방지 위해 직접 iterate
    try {
      const sockets = await this.server.in(room).fetchSockets();
      for (const s of sockets) {
        if (exceptSocketId && s.id === exceptSocketId) continue;
        if ((s.data as any)?.role === 'user') s.emit('room_message', msg);
      }
    } catch { /* ignore */ }

    // 2) Claude 대상 → canonical agent socket 1개에만 전달 (중복 응답 방지)
    if (msg.to === 'claude' && msg.from !== 'claude') {
      const agentSocket = this.agentSockets.get(agentId);
      if (agentSocket) agentSocket.emit('room_message', msg);
    }
    // 3) Cherry 대상 → 서버 내부 bot
    if (msg.to === 'cherry' && msg.from !== 'cherry') {
      this.handleCherryBot(agentId, msg);
    }
  }

  /** 웹 사용자가 room_message 보냄 */
  @SubscribeMessage('room_message')
  async handleRoomMessage(@ConnectedSocket() socket: Socket, @MessageBody() msg: RoomMessage) {
    const agentId = socket.data?.agentId;
    if (!agentId) return;
    const room = `room:${agentId}`;
    socket.join(room);
    const normalized: RoomMessage = {
      ...msg,
      timestamp: msg.timestamp ?? new Date().toISOString(),
    };
    this.logger.log(`[room ${agentId}] ${normalized.from} → ${normalized.to}: ${(normalized.content ?? '').slice(0, 60)}`);
    this.emitToRoom(agentId, normalized, socket.id);
  }

  /** Cherry bot — to="cherry"인 메시지에 LLM으로 응답 */
  private async handleCherryBot(agentId: string, msg: RoomMessage) {
    try {
      // 카탈로그 컨텍스트 포함한 시스템 프롬프트
      const concepts = await this.knowledge.findAll();
      const catalogCtx = concepts.slice(0, 10).map((c: any) => `- ${c.id}: ${c.title} (${c.summary?.slice(0, 50) ?? ''})`).join('\n');
      const systemPrompt = `너는 Cherry KaaS 지식 큐레이터야. 현재 카탈로그에 다음 개념들이 있어:\n\n${catalogCtx}\n\n누군가 질문하면 카탈로그 기반으로 한국어 1~2문장으로 간결히 답해. 가격은 구매 20cr / 팔로우 25cr.`;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          max_tokens: 256,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: msg.content },
          ],
        }),
      });
      const data: any = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? '(Cherry 응답 없음)';

      const out: RoomMessage = {
        from: 'cherry',
        to: msg.from,
        content: reply,
        timestamp: new Date().toISOString(),
      };
      this.emitToRoom(agentId, out);
    } catch (err: any) {
      this.logger.warn(`Cherry bot error: ${err.message}`);
      this.emitToRoom(agentId, {
        from: 'cherry',
        to: msg.from,
        content: `Cherry 오류: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export type RoomMessage = {
  from: 'user' | 'claude' | 'cherry';
  to: 'user' | 'claude' | 'cherry';
  content: string;
  timestamp?: string;
  meta?: Record<string, any>;
};

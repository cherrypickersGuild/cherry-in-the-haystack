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
    if (!apiKey) {
      socket.emit('error', { message: 'API key required' });
      socket.disconnect();
      return;
    }
    try {
      const agent = await this.agentService.authenticate(apiKey as string);
      socket.data.agentId = agent.id;
      socket.data.agentName = agent.name;
      this.agentSockets.set(agent.id, socket);
      this.logger.log(`WS connected: ${agent.name} (${agent.id})`);
      socket.emit('connected', { agentId: agent.id, agentName: agent.name });
    } catch {
      socket.emit('error', { message: 'Invalid API key' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const agentId = socket.data?.agentId;
    if (agentId) {
      this.agentSockets.delete(agentId);
      this.logger.log(`WS disconnected: ${socket.data.agentName}`);
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
}

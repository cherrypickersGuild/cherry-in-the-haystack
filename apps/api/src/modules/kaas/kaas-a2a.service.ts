import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { KaasWsGateway } from './kaas-ws.gateway';
import { KaasAgentService } from './kaas-agent.service';

@Injectable()
export class KaasA2aService {
  private readonly logger = new Logger(KaasA2aService.name);

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
    private readonly wsGateway: KaasWsGateway,
    private readonly agentService: KaasAgentService,
  ) {}

  /** tasks/send */
  async sendTask(initiatorId: string, params: any) {
    const {
      id: taskId,
      executorAgentId,
      message,
      taskType = 'message',
      sessionId,
      idempotencyKey,
      expiresAt,
    } = params ?? {};

    if (!executorAgentId) throw new BadRequestException('executorAgentId required');
    if (!message?.role || !Array.isArray(message?.parts)) {
      throw new BadRequestException('Invalid A2A Message format: role and parts[] required');
    }

    if (idempotencyKey) {
      const existing = await this.knex('kaas.agent_task')
        .where({ idempotency_key: idempotencyKey }).first();
      if (existing) return this.toA2aTask(existing);
    }

    const executor = await this.knex('kaas.agent').where({ id: executorAgentId }).first();
    if (!executor) throw new NotFoundException(`Executor agent not found: ${executorAgentId}`);

    const insertData: any = {
      initiator_id: initiatorId,
      executor_id: executorAgentId,
      task_type: taskType,
      status: 'submitted',
      input: { message },
      session_id: sessionId ?? null,
      idempotency_key: idempotencyKey ?? null,
      expires_at: expiresAt ? new Date(expiresAt) : null,
    };
    if (taskId) insertData.id = taskId;

    const [task] = await this.knex('kaas.agent_task').insert(insertData).returning('*');
    this.logger.log(`Task sent: ${task.id} ${initiatorId} → ${executorAgentId}`);

    // 1) executor의 WebSocket(MCP 에이전트)에 실시간 푸시
    this.wsGateway.pushToAgent(executorAgentId, 'a2a_task_received', this.toA2aTask(task));

    // 2) 웹 Cherry Console들에 브로드캐스트 (agent 메타 포함)
    await this.broadcastToConsoles('task_created', task);

    return this.toA2aTask(task);
  }

  /** tasks/get */
  async getTask(taskId: string) {
    const task = await this.knex('kaas.agent_task').where({ id: taskId }).first();
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);
    return this.toA2aTask(task);
  }

  /** tasks/cancel */
  async cancelTask(agentId: string, taskId: string) {
    const [updated] = await this.knex('kaas.agent_task')
      .where({ id: taskId })
      .andWhere(function () {
        this.where('initiator_id', agentId).orWhere('executor_id', agentId);
      })
      .andWhereNot('status', 'completed')
      .andWhereNot('status', 'canceled')
      .update({ status: 'canceled', updated_at: new Date() })
      .returning('*');

    if (!updated) throw new NotFoundException('Task not found or not cancelable');

    this.wsGateway.pushToAgent(updated.initiator_id, 'a2a_task_canceled', this.toA2aTask(updated));
    this.wsGateway.pushToAgent(updated.executor_id, 'a2a_task_canceled', this.toA2aTask(updated));
    await this.broadcastToConsoles('task_canceled', updated);

    return this.toA2aTask(updated);
  }

  /** tasks/respond — executor가 task 완료 */
  async respondTask(executorId: string, params: any) {
    const { taskId, output, status = 'completed' } = params ?? {};
    if (!taskId) throw new BadRequestException('taskId required');
    if (!['completed', 'failed', 'input-required', 'working'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const [updated] = await this.knex('kaas.agent_task')
      .where({ id: taskId, executor_id: executorId })
      .update({ output, status, updated_at: new Date() })
      .returning('*');

    if (!updated) throw new NotFoundException('Task not found or not assigned to you');

    this.wsGateway.pushToAgent(updated.initiator_id, 'a2a_task_completed', this.toA2aTask(updated));
    await this.broadcastToConsoles('task_responded', updated);

    return this.toA2aTask(updated);
  }

  /** Inbox */
  async getInbox(agentId: string, opts: { status?: string; limit?: number } = {}) {
    let q = this.knex('kaas.agent_task as t')
      .leftJoin('kaas.agent as a', 'a.id', 't.initiator_id')
      .where('t.executor_id', agentId)
      .orderBy('t.created_at', 'desc')
      .limit(opts.limit ?? 50)
      .select('t.*', 'a.name as initiator_name');
    if (opts.status) q = q.where('t.status', opts.status);
    const rows = await q;
    return rows.map((r) => this.toA2aTask(r));
  }

  /** Agent Card */
  async buildAgentCard(agentId: string) {
    const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
    if (!agent) throw new NotFoundException(`Agent not found: ${agentId}`);

    const knowledge = (() => {
      try {
        return typeof agent.knowledge === 'string'
          ? JSON.parse(agent.knowledge)
          : (Array.isArray(agent.knowledge) ? agent.knowledge : []);
      } catch { return []; }
    })();

    const baseUrl = process.env.PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
    if (!baseUrl) {
      this.logger.warn('PUBLIC_API_URL env missing — Agent Card url will be relative path only');
    }

    return {
      name: agent.name,
      description: agent.description ?? `Cherry-registered agent ${agent.name}`,
      url: `${baseUrl}/api/v1/kaas/a2a`,
      version: '1.0.0',
      capabilities: {
        streaming: false,
        pushNotifications: true,
        stateTransitionHistory: true,
      },
      authentication: { schemes: ['apiKey'] },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text', 'data'],
      skills: knowledge.map((k: any) => ({
        id: k.topic ?? k.name ?? 'unknown',
        name: k.topic ?? k.name ?? 'unknown',
      })),
      extensions: {
        'x-cherry': {
          agent_id: agent.id,
          karma_tier: agent.karma_tier,
          wallet_address: agent.wallet_address,
          wallet_type: agent.wallet_type,
        },
      },
    };
  }

  /** 활성 에이전트 목록 (간이 discovery) */
  async listActiveAgents() {
    return this.knex('kaas.agent')
      .where('is_active', true)
      .select('id', 'name', 'karma_tier')
      .orderBy('name');
  }

  // ─── Private helpers ───

  private toA2aTask(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      status: {
        state: row.status,
        timestamp: (row.updated_at ?? row.created_at)?.toISOString?.()
          ?? new Date().toISOString(),
      },
      message: row.input?.message ?? null,
      artifact: row.output
        ? { name: 'response', parts: row.output?.parts ?? [{ type: 'data', data: row.output }] }
        : null,
      'x-cherry': {
        task_type: row.task_type,
        initiator_id: row.initiator_id,
        executor_id: row.executor_id,
        initiator_name: row.initiator_name ?? null,
      },
    };
  }

  /** 웹 Cherry Console들에 이벤트 송출
   *  payload에 from_agent/to_agent (id, name, user_id) 포함. 클라이언트가 필터링.
   */
  private async broadcastToConsoles(eventType: string, task: any) {
    try {
      const [initiator, executor] = await Promise.all([
        this.knex('kaas.agent').where({ id: task.initiator_id })
          .select('id', 'name', 'user_id').first(),
        this.knex('kaas.agent').where({ id: task.executor_id })
          .select('id', 'name', 'user_id').first(),
      ]);
      if (!this.wsGateway.server) return;
      this.wsGateway.server.emit('a2a_task_event', {
        type: eventType,
        task: this.toA2aTask({ ...task, initiator_name: initiator?.name }),
        from_agent: {
          id: initiator?.id,
          name: initiator?.name,
          user_id: initiator?.user_id,
        },
        to_agent: {
          id: executor?.id,
          name: executor?.name,
          user_id: executor?.user_id,
        },
      });
    } catch (e: any) {
      this.logger.warn(`broadcastToConsoles failed: ${e.message}`);
    }
  }
}

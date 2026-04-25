/**
 * KaasAcpController — IBM/BeeAI Agent Communication Protocol (ACP) facade.
 *
 * Same business logic as the A2A controller, exposed under REST URLs that
 * follow the ACP spec instead of JSON-RPC. Both controllers share
 * `KaasA2aService` so a single agent_task table backs both protocols.
 *
 * ACP shape highlights:
 *   GET  /agents               — list (discovery)
 *   GET  /agents/{name}        — agent manifest (≈ A2A agent card)
 *   POST /runs                 — start a run (≈ tasks/send)
 *   GET  /runs/{id}            — fetch run state (≈ tasks/get)
 *   POST /runs/{id}/cancel     — cancel (≈ tasks/cancel)
 *   POST /runs/{id}/messages   — send follow-up message (≈ tasks/respond)
 *   GET  /inbox                — incoming runs for the authed agent
 */

import {
  Body, Controller, Get, Headers, HttpCode, NotFoundException, Param, Post, Query, Logger,
} from '@nestjs/common'
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger'

import { KaasA2aService } from './kaas-a2a.service'
import { KaasAgentService } from './kaas-agent.service'

@Controller('v1/kaas/acp')
@ApiTags('Agent Communication (ACP)')
export class KaasAcpController {
  private readonly logger = new Logger(KaasAcpController.name)

  constructor(
    private readonly service: KaasA2aService,
    private readonly agentService: KaasAgentService,
  ) {}

  // ── Discovery ──────────────────────────────────────────────

  @Get('agents')
  @ApiOperation({ summary: 'List active agents (ACP discovery)' })
  async list() {
    return this.service.listActiveAgents()
  }

  /** Agent manifest — ACP equivalent of A2A's agent card. We delegate to the
   *  same builder so the JSON shape stays consistent across protocols. */
  @Get('agents/:name')
  @ApiOperation({ summary: 'ACP Agent Manifest (≈ A2A agent card)' })
  async manifest(@Param('name') name: string) {
    return this.service.buildAgentCard(name)
  }

  // ── Runs (≈ A2A tasks) ─────────────────────────────────────

  /** Start a run. ACP body shape:
   *  { agent_name, input: { message: { role, parts } }, session_id?, ... } */
  @Post('runs')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start an ACP run (≈ tasks/send)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async startRun(
    @Body() body: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (!apiKey) {
      throw new NotFoundException({ code: 'AUTH_REQUIRED', message: 'Missing x-api-key header' })
    }
    const agent = await this.agentService.authenticate(apiKey)

    // ACP `agent_name` → A2A `executorAgentId`. We accept either for compat.
    const executorAgentId = body?.agent_name ?? body?.executorAgentId
    const message = body?.input?.message ?? body?.message
    const params = {
      executorAgentId,
      message,
      taskType: body?.task_type ?? body?.taskType ?? 'message',
      sessionId: body?.session_id ?? body?.sessionId,
      idempotencyKey: body?.idempotency_key ?? body?.idempotencyKey,
      expiresAt: body?.expires_at ?? body?.expiresAt,
      id: body?.run_id ?? body?.id,
    }
    const task = await this.service.sendTask(agent.id, params)
    return this.toAcpRun(task)
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Fetch run state (≈ tasks/get)' })
  async getRun(@Param('id') id: string) {
    const task = await this.service.getTask(id)
    return this.toAcpRun(task)
  }

  @Post('runs/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a run (≈ tasks/cancel)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async cancelRun(
    @Param('id') id: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    const agent = await this.agentService.authenticate(apiKey)
    const task = await this.service.cancelTask(agent.id, id)
    return this.toAcpRun(task)
  }

  @Post('runs/:id/messages')
  @HttpCode(200)
  @ApiOperation({ summary: 'Append a message to a run (≈ tasks/respond)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async respond(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    const agent = await this.agentService.authenticate(apiKey)
    const task = await this.service.respondTask(agent.id, {
      id,
      message: body?.message ?? body,
    })
    return this.toAcpRun(task)
  }

  // ── Inbox (UI helper, same as A2A) ─────────────────────────

  @Get('inbox')
  @ApiOperation({ summary: 'Incoming runs for the authed agent' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async inbox(
    @Headers('x-api-key') apiKey: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const agent = await this.agentService.authenticate(apiKey)
    return this.service.getInbox(agent.id, {
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    })
  }

  // ── helpers ────────────────────────────────────────────────

  /** A2A Task → ACP Run shape. Snake-case keys + flatter envelope. */
  private toAcpRun(task: any) {
    return {
      run_id: task?.id,
      agent_name: task?.executorAgentId ?? task?.executor_id,
      status: task?.status,
      session_id: task?.sessionId ?? task?.session_id ?? null,
      input: task?.input ?? null,
      output: task?.output ?? task?.result ?? null,
      created_at: task?.createdAt ?? task?.created_at ?? null,
      updated_at: task?.updatedAt ?? task?.updated_at ?? null,
      // Keep the raw A2A task object available for clients that already
      // understand the A2A shape — zero loss conversion.
      _a2a: task,
    }
  }
}

import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { KaasA2aService } from './kaas-a2a.service';
import { KaasAgentService } from './kaas-agent.service';

@Controller('v1/kaas/a2a')
@ApiTags('Agent Communication (A2A)')
export class KaasA2aController {
  private readonly logger = new Logger(KaasA2aController.name);

  constructor(
    private readonly service: KaasA2aService,
    private readonly agentService: KaasAgentService,
  ) {}

  /** JSON-RPC 2.0 main endpoint */
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'A2A JSON-RPC 2.0 endpoint (tasks/send|get|cancel|respond)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async rpc(
    @Body() req: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (req?.jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id: req?.id ?? null,
        error: { code: -32600, message: 'Invalid Request — jsonrpc must be "2.0"' } };
    }
    if (!apiKey) {
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32001, message: 'Missing x-api-key header' } };
    }

    let agent: any;
    try {
      agent = await this.agentService.authenticate(apiKey);
    } catch (err: any) {
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32001, message: 'Authentication failed: ' + err.message } };
    }

    try {
      let result: any;
      switch (req.method) {
        case 'tasks/send':    result = await this.service.sendTask(agent.id, req.params); break;
        case 'tasks/get':     result = await this.service.getTask(req.params?.id); break;
        case 'tasks/cancel':  result = await this.service.cancelTask(agent.id, req.params?.id); break;
        case 'tasks/respond': result = await this.service.respondTask(agent.id, req.params); break;
        default:
          return { jsonrpc: '2.0', id: req.id ?? null,
            error: { code: -32601, message: `Method not found: ${req.method}` } };
      }
      return { jsonrpc: '2.0', id: req.id ?? null, result };
    } catch (err: any) {
      this.logger.error(`RPC error [${req.method}]: ${err.message}`);
      return { jsonrpc: '2.0', id: req.id ?? null,
        error: { code: -32000, message: err.message } };
    }
  }

  /** Agent Card — A2A discovery */
  @Get('agents/:id/card')
  @ApiOperation({ summary: 'A2A Agent Card (discovery)' })
  async card(@Param('id') agentId: string) {
    return this.service.buildAgentCard(agentId);
  }

  /** Inbox (UI용) */
  @Get('inbox')
  @ApiOperation({ summary: '내 받은 task 목록 (UI/편의용)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async inbox(
    @Headers('x-api-key') apiKey: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const agent = await this.agentService.authenticate(apiKey);
    return this.service.getInbox(agent.id, {
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /** 에이전트 리스트 (간이 discovery) */
  @Get('agents')
  @ApiOperation({ summary: '활성 에이전트 목록' })
  async list() {
    return this.service.listActiveAgents();
  }
}

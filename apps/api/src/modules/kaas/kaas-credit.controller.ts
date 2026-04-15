import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { KaasAgentService } from './kaas-agent.service';
import { KaasCreditService } from './kaas-credit.service';
import { KaasProvenanceService } from './kaas-provenance.service';
import { DepositDto, DepositSchema } from './input-dto/deposit.dto';

@Controller('v1/kaas/credits')
@ApiTags('KaaS — Credits')
export class KaasCreditController {
  constructor(
    private readonly agentService: KaasAgentService,
    private readonly credit: KaasCreditService,
    private readonly provenance: KaasProvenanceService,
  ) {}

  private async findAgent(apiKey?: string) {
    if (apiKey) return this.agentService.authenticate(apiKey);
    // api_key 없으면 첫 번째 에이전트 사용
    const agents = await this.agentService.findByUserId('00000000-0000-0000-0000-000000000000');
    if (agents.length === 0) throw new Error('No agent registered');
    return agents[0];
  }

  @Get('balance')
  @ApiOperation({ summary: '크레딧 잔액 조회' })
  async getBalance(@Query('api_key') apiKey?: string) {
    const agent = await this.findAgent(apiKey);
    return this.credit.getBalance(agent.id);
  }

  @Post('deposit')
  @HttpCode(200)
  @ApiOperation({ summary: '크레딧 충전 (온체인 tx 생성)' })
  async deposit(@Body(new ZodValidationPipe(DepositSchema)) dto: DepositDto) {
    const agent = await this.findAgent(dto.api_key);
    return this.credit.deposit(agent.id, dto.amount, dto.chain as any);
  }

  @Get('history')
  @ApiOperation({ summary: '구매/팔로우 이력 조회' })
  async getHistory(@Query('api_key') apiKey?: string) {
    const agent = await this.findAgent(apiKey);
    return this.provenance.getQueryHistory(agent.id);
  }

  @Get('ledger')
  @ApiOperation({ summary: '크레딧 원장 내역 (deposit + consume)' })
  async getLedger(@Query('api_key') apiKey?: string, @Query('limit') limit?: string) {
    const agent = await this.findAgent(apiKey);
    return this.credit.getLedger(agent.id, limit ? parseInt(limit, 10) : 50);
  }
}

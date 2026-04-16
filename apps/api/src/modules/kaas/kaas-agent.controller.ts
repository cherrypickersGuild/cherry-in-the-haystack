import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { KaasAgentService } from './kaas-agent.service';
import { KaasCreditService } from './kaas-credit.service';
import { RegisterAgentDto } from './input-dto/register-agent.dto';

const WELCOME_CREDITS = 200;

@Controller('v1/kaas/agents')
@ApiTags('KaaS — Agent')
@UseGuards(AuthGuard('jwt'))
export class KaasAgentController {
  constructor(
    private readonly agentService: KaasAgentService,
    private readonly credit: KaasCreditService,
  ) {}

  /** 소유권 확인 헬퍼 — agent의 user_id와 JWT userId 일치 여부 */
  private async verifyOwnership(agentId: string, userId: string) {
    const agent = await this.agentService.findById(agentId);
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.user_id !== userId) throw new ForbiddenException('Not your agent');
    return agent;
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '에이전트 등록 → API Key 발급' })
  async register(
    @AuthUser('id') userId: string,
    @Body(new ZodValidationPipe(RegisterAgentDto.schema)) dto: RegisterAgentDto,
  ) {
    const agent = await this.agentService.register(userId, dto);

    // 가입 축하 크레딧 — DB만 (트랜잭션 없이 즉시)
    await this.credit.depositDbOnly(agent.id, WELCOME_CREDITS).catch(() => {});

    return {
      id: agent.id,
      name: agent.name,
      api_key: agent.api_key,
      wallet_address: agent.wallet_address,
      llm_provider: agent.llm_provider,
      karma_tier: agent.karma_tier,
      credits: WELCOME_CREDITS,
      created_at: agent.created_at,
    };
  }

  @Get()
  @ApiOperation({ summary: '내 에이전트 목록 조회' })
  async list(@AuthUser('id') userId: string) {
    return this.agentService.findByUserId(userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '에이전트 삭제 (소유권 확인)' })
  async delete(@AuthUser('id') userId: string, @Param('id') id: string) {
    await this.verifyOwnership(id, userId);
    await this.agentService.deleteAgent(id);
  }

  @Patch(':id/model')
  @ApiOperation({ summary: '에이전트 LLM 모델 변경 (소유권 확인)' })
  async updateModel(@AuthUser('id') userId: string, @Param('id') id: string, @Body() body: { llm_model: string }) {
    await this.verifyOwnership(id, userId);
    await this.agentService.updateModel(id, body.llm_model);
    return { success: true };
  }

  @Get(':id/karma')
  @ApiOperation({ summary: 'Read agent Karma tier from Status Network onchain (live)' })
  async getKarma(@AuthUser('id') userId: string, @Param('id') id: string) {
    await this.verifyOwnership(id, userId);
    const result = await this.agentService.refreshKarmaFromOnchain(id);
    return {
      walletAddress: result.walletAddress,
      tier: result.tier,
      balance: result.balance,
      onchainTierId: result.onchainTierId,
      onchainTierName: result.onchainTierName,
      txPerEpoch: result.txPerEpoch,
      chain: 'Status Network Hoodi',
      karmaContract: process.env.STATUS_KARMA_ADDRESS ?? null,
      karmaTiersContract: process.env.STATUS_KARMA_TIERS_ADDRESS ?? null,
    };
  }
}

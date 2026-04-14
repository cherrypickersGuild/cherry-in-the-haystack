import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { KaasAgentService } from './kaas-agent.service';
import { RegisterAgentDto } from './input-dto/register-agent.dto';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Controller('v1/kaas/agents')
@ApiTags('KaaS — Agent')
export class KaasAgentController {
  constructor(private readonly agentService: KaasAgentService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '에이전트 등록 → API Key 발급' })
  async register(
    @Body(new ZodValidationPipe(RegisterAgentDto.schema)) dto: RegisterAgentDto,
  ) {
    // TODO: JWT에서 userId 추출. 현재는 시스템 유저로 대체
    const agent = await this.agentService.register(SYSTEM_USER_ID, dto);
    return {
      id: agent.id,
      name: agent.name,
      api_key: agent.api_key,
      wallet_address: agent.wallet_address,
      llm_provider: agent.llm_provider,
      karma_tier: agent.karma_tier,
      created_at: agent.created_at,
    };
  }

  @Get()
  @ApiOperation({ summary: '내 에이전트 목록 조회' })
  async list() {
    // TODO: JWT에서 userId 추출
    return this.agentService.findByUserId(SYSTEM_USER_ID);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '에이전트 삭제' })
  async delete(@Param('id') id: string) {
    await this.agentService.deleteAgent(id);
  }

  @Patch(':id/model')
  @ApiOperation({ summary: '에이전트 LLM 모델 변경' })
  async updateModel(@Param('id') id: string, @Body() body: { llm_model: string }) {
    await this.agentService.updateModel(id, body.llm_model);
    return { success: true };
  }
}

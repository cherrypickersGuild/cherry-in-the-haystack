import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';

@Controller('v1/kaas/llm')
@ApiTags('KaaS — LLM Proxy')
export class KaasLlmController {
  constructor(private readonly agentService: KaasAgentService) {}

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'LLM 프록시 — 에이전트가 구매한 지식으로 대화' })
  async chat(
    @Body() body: { api_key?: string; content_md: string; question: string },
  ) {
    // 에이전트 조회 → LLM provider + key 가져오기
    let llmProvider = 'claude';
    let llmModel = '';
    let llmApiKey = '';

    if (body.api_key) {
      const agent = await this.agentService.authenticate(body.api_key);
      llmProvider = (agent as any).llm_provider ?? 'claude';
      llmModel = (agent as any).llm_model ?? '';
      llmApiKey = (agent as any).llm_api_key ?? '';
    }

    if (!llmApiKey) {
      return { reply: body.content_md.slice(0, 500), provider: llmProvider, error: 'No LLM API key configured' };
    }

    const systemPrompt = body.content_md
      ? `너는 Cherry KaaS에서 지식을 구매해서 학습하는 AI 에이전트야.
방금 아래 지식을 구매해서 학습했어. 이 내용을 바탕으로 유저에게 핵심을 정리해서 알려줘. 한국어로 간결하게.

--- 학습한 지식 ---
${body.content_md}
--- 끝 ---`
      : `너는 Cherry KaaS에서 지식을 구매하러 온 AI 에이전트야.
유저의 비서 역할이고, 유저를 대신해서 Cherry에게 지식을 검색하고 구매하는 게 너의 일이야.

규칙:
- 유저가 뭔가 물어보면 네가 아는 선에서 답해
- 네가 모르거나 더 정확한 정보가 필요하면 "Cherry에게 물어볼게요"라고 말하고, Cherry 카탈로그에서 관련 개념을 검색해서 알려줘
- 유저가 구매하라고 하면 "구매 진행하겠습니다"라고 답해
- 절대 유저에게 직접 카탈로그를 보라고 하지 마. 네가 대신 해주는 거야
- 한국어로 간결하게 답해`;

    try {
      if (llmProvider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': llmApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: llmModel || 'claude-sonnet-4-20250514',
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: 'user', content: body.question }],
          }),
        });
        const data = await res.json();
        const reply = data.content?.[0]?.text ?? data.error?.message ?? 'No response';
        return { reply, provider: 'claude' };
      }

      if (llmProvider === 'gpt') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmApiKey}`,
          },
          body: JSON.stringify({
            model: llmModel || 'gpt-4o-mini',
            max_tokens: 512,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: body.question },
            ],
          }),
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content ?? data.error?.message ?? 'No response';
        return { reply, provider: 'gpt' };
      }

      return { reply: body.content_md.slice(0, 500), provider: llmProvider };
    } catch (err: any) {
      return { reply: `LLM Error: ${err.message}`, provider: llmProvider, error: err.message };
    }
  }
}

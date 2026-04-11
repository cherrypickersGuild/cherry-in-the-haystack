import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CreateVersionDto {
  static schema = z.object({
    prompt_text: z.string().trim().min(1),
    few_shot_examples: z.string().trim().optional(),
    parameters_json: z.record(z.unknown()).optional().default({}),
    change_note: z.string().trim().max(500).optional(),
  });

  @ApiProperty({
    example: 'You are an expert AI/ML analyst. Analyze the article.\n\n{article_content}',
    description: '프롬프트 본문',
  })
  prompt_text!: string;

  @ApiPropertyOptional({
    example: 'Example 1:\nInput: "GPT-5 released..."\nOutput: { "ai_summary": "..." }',
    description: 'Few-shot 예시',
  })
  few_shot_examples?: string;

  @ApiPropertyOptional({
    example: { max_tokens: 1200, temperature: 0.3 },
    description: 'LLM 파라미터 (JSON 객체)',
  })
  parameters_json?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '평가 기준 세분화',
    description: '변경 메모',
  })
  change_note?: string;
}

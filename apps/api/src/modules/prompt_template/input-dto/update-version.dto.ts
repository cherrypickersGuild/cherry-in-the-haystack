import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class UpdateVersionDto {
  static schema = z.object({
    prompt_text: z.string().trim().min(1).optional(),
    few_shot_examples: z.string().trim().optional(),
    parameters_json: z.record(z.unknown()).optional(),
    change_note: z.string().trim().max(500).optional(),
  });

  @ApiPropertyOptional({
    example: 'You are an expert AI/ML analyst...',
    description: '프롬프트 본문',
  })
  prompt_text?: string;

  @ApiPropertyOptional({
    example: 'Example 1: ...',
    description: 'Few-shot 예시',
  })
  few_shot_examples?: string;

  @ApiPropertyOptional({
    example: { max_tokens: 1500, temperature: 0.2 },
    description: 'LLM 파라미터 (JSON 객체)',
  })
  parameters_json?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'temperature 낮춤',
    description: '변경 메모',
  })
  change_note?: string;
}

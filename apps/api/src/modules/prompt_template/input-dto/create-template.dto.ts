import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CreateTemplateDto {
  static schema = z.object({
    // ── 템플릿 메타
    type: z.enum(['ARTICLE_AI', 'NEWSLETTER']),
    code: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
    tone_text: z.string().trim().min(1),

    // ── 초기 버전 (v1)
    prompt_text: z.string().trim().min(1),
    few_shot_examples: z.string().trim().optional(),
    parameters_json: z
      .record(z.unknown())
      .optional()
      .default({}),
    change_note: z.string().trim().max(500).optional(),
  });

  /* ── 템플릿 메타 ── */

  @ApiProperty({
    example: 'ARTICLE_AI',
    enum: ['ARTICLE_AI', 'NEWSLETTER'],
    description: '템플릿 유형',
  })
  type!: string;

  @ApiProperty({
    example: 'article_ai_v2',
    description: '고유 식별 코드 (동일 type 내 중복 불가)',
  })
  code!: string;

  @ApiProperty({
    example: '기본 아티클 분석',
    description: '템플릿 이름',
  })
  name!: string;

  @ApiPropertyOptional({
    example: '아티클 요약·점수·분류·태그를 생성하는 기본 템플릿',
    description: '설명',
  })
  description?: string;

  @ApiProperty({
    example:
      '기술적이고 간결하게 요약하라. 독자는 ML 엔지니어이다. 점수는 실용적 가치 기준으로 평가하고, 과장하지 말 것.',
    description: '톤·방향 지시문',
  })
  tone_text!: string;

  /* ── 초기 버전 (v1) ── */

  @ApiProperty({
    example: `You are an expert AI/ML analyst. Given the article below, return a structured JSON analysis.

Requirements:
- ai_summary: 1-2 sentence summary in Korean
- ai_score: integer 1-5 (practical value for ML engineers)
- ai_classification_json: { "primary_category": string, "confidence": float }
- ai_tags_json: array of { "kind": "TAG"|"KEYWORD", "value": string }
- ai_snippets_json: { "why_it_matters": string, "key_points": string[] }

Article:
{article_content}`,
    description: '프롬프트 본문',
  })
  prompt_text!: string;

  @ApiPropertyOptional({
    example: `Example 1:
Input: "GPT-4o achieves SOTA on MMLU with 88.7% accuracy..."
Output: {
  "ai_summary": "OpenAI의 GPT-4o가 MMLU 벤치마크에서 최고 성능을 달성했습니다.",
  "ai_score": 4,
  "ai_classification_json": { "primary_category": "MODEL_UPDATES", "confidence": 0.95 },
  "ai_tags_json": [{ "kind": "TAG", "value": "GPT-4o" }, { "kind": "TAG", "value": "MMLU" }]
}`,
    description: 'Few-shot 예시 (선택)',
  })
  few_shot_examples?: string;

  @ApiPropertyOptional({
    example: { max_tokens: 1200, temperature: 0.3, top_p: 0.9 },
    description: 'LLM 파라미터 (JSON 객체)',
  })
  parameters_json?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '초기 버전',
    description: '변경 메모',
  })
  change_note?: string;
}

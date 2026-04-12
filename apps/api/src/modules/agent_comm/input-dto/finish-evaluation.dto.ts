import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

const resultItemSchema = z.object({
  idempotency_key: z.string(),
  version: z.string(),
  representative_entity: z.object({
    id: z.string().uuid(),
    page: z.string(),
    category_id: z.string().uuid(),
    category_name: z.string(),
    name: z.string(),
  }),
  ai_summary: z.string(),
  ai_score: z.number().int().min(1).max(5),
  ai_classification_json: z.record(z.unknown()),
  side_category_code: z.string().nullable(),
  ai_tags_json: z.array(z.record(z.unknown())),
  ai_snippets_json: z.record(z.unknown()),
  ai_evidence_json: z.record(z.unknown()).optional(),
  ai_structured_extraction_json: z.record(z.unknown()).optional(),
});

export class FinishEvaluationDto {
  static schema = z.object({
    results: z.array(resultItemSchema).min(1),
  });

  @ApiProperty({
    description: '평가 결과 배열. idempotency_key는 ask-evaluation items에서 받은 값을 그대로 사용.',
    example: [
      {
        idempotency_key: 'uas:00000000-0000-0000-0000-000000000000',
        version: '0.3',
        representative_entity: {
          id: '0195f300-1001-7000-b000-000000000010',
          page: 'FRAMEWORKS',
          category_id: '0195f300-2001-7000-a000-000000000010',
          category_name: 'Agent',
          name: 'LangChain',
        },
        ai_summary: 'LangChain v0.3이 멀티모달 RAG 파이프라인을 도입하여 이미지와 텍스트를 통합 검색할 수 있게 되었습니다.',
        ai_score: 4,
        ai_classification_json: {
          final_path: {
            page: 'FRAMEWORKS',
            category_name: 'Agent',
            entity_name: 'LangChain',
          },
          candidates: [
            { page: 'FRAMEWORKS', category_name: 'Agent', entity_name: 'LangChain', confidence: 0.95 },
            { page: 'FRAMEWORKS', category_name: 'RAG', entity_name: 'LangChain', confidence: 0.40 },
          ],
          decision_reason: 'LangChain core framework update with new RAG component',
        },
        side_category_code: null,
        ai_tags_json: [
          { kind: 'TAG', value: 'langchain' },
          { kind: 'TAG', value: 'multi-modal-rag' },
          { kind: 'TAG', value: 'vision-retriever' },
          { kind: 'KEYWORD', value: 'RAG', frequency: 8, confidence: 0.93 },
          { kind: 'KEYWORD', value: 'CLIP', frequency: 3, confidence: 0.85 },
        ],
        ai_snippets_json: {
          why_it_matters: 'LangChain에 멀티모달 RAG가 추가되어 이미지+텍스트 통합 검색 앱 구축이 가능해졌습니다.',
          key_points: ['VisionRetriever로 CLIP 기반 이미지 임베딩 통합', '멀티모달 QA 태스크에서 35% 성능 향상', '체인 구성 API 간소화 및 네이티브 스트리밍 지원'],
          risk_notes: ['이미지 임베딩 품질은 CLIP 모델 선택에 따라 달라질 수 있음'],
        },
        ai_evidence_json: {
          evidence_items: [
            {
              kind: 'quote',
              text: 'Benchmarks show 35% improvement in multi-modal QA tasks compared to text-only RAG pipelines.',
              url: 'https://blog.langchain.dev/langchain-v03-multi-modal-rag',
              source_name: 'LangChain Blog',
              published_at: '2026-04-12T14:00:00+00:00',
            },
          ],
        },
        ai_structured_extraction_json: {
          source: { name: 'LangChain Blog', type: 'RSS' },
          review: { type: null, reviewer: null, comment: null },
        },
      },
    ],
  })
  results!: Record<string, unknown>[];
}

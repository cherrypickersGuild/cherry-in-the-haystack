import { ApiProperty } from '@nestjs/swagger';
import { EvidenceRow } from '../entity/evidence-row.entity';

export interface WriterInputErrorItem {
  code: string;
  message: string;
}

export interface GraphContext {
  mode: string;
  focus_concepts: unknown[];
  related_concepts: unknown[];
}

export interface UpdatePayload {
  title: string;
  body: string;
}

export interface WriterInputMeta {
  source: string;
  generated_at: string;
  schema_version: string;
}

/**
 * POST /writer-agent/input — Response body
 *
 * 명세 agent-api-spec §3 "writer_agent 입력 JSON (백엔드 패딩 결과)" 형식.
 * 빈 결과시 evidence_rows: [] + errors 에 NO_DATA 항목.
 */
export class WriterInputResponseDto {
  @ApiProperty({ example: '0.2' })
  version!: string;

  @ApiProperty({ example: 'RAG evaluation' })
  topic!: string;

  @ApiProperty({
    example: { mode: 'direct_graphdb', focus_concepts: [], related_concepts: [] },
    description: 'GraphDB 컨텍스트. writer_agent 가 직접 조회하므로 백엔드는 빈 배열 패딩.',
  })
  graph_context!: GraphContext;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'topic 관련 evidence chunk 목록 (명세 §3 evidence_rows)',
  })
  evidence_rows!: EvidenceRow[];

  @ApiProperty({
    nullable: true,
    example: null,
    description: '주간 업데이트 페이로드. 없으면 null.',
  })
  update_payload!: UpdatePayload | null;

  @ApiProperty({
    example: {
      source: 'backend',
      generated_at: '2026-05-31T12:00:00.000Z',
      schema_version: 'handbook-v2',
    },
  })
  meta!: WriterInputMeta;

  @ApiProperty({
    example: [],
    description: '에러/경고 항목. 빈 결과 등 비치명적 상황 보고용.',
  })
  errors!: WriterInputErrorItem[];
}

import { ApiProperty } from '@nestjs/swagger';

export interface ConceptNode {
  id: string; // 온톨로지 IRI local name (예: "DenseRetrieval")
  label: string;
  description: string | null;
}

export interface RelatedConceptsErrorItem {
  code: string;
  message: string;
}

/**
 * GET /writer-agent/related-concepts — Response
 *
 * GraphDB(llm-ontology) 에서 topic 개념의 상위/하위 관련 개념을 반환.
 * (GraphDB Workbench 의 개념 탐색 시연을 API 로 재현)
 */
export class RelatedConceptsResponseDto {
  @ApiProperty({ example: 'RAG' })
  topic!: string;

  @ApiProperty({
    nullable: true,
    example: { id: 'RAG', label: 'RAG', description: 'RAG(Retrieval-Augmented Generation)는...' },
    description: 'topic 과 정확 매칭된 개념 (case-insensitive). 없으면 null.',
  })
  matched!: ConceptNode | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: '상위 개념 (rdfs:subClassOf 부모)',
  })
  parents!: ConceptNode[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: '하위 개념 (이 개념을 subClassOf 하는 자식)',
  })
  children!: ConceptNode[];

  @ApiProperty({
    example: { source: 'graphdb', repository: 'llm-ontology', total: 5 },
  })
  meta!: { source: string; repository: string; total: number };

  @ApiProperty({ example: [] })
  errors!: RelatedConceptsErrorItem[];
}

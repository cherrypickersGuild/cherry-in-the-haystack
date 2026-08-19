/**
 * 개념 관계 공급자 — 소스 교체 가능 구조
 * 기획: apps/docs/ontology-migration/2-implementation-guide.md §5
 *
 * CONCEPT_RELATION_SOURCE = postgres(기본) | graphdb | synced
 * 세 구현이 **같은 응답 모양**을 내므로 화면·API 코드는 소스를 모른다.
 */
export interface ConceptNode {
  /** 온톨로지 노드 로컬명 (예: HybridRetrieval) — 소스 간 매칭 키 */
  node: string;
  /** 표시 이름 */
  label: string;
  description: string | null;
  /** 화면에서 쓰는 다른 이름들 */
  aliases: string[];
}

export type RelationType =
  | 'SUBTOPIC' | 'PREREQUISITE' | 'EXTENDS' | 'RELATED' | 'CONTRADICTS';

/** from 은 to 의 <type> 이다 */
export interface ConceptEdge {
  node: string;
  label: string;
  description: string | null;
  relation: RelationType;
}

export interface ConceptRelations {
  /** 이 개념이 <type> 인 대상 (위로) */
  parents: ConceptEdge[];
  /** 이 개념을 <type> 로 가리키는 것들 (아래로) */
  children: ConceptEdge[];
}

export interface ConceptRelationProvider {
  readonly source: 'postgres' | 'graphdb' | 'synced';
  getConcept(node: string): Promise<ConceptNode | null>;
  getRelations(node: string): Promise<ConceptRelations>;
}

export const CONCEPT_RELATION_PROVIDER = 'CONCEPT_RELATION_PROVIDER';

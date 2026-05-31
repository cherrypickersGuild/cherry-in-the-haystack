/**
 * Writer Agent 입력 — Evidence Row 타입 (handbook v2 / 명세 agent-api-spec §3)
 *
 * handbook DB 에서 한 청크당 한 행. topic 매칭된 concept 에 연결된 paragraph_chunk.
 *
 * - ID 컬럼은 v2 에서 UUID (pg/knex 가 string 으로 직렬화) → 캐스팅 불요.
 * - 점수/신뢰도 컬럼은 NUMERIC(3,2) 라 pg 가 string 으로 주므로 SQL 에서 ::float8
 *   캐스팅하여 number 로 내려감 (명세 예시처럼 0.95 형태).
 */
export interface EvidenceRow {
  chunk_id: string;
  body_text: string;
  page_number: number | null;
  paragraph_index: number | null;
  chapter_paragraph_index: number | null;
  chapter_id: string | null;
  section_id: string | null;
  book_id: string | null;
  book_title: string | null;
  book_author: string | null;
  concept_id: string;
  concept_name: string;
  is_primary: boolean;
  extraction_confidence: number | null;
  extract_type: string | null;
  handbook_topic: string | null;
  handbook_subtopic: string | null;
  judge_originality: number | null;
  judge_depth: number | null;
  judge_technical_accuracy: number | null;
  importance_score: number | null;
  sampling_weight: number | null;
}

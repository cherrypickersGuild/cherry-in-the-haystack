-- ════════════════════════════════════════════════════════════════
-- Learning 온톨로지 이관 — 2단계: 칸(컬럼)·표(테이블) 추가
-- 기획: apps/docs/ontology-migration/2-implementation-guide.md §1, §3-2-B
-- 원칙: 추가만 한다. 기존 칸 변경·삭제 없음. 기존 데이터 수정 없음.
-- ════════════════════════════════════════════════════════════════
BEGIN;

-- ① 개념마다 "원래 온톨로지 주소"를 적어둘 칸
--    이게 있어야 나중에 GraphDB 와 대조·동기화가 가능하다(이름은 서로 달라서 못 씀)
ALTER TABLE handbook.concept
  ADD COLUMN IF NOT EXISTS ontology_node VARCHAR(200);

COMMENT ON COLUMN handbook.concept.ontology_node IS
  'GraphDB llm-ontology 의 노드 로컬명(예: HybridRetrieval). 동기화 매칭 키.';

-- 같은 온톨로지 노드가 살아있는 행으로 두 번 들어가지 않게
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_ontology_node_active
  ON handbook.concept (ontology_node)
  WHERE (ontology_node IS NOT NULL AND revoked_at IS NULL);

-- ② 개념 페이지가 어느 화면 것인지 구분하는 칸
--    지금 이 표에 KaaS 마켓용 1행이 들어있어서, Learning 페이지와 섞이면 안 됨
--    (기존 1행은 NULL 로 그대로 둔다 — 기존 데이터 수정 없음)
ALTER TABLE content.concept_page
  ADD COLUMN IF NOT EXISTS surface VARCHAR(20);

COMMENT ON COLUMN content.concept_page.surface IS
  '이 페이지가 속한 화면. learning | kaas. 기존 행은 NULL(미분류).';

-- ③ 개념끼리의 관계를 담을 표 (지금 Postgres 에는 아예 없음)
DO $$ BEGIN
  CREATE TYPE handbook.concept_relation_enum AS ENUM
    ('SUBTOPIC','PREREQUISITE','EXTENDS','RELATED','CONTRADICTS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS handbook.concept_relation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_concept_id UUID NOT NULL REFERENCES handbook.concept(id),
  to_concept_id   UUID NOT NULL REFERENCES handbook.concept(id),
  relation_type   handbook.concept_relation_enum NOT NULL,
  origin          VARCHAR(30) NOT NULL DEFAULT 'graphdb-import',
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  CONSTRAINT ck_concept_relation_no_self CHECK (from_concept_id <> to_concept_id)
);

COMMENT ON TABLE handbook.concept_relation IS
  '개념 간 관계. 읽는 법: from 은 to 의 <relation_type> 이다. (Chunking 은 RAG 의 SUBTOPIC 이다)';
COMMENT ON COLUMN handbook.concept_relation.origin IS
  '출처. graphdb-import = 이관분(동기화가 덮어씀) / manual = 사람이 넣음(동기화가 안 건드림)';

-- 같은 (from,to,종류) 가 살아있는 행으로 중복되지 않게
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_relation_active
  ON handbook.concept_relation (from_concept_id, to_concept_id, relation_type)
  WHERE (revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_concept_relation_from
  ON handbook.concept_relation (from_concept_id) WHERE (revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_concept_relation_to
  ON handbook.concept_relation (to_concept_id) WHERE (revoked_at IS NULL);

COMMIT;

-- ────────────────────────────────────────────────
-- 추가 (2026-08-19): 설명 길이 제한 해제
-- 이유: 온톨로지 설명 305개 중 5개가 1000자 초과(최장 1222자) → 삽입 실패
-- VARCHAR(1000) → TEXT 는 넓히기라 데이터 손실 없음. 실행 시점 행 수 0.
-- ────────────────────────────────────────────────
ALTER TABLE handbook.concept ALTER COLUMN description TYPE TEXT;

-- 추가 (2026-08-19): 개념 페이지가 어느 개념/섹션인지 연결
ALTER TABLE content.concept_page ADD COLUMN IF NOT EXISTS ontology_node VARCHAR(200);
ALTER TABLE content.concept_page ADD COLUMN IF NOT EXISTS section       VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_concept_page_ontology_node
  ON content.concept_page (ontology_node) WHERE (ontology_node IS NOT NULL);

-- 추가 (2026-08-19): 체리 표시용 정리 문장
-- 이유: paragraph_chunk.body_text 는 PDF 추출본이라 쪽번호·하이픈 줄바꿈이 섞임.
--       원문 연결은 유지하되(추적 가능), 화면에는 정리한 문장을 보여준다.
ALTER TABLE handbook.paragraph_concept_link ADD COLUMN IF NOT EXISTS insight TEXT;

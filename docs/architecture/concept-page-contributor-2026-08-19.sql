-- ════════════════════════════════════════════════════════════════
-- 개념 페이지 ↔ 기여자 연결 (2026-08-19)
-- 원본 화면(concept-reader-page.tsx)의 Knowledge Team 카드용.
-- 역할 4종은 원본 3종(Lead reviewer · Evidence sourcing · Concept mapping) + Author.
-- 원칙: 신규 표만 추가. 기존 표 변경 없음.
-- ════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS content.concept_page_contributor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES content.concept_page(id) ON DELETE CASCADE,
  contributor_id  UUID NOT NULL REFERENCES handbook.knowledge_verification_contributor(id),
  role            VARCHAR(40) NOT NULL,
  contributed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  CONSTRAINT ck_cpc_role CHECK (role IN
    ('Author', 'Evidence sourcing', 'Lead reviewer', 'Concept mapping'))
);

COMMENT ON TABLE content.concept_page_contributor IS
  '개념 페이지에 누가 무엇으로 기여했나. 화면 오른쪽 Knowledge Team 카드에 표시.';
COMMENT ON COLUMN content.concept_page_contributor.role IS
  'Author=Overview 작성 · Evidence sourcing=Cherries 수집 · Lead reviewer=검수 · Concept mapping=개념 관계';

-- 같은 사람이 같은 페이지에 같은 역할로 두 번 들어가지 않게
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_active
  ON content.concept_page_contributor (page_id, contributor_id, role)
  WHERE (revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_cpc_page
  ON content.concept_page_contributor (page_id) WHERE (revoked_at IS NULL);

COMMIT;

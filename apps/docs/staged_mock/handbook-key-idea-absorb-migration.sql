-- ============================================================
-- Migration: key_ideas 흡수용 컬럼 추가 (1/2 — 컬럼 준비 단계)
-- ============================================================
-- DBeaver에서 실행할 것 (Supabase, PostgreSQL 17)
--
-- 배경:
--   구 public.key_ideas (3067행) 은 청크당 1줄 요약(core_idea_text)을 담고 있고
--   paragraph_chunk 와 정확히 1:1 (3067 = distinct chunk 3067).
--   v2 handbook 설계는 key_idea 테이블을 폐기(redesign-proposal §5.1: "사용 코드 없음 → 폐기")
--   했으므로, 이 요약 데이터는 별도 테이블 대신 paragraph_chunk 컬럼으로 흡수한다.
--   (v2 가 evidence_metadata 점수들을 paragraph_chunk 로 흡수한 것과 동일 패턴)
--
-- 이 파일의 범위: 흡수 "대상 컬럼"만 추가. 실제 데이터 UPDATE 는 2/2 단계에서 수행.
--   (2/2 는 public.paragraph_chunks → handbook.paragraph_chunk 마이그레이션으로 만들어질
--    bigint→UUID 매핑표가 있어야 가능. 현재 handbook.paragraph_chunk 는 0행이므로 선행 필요.)
--
-- 버리는 것: key_ideas.id / created_at (청크가 이미 보유), idea_group_id (전부 NULL, dead).
-- ============================================================

ALTER TABLE handbook.paragraph_chunk
    ADD COLUMN IF NOT EXISTS core_idea_text TEXT NULL;

COMMENT ON COLUMN handbook.paragraph_chunk.core_idea_text IS
    '청크 한 줄 요약(one-liner). 구 public.key_ideas.core_idea_text 흡수(동일 컬럼명 유지). 청크당 1개(1:1).';

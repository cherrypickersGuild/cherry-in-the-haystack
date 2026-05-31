-- ============================================================
-- Migration: public.* (구 설계) → handbook.* (v2 설계) 데이터 이전
-- ============================================================
-- DBeaver에서 실행할 것 (Supabase, PostgreSQL 17). 전체가 단일 트랜잭션이라
-- 중간 실패 시 자동 롤백된다. 검증 SELECT 결과 확인 후 COMMIT 까지 두고 실행.
--
-- 이전 대상 (데이터 있는 것만): books(5) chapters(81) sections(746)
--                               paragraph_chunks(3067) key_ideas(3067→흡수)
-- 제외: idea_groups/paragraph_embeddings/processing_progress/
--       knowledge_verification_contributors (전부 0행)
--       concept/topic/subtopic/concept_alias/paragraph_concept_link
--         (원본 없음 — 별도 파이프라인이 추후 채움. 사용자 결정: 범위 제외)
--
-- 결정 사항 반영:
--   * ID            : bigint → UUID v7 (public.uuid_generate_v7() 신규, 검증 완료)
--   * source_type   : 5권 전부 .pdf → 'PDF'
--   * section_kind  : 전부 'CORE'
--   * processing_status : 'PENDING' (원본 충실 — 청크는 이미 있으나 상태값 그대로)
--   * key_ideas     : paragraph_chunk.core_idea_text 로 흡수 (1:1, 동일 컬럼명)
--   * 중복 body_text(13행 boilerplate) : 중복 제거(첫 행=최소 id 만 유지)
--                     → 새 스키마 uq(paragraph_hash) 위반 회피, dedup 의도와 일치
--   * paragraph_index : 책 단위 전역 재번호(row_number, 구 id 순)
--                     → 새 스키마 uq(book_id, paragraph_index) 충족.
--                       구 '챕터 내 순번'은 chapter_paragraph_index 에 이미 보존됨.
--
-- 자동 처리(이전 안 함): paragraph_hash(GENERATED), 점수컬럼(judge_*/importance_score
--   등 public 에 없음 → NULL), extract_type(NULL), is_representative(default FALSE).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) 안전장치: 대상이 비어있을 때만 실행 (중복 적재 방지)
-- ------------------------------------------------------------
DO $$
BEGIN
    IF (SELECT count(*) FROM handbook.book) > 0
       OR (SELECT count(*) FROM handbook.paragraph_chunk) > 0 THEN
        RAISE EXCEPTION 'handbook.book/paragraph_chunk 에 이미 데이터가 있습니다. 마이그레이션 중단.';
    END IF;
END $$;

-- ------------------------------------------------------------
-- 1) UUID v7 생성 함수 (검증된 표현식: version=7, variant=8~b, 시간순 정렬)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
    SELECT encode(
        set_bit(
            set_bit(
                overlay(
                    uuid_send(gen_random_uuid())
                    PLACING substring(
                        int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint)
                        FROM 3 FOR 6)
                    FROM 1 FOR 6
                ),
                52, 1),
            53, 1),
        'hex')::uuid;
$$;

-- ------------------------------------------------------------
-- 2) bigint → UUID 매핑 테이블 (old_id 고정 매핑, 스테이트먼트 간 공유)
--    검증/추후 작업(빈 테이블 이전)용으로 보존. 끝의 DROP은 주석 처리.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public._mig_map_book, public._mig_map_chapter,
                     public._mig_map_section, public._mig_map_chunk;

CREATE TABLE public._mig_map_book    (old_id bigint PRIMARY KEY, new_id uuid NOT NULL);
CREATE TABLE public._mig_map_chapter (old_id bigint PRIMARY KEY, new_id uuid NOT NULL);
CREATE TABLE public._mig_map_section (old_id bigint PRIMARY KEY, new_id uuid NOT NULL);
CREATE TABLE public._mig_map_chunk   (old_id bigint PRIMARY KEY, new_id uuid NOT NULL);

INSERT INTO public._mig_map_book (old_id, new_id)
SELECT id, public.uuid_generate_v7() FROM public.books;

INSERT INTO public._mig_map_chapter (old_id, new_id)
SELECT id, public.uuid_generate_v7() FROM public.chapters;

INSERT INTO public._mig_map_section (old_id, new_id)
SELECT id, public.uuid_generate_v7() FROM public.sections;

-- 청크 매핑은 dedup 후 '유지되는 행'(중복 body_text 그룹의 최소 id)만 대상
INSERT INTO public._mig_map_chunk (old_id, new_id)
SELECT id, public.uuid_generate_v7()
FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY md5(body_text) ORDER BY id) AS rn
    FROM public.paragraph_chunks
) d
WHERE d.rn = 1;

-- ------------------------------------------------------------
-- 3) 적재 (FK 순서: book → chapter → section → paragraph_chunk)
-- ------------------------------------------------------------

-- 3-1) book
INSERT INTO handbook.book
    (id, title, author, section_kind, source_type, source_path, source_url,
     processing_status, total_paragraphs, paragraphs_processed,
     llm_tokens_used, llm_cost_cents, meta_json, created_at, updated_at)
SELECT
    mb.new_id,
    b.title,
    b.author,
    'CORE'::handbook.section_kind_enum,
    'PDF'::handbook.book_source_type_enum,
    b.source_path,
    NULL,
    'PENDING'::handbook.book_processing_status_enum,
    b.total_paragraphs,
    coalesce(b.paragraphs_processed, 0),
    coalesce(b.llm_tokens_used, 0),
    coalesce(b.llm_cost_cents, 0),
    NULL,
    coalesce(b.created_at, CURRENT_TIMESTAMP),
    coalesce(b.created_at, CURRENT_TIMESTAMP)
FROM public.books b
JOIN public._mig_map_book mb ON mb.old_id = b.id;

-- 3-2) chapter  (parent_chapter_id 는 같은 매핑표로 self-resolve)
INSERT INTO handbook.chapter
    (id, book_id, chapter_number, title, start_page, end_page, level,
     parent_chapter_id, detection_method, created_at, updated_at)
SELECT
    mc.new_id,
    mb.new_id,
    c.chapter_number,
    c.title,
    c.start_page,
    c.end_page,
    coalesce(c.level, 1),
    mcp.new_id,                       -- parent (nullable)
    c.detection_method,
    coalesce(c.created_at, CURRENT_TIMESTAMP),
    coalesce(c.created_at, CURRENT_TIMESTAMP)
FROM public.chapters c
JOIN public._mig_map_chapter mc ON mc.old_id = c.id
JOIN public._mig_map_book    mb ON mb.old_id = c.book_id
LEFT JOIN public._mig_map_chapter mcp ON mcp.old_id = c.parent_chapter_id;

-- 3-3) section
INSERT INTO handbook.section
    (id, book_id, chapter_id, section_number, title, level,
     parent_section_id, detection_method, created_at, updated_at)
SELECT
    ms.new_id,
    mb.new_id,
    mc.new_id,                        -- chapter_id (NOT NULL, 원본도 NOT NULL)
    s.section_number,
    s.title,
    coalesce(s.level, 1),
    msp.new_id,                       -- parent (nullable)
    coalesce(s.detection_method, 'llm'),
    coalesce(s.created_at, CURRENT_TIMESTAMP),
    coalesce(s.created_at, CURRENT_TIMESTAMP)
FROM public.sections s
JOIN public._mig_map_section ms ON ms.old_id = s.id
JOIN public._mig_map_book    mb ON mb.old_id = s.book_id
JOIN public._mig_map_chapter mc ON mc.old_id = s.chapter_id
LEFT JOIN public._mig_map_section msp ON msp.old_id = s.parent_section_id;

-- 3-4) paragraph_chunk
--   - dedup: _mig_map_chunk 에 있는 행(유지분)만 조인되어 자동 필터
--   - paragraph_index: 책 단위 전역 재번호 (구 id 순)
--   - core_idea_text: key_ideas 1:1 흡수
--   - paragraph_hash 는 GENERATED 라 컬럼 목록에서 제외(자동 계산)
INSERT INTO handbook.paragraph_chunk
    (id, book_id, chapter_id, section_id, page_number, paragraph_index,
     chapter_paragraph_index, body_text, core_idea_text, simhash64,
     created_at, updated_at)
SELECT
    mpc.new_id,
    mb.new_id,
    mch.new_id,                       -- chapter_id (nullable)
    msec.new_id,                      -- section_id (nullable)
    pc.page_number,
    ROW_NUMBER() OVER (PARTITION BY pc.book_id ORDER BY pc.id),  -- 전역 재번호
    pc.chapter_paragraph_index,
    pc.body_text,
    ki.core_idea_text,                -- 흡수 (없으면 NULL)
    pc.simhash64,
    coalesce(pc.created_at, CURRENT_TIMESTAMP),
    coalesce(pc.created_at, CURRENT_TIMESTAMP)
FROM public.paragraph_chunks pc
JOIN public._mig_map_chunk   mpc ON mpc.old_id = pc.id        -- 유지분만 (dedup)
JOIN public._mig_map_book    mb  ON mb.old_id  = pc.book_id
LEFT JOIN public._mig_map_chapter mch  ON mch.old_id  = pc.chapter_id
LEFT JOIN public._mig_map_section msec ON msec.old_id = pc.section_id
LEFT JOIN public.key_ideas        ki   ON ki.chunk_id = pc.id;

-- ------------------------------------------------------------
-- 4) 검증 (예상치와 비교 후 COMMIT 판단)
-- ------------------------------------------------------------
--   기대: book 5 / chapter 81 / section 746 / paragraph_chunk 3054 (=3067-13 dedup)
--         core_idea_text 채워진 청크 ≈ 유지된 key_ideas 수
SELECT 'book'            AS tbl, count(*) AS rows, 5    AS expected FROM handbook.book
UNION ALL SELECT 'chapter',          count(*), 81   FROM handbook.chapter
UNION ALL SELECT 'section',          count(*), 746  FROM handbook.section
UNION ALL SELECT 'paragraph_chunk',  count(*), 3054 FROM handbook.paragraph_chunk
UNION ALL SELECT 'chunk core_idea_filled', count(*) FILTER (WHERE core_idea_text IS NOT NULL), NULL
          FROM handbook.paragraph_chunk;

-- 이상 없으면 COMMIT, 문제 있으면 ROLLBACK 하세요.
COMMIT;

-- ============================================================
-- 사후 정리 (검증 끝나고 수동 실행 권장 — 매핑표/함수 보존이 추후 작업에 유용)
-- ============================================================
-- DROP TABLE IF EXISTS public._mig_map_book, public._mig_map_chapter,
--                      public._mig_map_section, public._mig_map_chunk;
-- DROP FUNCTION IF EXISTS public.uuid_generate_v7();

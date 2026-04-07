-- ============================================================
-- Cherry Platform — Rollback seed-mock-data.sql
-- 삽입 역순으로 삭제 (FK 의존성 준수)
-- ============================================================

BEGIN;

-- 8. user_article_ai_state (id: 0195f300-c*)
DELETE FROM content.user_article_ai_state
WHERE id::TEXT LIKE '0195f300-a%'
   OR id::TEXT LIKE '0195f300-c%';

-- 7. user_article_state (id: 0195f300-b*)
DELETE FROM content.user_article_state
WHERE id::TEXT LIKE '0195f300-b%';

-- 6. article_raw (representative_key = seed-*)
DELETE FROM content.article_raw
WHERE representative_key LIKE 'seed-%';

-- 5. side_category
DELETE FROM content.side_category
WHERE id IN (
    '0195f300-4001-7000-a100-000000000001',
    '0195f300-4001-7000-a100-000000000002'
);

-- 4. tracked_entity_placement
DELETE FROM content.tracked_entity_placement
WHERE id::TEXT LIKE '0195f300-3001%';

-- 3. entity_category
DELETE FROM content.entity_category
WHERE id::TEXT LIKE '0195f300-2001%';

-- 2. tracked_entity
DELETE FROM content.tracked_entity
WHERE id::TEXT LIKE '0195f300-1001%';

-- 1. source
DELETE FROM content.source
WHERE id::TEXT LIKE '0195f300-0001%';

COMMIT;

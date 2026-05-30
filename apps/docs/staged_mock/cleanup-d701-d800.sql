-- ============================================================
-- Cleanup d701-d800 article_raw and all dependent rows
-- Run BEFORE re-inserting stage-1-extra-100-apr16-18.sql
--
-- FK dependency chain (must delete in order):
--   1. user_article_ai_state  (→ user_article_state)
--   2. user_article_state     (→ article_raw)
--   3. curated_article        (→ article_raw) [if any]
--   4. article_raw
--
-- Range: 0195f300-d701-7000-8000-* ~ 0195f300-d800-7000-8000-*
-- (d700 and earlier are preserved)
-- ============================================================

BEGIN;

-- 1. user_article_ai_state
DELETE FROM content.user_article_ai_state
WHERE user_article_state_id IN (
  SELECT uas.id
  FROM content.user_article_state uas
  WHERE uas.article_raw_id >= '0195f300-d701-7000-8000-000000000000'::UUID
    AND uas.article_raw_id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID
);

-- 2. user_article_state
DELETE FROM content.user_article_state
WHERE article_raw_id >= '0195f300-d701-7000-8000-000000000000'::UUID
  AND article_raw_id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID;

-- 3. curated_article (hard delete to remove FK)
DELETE FROM content.curated_article
WHERE article_raw_id >= '0195f300-d701-7000-8000-000000000000'::UUID
  AND article_raw_id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID;

-- 4. article_raw
DELETE FROM content.article_raw
WHERE id >= '0195f300-d701-7000-8000-000000000000'::UUID
  AND id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID;

COMMIT;

-- Verify (should return 0)
SELECT 'article_raw'  AS table_name, COUNT(*) AS cnt FROM content.article_raw
  WHERE id >= '0195f300-d701-7000-8000-000000000000'::UUID
    AND id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID
UNION ALL
SELECT 'user_article_state', COUNT(*) FROM content.user_article_state
  WHERE article_raw_id >= '0195f300-d701-7000-8000-000000000000'::UUID
    AND article_raw_id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID
UNION ALL
SELECT 'user_article_ai_state', COUNT(*)
  FROM content.user_article_ai_state aai
  JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
  WHERE uas.article_raw_id >= '0195f300-d701-7000-8000-000000000000'::UUID
    AND uas.article_raw_id <= '0195f300-d800-7000-8000-ffffffffffff'::UUID;

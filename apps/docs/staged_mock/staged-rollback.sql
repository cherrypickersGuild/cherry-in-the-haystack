-- ============================================================
-- Staged Rollback — Delete all staged mock data in reverse FK order
-- Cherry Platform Staged Mock Data
-- Safe to run multiple times (idempotent)
-- Uses ID patterns and representative_key LIKE 'seed-%' for targeting
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Snapshot tables (no FK dependencies on content tables)
-- ============================================================

-- entity_stat (uses tracked_entity FK but we delete by ID pattern)
DELETE FROM snapshot.entity_stat
WHERE id::TEXT LIKE '0195f300-d08%';

-- keyword_daily_stat (no FK)
DELETE FROM snapshot.keyword_daily_stat
WHERE id::TEXT LIKE '0195f300-d07%';

-- user_entity_weekly_stat
DELETE FROM snapshot.user_entity_weekly_stat
WHERE id = '0195f300-d060-7000-8000-000000000001';

-- user_entity_daily_stat
DELETE FROM snapshot.user_entity_daily_stat
WHERE id::TEXT LIKE '0195f300-d05%';

-- user_daily_stat
DELETE FROM snapshot.user_daily_stat
WHERE id::TEXT LIKE '0195f300-d04%';

-- user_weekly_stat
DELETE FROM snapshot.user_weekly_stat
WHERE id = '0195f300-d030-7000-8000-000000000001';

-- user_entity_page_weekly_list
DELETE FROM snapshot.user_entity_page_weekly_list
WHERE id::TEXT LIKE '0195f300-d020%';

-- entity_page_weekly_list
DELETE FROM snapshot.entity_page_weekly_list
WHERE id::TEXT LIKE '0195f300-d010%';

-- platform_weekly_stat
DELETE FROM snapshot.platform_weekly_stat
WHERE id = '0195f300-d001-7000-8000-000000000001';

-- user_read_position (defensive — may not have seed data)
DELETE FROM snapshot.user_read_position
WHERE user_id = (SELECT id FROM core.app_user WHERE is_active = TRUE AND revoked_at IS NULL LIMIT 1);

-- ============================================================
-- 2. Content tables (reverse FK order)
-- ============================================================

-- user_article_ai_state (FK -> user_article_state)
-- ID pattern: 0195f300-c{seq:03d}-7000-8000-000000000001
DELETE FROM content.user_article_ai_state
WHERE id::TEXT LIKE '0195f300-c___-7000-8000-000000000001';

-- user_article_state (FK -> article_raw, tracked_entity, side_category)
-- ID pattern: 0195f300-b{seq:03d}-7000-8000-000000000001
DELETE FROM content.user_article_state
WHERE id::TEXT LIKE '0195f300-b___-7000-8000-000000000001';

-- article_raw (FK -> source)
-- ID pattern: 0195f300-a{seq:03d}-7000-8000-000000000001
DELETE FROM content.article_raw
WHERE representative_key LIKE 'seed-%';

-- ============================================================
-- 3. Reference data (reverse FK order)
-- ============================================================

-- tracked_entity_placement (FK -> tracked_entity, entity_category)
DELETE FROM content.tracked_entity_placement
WHERE id::TEXT LIKE '0195f300-3001-7000-b000-%';

-- side_category
DELETE FROM content.side_category
WHERE id IN (
    '0195f300-4001-7000-a100-000000000001',
    '0195f300-4001-7000-a100-000000000002'
);

-- entity_category
DELETE FROM content.entity_category
WHERE id::TEXT LIKE '0195f300-2001-7000-a000-%';

-- tracked_entity (FK target for placement, user_article_state)
DELETE FROM content.tracked_entity
WHERE id::TEXT LIKE '0195f300-1001-7000-b000-%';

-- source (FK target for article_raw)
DELETE FROM content.source
WHERE id::TEXT LIKE '0195f300-0001-7000-a000-%';

COMMIT;

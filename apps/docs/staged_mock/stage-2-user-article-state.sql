-- ============================================================
-- Stage 2 — user_article_state INSERT (Backend Simulation)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stage 0 + Stage 1 applied
-- Creates 100 bare-bones user_article_state rows
-- representative_entity_id = NULL (Worker sets this in Stage 5)
-- impact_score = 0, is_high_impact = FALSE (defaults)
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user_id UUID := current_setting('cherry.seed_user_id')::UUID;
    v_uas_id  UUID;
    v_art_id  UUID;
    v_pub_at  TIMESTAMPTZ;
    seq       INT;
BEGIN

FOR seq IN 1..100 LOOP
    v_art_id := ('0195f300-a' || lpad(seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_uas_id := ('0195f300-b' || lpad(seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;

    -- Look up published_at from the article_raw row
    SELECT published_at INTO v_pub_at
    FROM content.article_raw
    WHERE id = v_art_id;

    INSERT INTO content.user_article_state (
        id, user_id, article_raw_id, discovered_at,
        representative_entity_id, side_category_id,
        impact_score, is_high_impact
    ) VALUES (
        v_uas_id,
        v_user_id,
        v_art_id,
        v_pub_at + INTERVAL '1 hour',
        NULL,   -- Worker sets in Stage 5
        NULL,   -- Worker sets in Stage 5
        0,      -- DEFAULT; Worker calculates in Stage 5
        FALSE   -- DEFAULT; Worker calculates in Stage 5
    );

END LOOP;

RAISE NOTICE 'Stage 2: Inserted 100 user_article_state rows for user %', v_user_id;
END $$;

COMMIT;

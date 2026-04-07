-- ============================================================
-- Stage 3 — user_article_ai_state PENDING INSERT (Backend Simulation)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stage 0 + Stage 1 + Stage 2 applied
-- Creates 100 PENDING ai_state rows with all AI columns NULL
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user_id UUID := current_setting('cherry.seed_user_id')::UUID;
    v_aai_id  UUID;
    v_uas_id  UUID;
    seq       INT;
BEGIN

FOR seq IN 1..100 LOOP
    v_uas_id := ('0195f300-b' || lpad(seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_aai_id := ('0195f300-c' || lpad(seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;

    INSERT INTO content.user_article_ai_state (
        id, user_id, user_article_state_id,
        ai_status
        -- All other columns remain NULL:
        -- representative_entity_id, representative_entity_page,
        -- representative_entity_category_id, representative_entity_category_name,
        -- representative_entity_name,
        -- ai_summary, ai_score,
        -- ai_classification_json, ai_tags_json, ai_snippets_json,
        -- ai_evidence_json, ai_structured_extraction_json,
        -- agent_json_raw, ai_model_name, ai_processed_at
    ) VALUES (
        v_aai_id,
        v_user_id,
        v_uas_id,
        'PENDING'
    );

END LOOP;

RAISE NOTICE 'Stage 3: Inserted 100 PENDING user_article_ai_state rows for user %', v_user_id;
END $$;

COMMIT;

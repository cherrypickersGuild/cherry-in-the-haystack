-- ============================================================
-- Stage 5 — Worker Parse & Project (Worker Simulation)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stage 0 + Stage 1 + Stage 2 + Stage 3 + Stage 4 applied
--
-- Part A: Parse agent_json_raw → project into canonical columns
--         via JOINs to tracked_entity/placement/category.
--         Sets ai_status = 'SUCCESS'.
-- Part B: Update user_article_state with representative_entity_id,
--         side_category_id, impact_score, is_high_impact from ai_state.
-- ============================================================

BEGIN;

-- ============================================================
-- Part A: user_article_ai_state UPDATE — parse agent_json_raw
-- ============================================================
-- Uses JOINs to resolve canonical entity/category names from the
-- tracked_entity and entity_category tables, ensuring the trigger
-- validate_user_article_ai_state_representative_name() passes.
UPDATE content.user_article_ai_state aai
SET
    representative_entity_id            = te.id,
    representative_entity_page          = tep.entity_page,
    representative_entity_category_id   = tep.entity_category_id,
    representative_entity_category_name = ec.name,
    representative_entity_name          = te.name,
    ai_summary                          = aai.agent_json_raw->>'ai_summary',
    ai_score                            = (aai.agent_json_raw->>'ai_score')::SMALLINT,
    ai_classification_json              = aai.agent_json_raw->'ai_classification_json',
    ai_tags_json                        = aai.agent_json_raw->'ai_tags_json',
    ai_snippets_json                    = aai.agent_json_raw->'ai_snippets_json',
    ai_evidence_json                    = aai.agent_json_raw->'ai_evidence_json',
    ai_structured_extraction_json       = aai.agent_json_raw->'ai_structured_extraction_json',
    ai_status                           = 'SUCCESS'
FROM content.tracked_entity te
JOIN content.tracked_entity_placement tep
    ON  tep.tracked_entity_id = te.id
    AND tep.entity_page = (aai.agent_json_raw->'representative_entity'->>'page')::content.entity_page_enum
    AND tep.revoked_at IS NULL
    AND tep.is_active = TRUE
JOIN content.entity_category ec
    ON  ec.id = tep.entity_category_id
WHERE te.id = (aai.agent_json_raw->'representative_entity'->>'id')::UUID
  AND aai.ai_status = 'PENDING'
  AND aai.agent_json_raw IS NOT NULL;

-- ============================================================
-- Part B: user_article_state UPDATE — project from ai_state
-- ============================================================
-- Sets representative_entity_id, side_category_id, impact_score,
-- is_high_impact based on successfully parsed ai_state rows.
UPDATE content.user_article_state uas
SET
    representative_entity_id = aai.representative_entity_id,
    side_category_id = CASE
        WHEN aai.ai_structured_extraction_json->'review'->>'type' = 'Case Study'
            THEN (SELECT id FROM content.side_category WHERE code = 'CASE_STUDY' AND revoked_at IS NULL LIMIT 1)
        WHEN aai.ai_structured_extraction_json->'review'->>'type' = 'Applied Research'
            THEN (SELECT id FROM content.side_category WHERE code = 'APPLIED_RESEARCH' AND revoked_at IS NULL LIMIT 1)
        ELSE NULL
    END,
    impact_score = CASE
        WHEN aai.ai_score = 5 THEN 80 + random() * 15
        WHEN aai.ai_score = 4 THEN 60 + random() * 20
        WHEN aai.ai_score = 3 THEN 40 + random() * 20
        ELSE 20 + random() * 20
    END,
    is_high_impact = (aai.ai_score >= 4)
FROM content.user_article_ai_state aai
WHERE uas.id = aai.user_article_state_id
  AND aai.ai_status = 'SUCCESS';

COMMIT;

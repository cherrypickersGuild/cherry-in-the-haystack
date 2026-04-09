-- ============================================================
-- ROLLBACK: APPLIED_RESEARCH → CASE_STUDY (10건)
-- patch-side-category-to-applied-research.sql 의 롤백
-- ============================================================

UPDATE content.user_article_state
SET side_category_id = '0195f300-4001-7000-a100-000000000001'  -- CASE_STUDY
WHERE id IN (
  SELECT uas.id
  FROM content.user_article_state uas
  JOIN content.user_article_ai_state aai
    ON aai.user_article_state_id = uas.id
   AND aai.ai_status = 'SUCCESS'
   AND aai.representative_entity_page = 'CASE_STUDIES'
  WHERE uas.side_category_id = '0195f300-4001-7000-a100-000000000002'  -- APPLIED_RESEARCH
  ORDER BY uas.id
  LIMIT 10
);

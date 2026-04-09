-- ============================================================
-- PATCH: CASE_STUDY → APPLIED_RESEARCH (10건)
-- 대상: content.user_article_state 중 CASE_STUDIES 페이지 기사
--       side_category_id = CASE_STUDY 인 것 10건을 APPLIED_RESEARCH 로 변경
-- 롤백: rollback-side-category-applied-research.sql
-- ============================================================

UPDATE content.user_article_state
SET side_category_id = '0195f300-4001-7000-a100-000000000002'  -- APPLIED_RESEARCH
WHERE id IN (
  SELECT uas.id
  FROM content.user_article_state uas
  JOIN content.user_article_ai_state aai
    ON aai.user_article_state_id = uas.id
   AND aai.ai_status = 'SUCCESS'
   AND aai.representative_entity_page = 'CASE_STUDIES'
  WHERE uas.side_category_id = '0195f300-4001-7000-a100-000000000001'  -- CASE_STUDY
  ORDER BY uas.id
  LIMIT 10
);

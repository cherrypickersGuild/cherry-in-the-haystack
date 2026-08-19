-- 되돌리기 (concept-relation-migration-2026-08-19.sql 취소)
-- ⚠️ 이관 데이터가 들어간 뒤에는 표 삭제 전에 데이터 확인 필수
BEGIN;
DROP TABLE IF EXISTS handbook.concept_relation;
DROP TYPE  IF EXISTS handbook.concept_relation_enum;
ALTER TABLE handbook.concept       DROP COLUMN IF EXISTS ontology_node;
ALTER TABLE content.concept_page   DROP COLUMN IF EXISTS surface;
COMMIT;

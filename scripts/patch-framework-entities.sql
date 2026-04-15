-- ============================================================
-- Patch: Framework entities correction
-- 1. MCP Protocol → FRAMEWORKS:Agent 배치 제거
-- 2. 누락된 8개 엔터티 추가 + placement
-- ============================================================

BEGIN;

-- ============================================================
-- 1. MCP Protocol → FRAMEWORKS:Agent placement 제거
-- ============================================================
DELETE FROM content.tracked_entity_placement
WHERE id = '0195f300-3001-7000-b000-000000000082';

-- ============================================================
-- 2. 누락 엔터티 8개 추가
-- ============================================================
INSERT INTO content.tracked_entity (id, name, description, is_active, is_featured) VALUES
('0195f300-1001-7000-b000-000000000063', 'Axolotl',      'Flexible fine-tuning library',            TRUE, TRUE),
('0195f300-1001-7000-b000-000000000064', 'Guidance',     'LLM prompt control framework',            TRUE, TRUE),
('0195f300-1001-7000-b000-000000000065', 'TensorRT-LLM', 'NVIDIA LLM inference optimization',       TRUE, TRUE),
('0195f300-1001-7000-b000-000000000066', 'Weaviate',     'AI-native vector search engine',          TRUE, TRUE),
('0195f300-1001-7000-b000-000000000067', 'W&B',          'Weights & Biases ML experiment tracking', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000068', 'LangSmith',    'LLM ops and evaluation platform',         TRUE, TRUE),
('0195f300-1001-7000-b000-000000000069', 'Phoenix',      'AI observability by Arize',               TRUE, TRUE),
('0195f300-1001-7000-b000-00000000006a', 'TruLens',      'LLM evaluation and tracing',              TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Placement 추가 (없을 때만)
-- ============================================================
INSERT INTO content.tracked_entity_placement (id, tracked_entity_id, entity_page, entity_category_id)
SELECT id, tracked_entity_id, entity_page::content.entity_page_enum, entity_category_id FROM (VALUES
    ('0195f300-3001-7000-b000-00000000008d'::UUID, '0195f300-1001-7000-b000-000000000063'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011'::UUID), -- Axolotl → Fine-Tuning
    ('0195f300-3001-7000-b000-00000000008e'::UUID, '0195f300-1001-7000-b000-000000000064'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013'::UUID), -- Guidance → Prompt Eng
    ('0195f300-3001-7000-b000-00000000008f'::UUID, '0195f300-1001-7000-b000-000000000065'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014'::UUID), -- TensorRT-LLM → Serving
    ('0195f300-3001-7000-b000-000000000090'::UUID, '0195f300-1001-7000-b000-000000000066'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015'::UUID), -- Weaviate → Data/Storage
    ('0195f300-3001-7000-b000-000000000091'::UUID, '0195f300-1001-7000-b000-000000000067'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016'::UUID), -- W&B → LLMOps
    ('0195f300-3001-7000-b000-000000000092'::UUID, '0195f300-1001-7000-b000-000000000068'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016'::UUID), -- LangSmith → LLMOps
    ('0195f300-3001-7000-b000-000000000093'::UUID, '0195f300-1001-7000-b000-000000000069'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017'::UUID), -- Phoenix → Observability
    ('0195f300-3001-7000-b000-000000000094'::UUID, '0195f300-1001-7000-b000-00000000006a'::UUID, 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017'::UUID)  -- TruLens → Observability
) AS v(id, tracked_entity_id, entity_page, entity_category_id)
WHERE NOT EXISTS (
    SELECT 1 FROM content.tracked_entity_placement p
    WHERE p.tracked_entity_id = v.tracked_entity_id
      AND p.entity_page = v.entity_page::content.entity_page_enum
      AND p.revoked_at IS NULL
);

COMMIT;

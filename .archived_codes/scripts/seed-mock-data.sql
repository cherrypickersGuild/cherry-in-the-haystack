-- ============================================================
-- Cherry Platform — Mock Seed Data (100 articles)
-- 실행 전: 대상 DB에 DDL(v1.1)이 적용되어 있어야 함
-- 실행 시: psql -h <host> -U <user> -d cherry -f seed-mock-data.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 0. 유저 ID placeholder (실행 전 실제 유저 ID로 교체)
--    SELECT id FROM core.app_user LIMIT 1;
-- ============================================================
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM core.app_user WHERE is_active = TRUE AND revoked_at IS NULL LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No active user found. Please create a user first.';
    END IF;
    PERFORM set_config('cherry.seed_user_id', v_user_id::TEXT, TRUE);
END $$;

-- ============================================================
-- 1. SOURCES (10개)
-- ============================================================
INSERT INTO content.source (id, type, name, url_handle, frequency, language, country_code) VALUES
('0195f300-0001-7000-a000-000000000001', 'RSS',     'OpenAI Blog',        'https://openai.com/blog/rss',           'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000002', 'RSS',     'Anthropic Blog',     'https://anthropic.com/blog/rss',        'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000003', 'RSS',     'Google AI Blog',     'https://ai.googleblog.com/feeds/posts', 'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000004', 'RSS',     'arXiv CS.AI',        'https://arxiv.org/rss/cs.AI',           'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000005', 'WEBSITE', 'TechCrunch AI',      'https://techcrunch.com/category/ai',    'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000006', 'RSS',     'Hugging Face Blog',  'https://huggingface.co/blog/feed.xml',  'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000007', 'RSS',     'The Verge AI',       'https://theverge.com/ai/rss',           'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000008', 'RSS',     'Meta AI Blog',       'https://ai.meta.com/blog/rss',          'DAILY', 'en', 'US'),
('0195f300-0001-7000-a000-000000000009', 'RSS',     'DeepMind Blog',      'https://deepmind.google/blog/rss',      'DAILY', 'en', 'GB'),
('0195f300-0001-7000-a000-00000000000a', 'RSS',     'AI Korea News',      'https://aikorea.kr/rss',                'DAILY', 'ko', 'KR');

-- ============================================================
-- 2. TRACKED ENTITIES (40개)
-- ============================================================
INSERT INTO content.tracked_entity (id, name, description, is_active, is_featured) VALUES
-- Models (7)
('0195f300-1001-7000-b000-000000000001', 'GPT-5.4',            'OpenAI latest flagship model',            TRUE, TRUE),
('0195f300-1001-7000-b000-000000000002', 'Claude 3.7 Sonnet',  'Anthropic mid-tier reasoning model',      TRUE, TRUE),
('0195f300-1001-7000-b000-000000000003', 'Gemini 2.0 Flash',   'Google fast multimodal model',            TRUE, TRUE),
('0195f300-1001-7000-b000-000000000004', 'Grok-3',             'xAI conversational model',                TRUE, TRUE),
('0195f300-1001-7000-b000-000000000005', 'LLaMA 4',            'Meta open-weight large language model',   TRUE, TRUE),
('0195f300-1001-7000-b000-000000000006', 'DeepSeek-R1',        'DeepSeek reasoning-first model',          TRUE, TRUE),
('0195f300-1001-7000-b000-000000000007', 'Mistral Large 2',    'Mistral AI flagship model',               TRUE, TRUE),
-- Frameworks (16)
('0195f300-1001-7000-b000-000000000010', 'LangChain',    'LLM application framework',       TRUE, TRUE),
('0195f300-1001-7000-b000-000000000011', 'LangGraph',    'Stateful agent orchestration',    TRUE, TRUE),
('0195f300-1001-7000-b000-000000000012', 'CrewAI',       'Multi-agent framework',           TRUE, TRUE),
('0195f300-1001-7000-b000-000000000013', 'AutoGPT',      'Autonomous agent framework',      TRUE, TRUE),
('0195f300-1001-7000-b000-000000000014', 'DSPy',         'Programmatic prompt optimization', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000015', 'Unsloth',      'Fast fine-tuning library',        TRUE, TRUE),
('0195f300-1001-7000-b000-000000000016', 'LLaMA-Factory','Unified fine-tuning toolkit',     TRUE, TRUE),
('0195f300-1001-7000-b000-000000000017', 'vLLM',         'High-throughput LLM serving',     TRUE, TRUE),
('0195f300-1001-7000-b000-000000000018', 'Ollama',       'Local LLM runner',                TRUE, TRUE),
('0195f300-1001-7000-b000-000000000019', 'LlamaIndex',   'Data framework for LLM apps',     TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001a', 'ChromaDB',     'AI-native vector database',       TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001b', 'Langfuse',     'LLM observability platform',      TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001c', 'RAGFlow',      'RAG orchestration engine',        TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001d', 'Haystack',     'NLP framework by deepset',        TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001e', 'MLflow',       'ML lifecycle management',         TRUE, TRUE),
('0195f300-1001-7000-b000-00000000001f', 'RAGAS',        'RAG evaluation framework',        TRUE, TRUE),
-- Tools (4)
('0195f300-1001-7000-b000-000000000020', 'Cursor',       'AI-native code editor',           TRUE, TRUE),
('0195f300-1001-7000-b000-000000000021', 'GitHub Copilot','AI pair programmer',             TRUE, TRUE),
('0195f300-1001-7000-b000-000000000022', 'Claude Code',  'Anthropic CLI coding agent',      TRUE, TRUE),
('0195f300-1001-7000-b000-000000000023', 'Docker AI',    'AI-powered container tooling',    TRUE, TRUE),
-- Shared resources (3)
('0195f300-1001-7000-b000-000000000030', 'HuggingFace',       'ML model hub and community',    TRUE, TRUE),
('0195f300-1001-7000-b000-000000000031', 'Papers with Code',  'ML papers with implementations', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000032', 'Awesome LLM',       'Curated LLM resource list',     TRUE, TRUE),
-- Case study entities (4)
('0195f300-1001-7000-b000-000000000040', 'Netomi AI Support', 'AI customer support platform',  TRUE, TRUE),
('0195f300-1001-7000-b000-000000000041', 'AutoBNN',           'Google automatic BNN framework', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000042', 'MedPaLM',           'Google medical AI model',       TRUE, TRUE),
('0195f300-1001-7000-b000-000000000043', 'Copilot Workspace', 'GitHub AI dev environment',     TRUE, TRUE),
-- Paper/Benchmark (3)
('0195f300-1001-7000-b000-000000000050', 'MMLU-Pro',          'Massive multitask benchmark v2', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000051', 'SWE-bench',         'Software engineering benchmark', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000052', 'GPQA Diamond',      'Graduate-level QA benchmark',   TRUE, TRUE),
-- Big tech / Regulations (3)
('0195f300-1001-7000-b000-000000000060', 'EU AI Act',         'European AI regulation',        TRUE, TRUE),
('0195f300-1001-7000-b000-000000000061', 'NIST AI RMF',       'US AI risk management framework', TRUE, TRUE),
('0195f300-1001-7000-b000-000000000062', 'MCP Protocol',      'Model Context Protocol by Anthropic', TRUE, TRUE);

-- ============================================================
-- 3. ENTITY CATEGORIES (25개, 9 pages에 분산)
-- ============================================================
INSERT INTO content.entity_category (id, entity_page, code, name, sort_order) VALUES
-- MODEL_UPDATES (7 categories)
('0195f300-2001-7000-a000-000000000001', 'MODEL_UPDATES', 'openai',    'OpenAI Family',    1),
('0195f300-2001-7000-a000-000000000002', 'MODEL_UPDATES', 'anthropic', 'Anthropic Family',  2),
('0195f300-2001-7000-a000-000000000003', 'MODEL_UPDATES', 'google',    'Google Family',     3),
('0195f300-2001-7000-a000-000000000004', 'MODEL_UPDATES', 'xai',       'xAI Family',        4),
('0195f300-2001-7000-a000-000000000005', 'MODEL_UPDATES', 'meta',      'Meta Family',       5),
('0195f300-2001-7000-a000-000000000006', 'MODEL_UPDATES', 'deepseek',  'DeepSeek Family',   6),
('0195f300-2001-7000-a000-000000000007', 'MODEL_UPDATES', 'mistral',   'Mistral Family',    7),
-- FRAMEWORKS (8 categories)
('0195f300-2001-7000-a000-000000000010', 'FRAMEWORKS', 'agent',        'Agent',             1),
('0195f300-2001-7000-a000-000000000011', 'FRAMEWORKS', 'fine-tuning',  'Fine-Tuning',       2),
('0195f300-2001-7000-a000-000000000012', 'FRAMEWORKS', 'rag',          'RAG',               3),
('0195f300-2001-7000-a000-000000000013', 'FRAMEWORKS', 'prompt-eng',   'Prompt Engineering', 4),
('0195f300-2001-7000-a000-000000000014', 'FRAMEWORKS', 'serving',      'Serving',            5),
('0195f300-2001-7000-a000-000000000015', 'FRAMEWORKS', 'data-storage', 'Data & Storage',     6),
('0195f300-2001-7000-a000-000000000016', 'FRAMEWORKS', 'llmops',       'LLMOps',             7),
('0195f300-2001-7000-a000-000000000017', 'FRAMEWORKS', 'observability','Observability',      8),
-- CASE_STUDIES (4 categories)
('0195f300-2001-7000-a000-000000000020', 'CASE_STUDIES', 'cs-openai',    'OpenAI',     1),
('0195f300-2001-7000-a000-000000000021', 'CASE_STUDIES', 'cs-google',    'Google',     2),
('0195f300-2001-7000-a000-000000000022', 'CASE_STUDIES', 'cs-anthropic', 'Anthropic',  3),
('0195f300-2001-7000-a000-000000000023', 'CASE_STUDIES', 'cs-microsoft', 'Microsoft',  4),
-- PAPER_BENCHMARK (3 categories)
('0195f300-2001-7000-a000-000000000030', 'PAPER_BENCHMARK', 'nlp',        'NLP',        1),
('0195f300-2001-7000-a000-000000000031', 'PAPER_BENCHMARK', 'multimodal', 'Multimodal', 2),
('0195f300-2001-7000-a000-000000000032', 'PAPER_BENCHMARK', 'coding',     'Coding',     3),
-- TOOLS (2 categories)
('0195f300-2001-7000-a000-000000000040', 'TOOLS', 'ide-plugin', 'IDE & Plugin', 1),
('0195f300-2001-7000-a000-000000000041', 'TOOLS', 'infra',      'Infrastructure', 2),
-- SHARED_RESOURCES (2)
('0195f300-2001-7000-a000-000000000050', 'SHARED_RESOURCES', 'hub',      'Model Hub',   1),
('0195f300-2001-7000-a000-000000000051', 'SHARED_RESOURCES', 'tutorial', 'Tutorial',    2),
-- REGULATIONS (2)
('0195f300-2001-7000-a000-000000000060', 'REGULATIONS', 'intl', 'International', 1),
('0195f300-2001-7000-a000-000000000061', 'REGULATIONS', 'kr',   'Korea',         2),
-- BIG_TECH_TRENDS (2)
('0195f300-2001-7000-a000-000000000070', 'BIG_TECH_TRENDS', 'faang',   'FAANG',   1),
('0195f300-2001-7000-a000-000000000071', 'BIG_TECH_TRENDS', 'startup', 'Startup', 2),
-- THIS_WEEKS_POSTS (2)
('0195f300-2001-7000-a000-000000000080', 'THIS_WEEKS_POSTS', 'community', 'Community', 1),
('0195f300-2001-7000-a000-000000000081', 'THIS_WEEKS_POSTS', 'blog',      'Blog',      2);

-- ============================================================
-- 4. TRACKED ENTITY PLACEMENTS (엔터티 → 페이지/카테고리 매핑)
-- ============================================================
INSERT INTO content.tracked_entity_placement (id, tracked_entity_id, entity_page, entity_category_id) VALUES
-- MODEL_UPDATES placements
('0195f300-3001-7000-b000-000000000001', '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001'), -- GPT-5.4 → OpenAI
('0195f300-3001-7000-b000-000000000002', '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002'), -- Claude 3.7 → Anthropic
('0195f300-3001-7000-b000-000000000003', '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003'), -- Gemini 2.0 → Google
('0195f300-3001-7000-b000-000000000004', '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004'), -- Grok-3 → xAI
('0195f300-3001-7000-b000-000000000005', '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005'), -- LLaMA 4 → Meta
('0195f300-3001-7000-b000-000000000006', '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006'), -- DeepSeek-R1 → DeepSeek
('0195f300-3001-7000-b000-000000000007', '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007'), -- Mistral Large 2 → Mistral
-- FRAMEWORKS placements
('0195f300-3001-7000-b000-000000000010', '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- LangChain → Agent
('0195f300-3001-7000-b000-000000000011', '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- LangGraph → Agent
('0195f300-3001-7000-b000-000000000012', '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- CrewAI → Agent
('0195f300-3001-7000-b000-000000000013', '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- AutoGPT → Agent
('0195f300-3001-7000-b000-000000000014', '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013'), -- DSPy → Prompt Eng
('0195f300-3001-7000-b000-000000000015', '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011'), -- Unsloth → Fine-Tuning
('0195f300-3001-7000-b000-000000000016', '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011'), -- LLaMA-Factory → Fine-Tuning
('0195f300-3001-7000-b000-000000000017', '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014'), -- vLLM → Serving
('0195f300-3001-7000-b000-000000000018', '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014'), -- Ollama → Serving
('0195f300-3001-7000-b000-000000000019', '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015'), -- LlamaIndex → Data/Storage
('0195f300-3001-7000-b000-00000000001a', '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015'), -- ChromaDB → Data/Storage
('0195f300-3001-7000-b000-00000000001b', '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017'), -- Langfuse → Observability
('0195f300-3001-7000-b000-00000000001c', '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- RAGFlow → RAG
('0195f300-3001-7000-b000-00000000001d', '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- Haystack → RAG
('0195f300-3001-7000-b000-00000000001e', '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016'), -- MLflow → LLMOps
('0195f300-3001-7000-b000-00000000001f', '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- RAGAS → RAG
-- CASE_STUDIES placements
('0195f300-3001-7000-b000-000000000020', '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020'), -- Netomi → OpenAI
('0195f300-3001-7000-b000-000000000021', '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021'), -- AutoBNN → Google
('0195f300-3001-7000-b000-000000000022', '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021'), -- MedPaLM → Google
('0195f300-3001-7000-b000-000000000023', '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023'), -- Copilot Workspace → Microsoft
-- TOOLS placements
('0195f300-3001-7000-b000-000000000030', '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Cursor → IDE
('0195f300-3001-7000-b000-000000000031', '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Copilot → IDE
('0195f300-3001-7000-b000-000000000032', '0195f300-1001-7000-b000-000000000022', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Claude Code → IDE
('0195f300-3001-7000-b000-000000000033', '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041'), -- Docker AI → Infra
-- SHARED_RESOURCES placements
('0195f300-3001-7000-b000-000000000040', '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050'), -- HuggingFace → Hub
('0195f300-3001-7000-b000-000000000041', '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050'), -- Papers with Code → Hub
('0195f300-3001-7000-b000-000000000042', '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051'), -- Awesome LLM → Tutorial
-- PAPER_BENCHMARK placements
('0195f300-3001-7000-b000-000000000050', '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030'), -- MMLU-Pro → NLP
('0195f300-3001-7000-b000-000000000051', '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032'), -- SWE-bench → Coding
('0195f300-3001-7000-b000-000000000052', '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030'), -- GPQA Diamond → NLP
-- REGULATIONS placements
('0195f300-3001-7000-b000-000000000060', '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060'), -- EU AI Act → Intl
('0195f300-3001-7000-b000-000000000061', '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060'), -- NIST AI RMF → Intl
-- BIG_TECH_TRENDS — MCP Protocol
('0195f300-3001-7000-b000-000000000070', '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- MCP → FAANG
-- Cross-page placements (same entity on different pages)
('0195f300-3001-7000-b000-000000000080', '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000022'), -- Claude 3.7 → CS:Anthropic
('0195f300-3001-7000-b000-000000000081', '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000020'), -- GPT-5.4 → CS:OpenAI
('0195f300-3001-7000-b000-000000000082', '0195f300-1001-7000-b000-000000000062', 'FRAMEWORKS',      '0195f300-2001-7000-a000-000000000010'), -- MCP → FW:Agent
-- Additional cross-page placements needed by articles
('0195f300-3001-7000-b000-000000000083', '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000021'), -- Gemini 2.0 Flash → CS:Google
('0195f300-3001-7000-b000-000000000084', '0195f300-1001-7000-b000-000000000003', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000031'), -- Gemini 2.0 Flash → PB:Multimodal
('0195f300-3001-7000-b000-000000000085', '0195f300-1001-7000-b000-000000000001', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- GPT-5.4 → BT:FAANG
('0195f300-3001-7000-b000-000000000086', '0195f300-1001-7000-b000-000000000003', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- Gemini 2.0 Flash → BT:FAANG
('0195f300-3001-7000-b000-000000000087', '0195f300-1001-7000-b000-000000000005', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- LLaMA 4 → BT:FAANG
('0195f300-3001-7000-b000-000000000088', '0195f300-1001-7000-b000-000000000062', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'), -- MCP Protocol → TWP:Blog
('0195f300-3001-7000-b000-000000000089', '0195f300-1001-7000-b000-000000000010', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000080'), -- LangChain → TWP:Community
('0195f300-3001-7000-b000-00000000008a', '0195f300-1001-7000-b000-000000000001', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'), -- GPT-5.4 → TWP:Blog
('0195f300-3001-7000-b000-00000000008b', '0195f300-1001-7000-b000-000000000018', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000080'), -- Ollama → TWP:Community
('0195f300-3001-7000-b000-00000000008c', '0195f300-1001-7000-b000-00000000001c', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'); -- RAGFlow → TWP:Blog

-- ============================================================
-- 5. SIDE CATEGORIES (CASE_STUDY, APPLIED_RESEARCH)
-- ============================================================
-- side_category: 이미 존재하면 기존 ID 사용
INSERT INTO content.side_category (id, code, name, description, sort_order) VALUES
('0195f300-4001-7000-a100-000000000001', 'CASE_STUDY',       'Case Study',       'Enterprise adoption case studies', 1),
('0195f300-4001-7000-a100-000000000002', 'APPLIED_RESEARCH', 'Applied Research', 'Applied research papers',          2)
ON CONFLICT (code) WHERE (revoked_at IS NULL) DO NOTHING;

-- ============================================================
-- 6-8. ARTICLES + USER_ARTICLE_STATE + USER_ARTICLE_AI_STATE
-- 100개 기사 (DO $$ 블록으로 일괄 생성)
-- ============================================================
DO $$
DECLARE
    v_user_id       UUID := current_setting('cherry.seed_user_id')::UUID;
    v_src           UUID;
    v_entity_id     UUID;
    v_entity_page   content.entity_page_enum;
    v_cat_id        UUID;
    v_cat_name      VARCHAR(100);
    v_entity_name   VARCHAR(200);
    v_art_id        UUID;
    v_uas_id        UUID;
    v_aai_id        UUID;
    v_side_cat_id   UUID;
    v_title         VARCHAR(500);
    v_summary       TEXT;
    v_score         SMALLINT;
    v_impact        NUMERIC(12,4);
    v_pub_at        TIMESTAMPTZ;
    v_url           VARCHAR(1000);
    v_tags          JSONB;
    v_why           TEXT;
    v_key_points    JSONB;
    v_risk_notes    JSONB;
    rec             RECORD;
    i               INT := 0;
BEGIN
-- Seed articles from a values list
FOR rec IN (
    SELECT * FROM (VALUES
    -- =================== MODEL_UPDATES (20 articles) ===================
    (1,  'GPT-5.4 Launch: Stronger Coding and Reasoning',                     '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000001', 5, 88.5, '2026-03-20', NULL, 'GPT-5.4 brings significant improvements in coding reliability and multi-step reasoning.', 'Boosts production agent reliability for complex task chains.'),
    (2,  'GPT-5.4 Benchmark Results: GPQA 92.4%',                            '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000001', 4, 72.3, '2026-03-22', NULL, 'OpenAI publishes GPQA Diamond results for GPT-5.4 at 92.4%, topping the leaderboard.', 'Validates GPT-5.4 as current SOTA on graduate-level reasoning.'),
    (3,  'GPT-5.4 API Pricing and Availability',                             '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000005', 3, 55.0, '2026-03-25', NULL, 'OpenAI announces GPT-5.4 API pricing with 30% cost reduction from GPT-5.', 'Lower cost enables broader adoption in cost-sensitive pipelines.'),
    (4,  'Claude 3.7 Sonnet: Extended Thinking Deep Dive',                   '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000002', 5, 91.2, '2026-02-25', NULL, 'Claude 3.7 Sonnet introduces extended thinking mode for complex reasoning tasks.', 'Game-changer for agentic coding and multi-step analysis tasks.'),
    (5,  'Claude 3.7 Sonnet vs GPT-5.4: Head-to-Head Comparison',           '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000007', 4, 78.0, '2026-03-28', NULL, 'Independent benchmark comparison shows Claude 3.7 leading in coding while GPT-5.4 leads in math.', 'Helps teams choose the right model for their use case.'),
    (6,  'Gemini 2.0 Flash: 1M Token Context Window',                       '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000003', 4, 82.5, '2026-02-15', NULL, 'Gemini 2.0 Flash ships with native 1M token context and improved speed.', 'Enables processing entire codebases or long documents in one pass.'),
    (7,  'Gemini 2.0 Flash Multimodal Capabilities',                         '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000003', 3, 60.0, '2026-03-01', NULL, 'Google demonstrates Gemini 2.0 Flash processing video, audio, and code simultaneously.', 'Opens new multimodal pipeline possibilities.'),
    (8,  'Grok-3 Released: xAI Open-Weights Model',                         '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004', 'xAI Family',       'Grok-3',            '0195f300-0001-7000-a000-000000000007', 4, 70.0, '2026-03-10', NULL, 'xAI releases Grok-3 with open weights and competitive benchmark scores.', 'Adds another open-weight option for self-hosted deployments.'),
    (9,  'LLaMA 4 Multimodal Architecture',                                  '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           '0195f300-0001-7000-a000-000000000008', 5, 85.0, '2026-03-05', NULL, 'Meta unveils LLaMA 4 with native vision and improved instruction following.', 'Strongest open-weight multimodal model for self-hosting.'),
    (10, 'LLaMA 4 Fine-Tuning Guide',                                        '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           '0195f300-0001-7000-a000-000000000008', 3, 50.0, '2026-03-12', NULL, 'Official guide for fine-tuning LLaMA 4 on custom datasets.', 'Practical resource for teams deploying customized LLaMA 4.'),
    (11, 'DeepSeek-R1: Reasoning-First Architecture',                        '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       '0195f300-0001-7000-a000-000000000004', 5, 80.0, '2026-02-20', NULL, 'DeepSeek introduces R1 with chain-of-thought reasoning baked into architecture.', 'Novel approach to reasoning that competes with much larger models.'),
    (12, 'DeepSeek-R1 Open-Source Release',                                   '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       '0195f300-0001-7000-a000-000000000005', 3, 65.0, '2026-03-15', NULL, 'DeepSeek-R1 weights and training code now available on HuggingFace.', 'Enables community fine-tuning and research reproduction.'),
    (13, 'Mistral Large 2: European AI Flagship',                            '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007', 'Mistral Family',   'Mistral Large 2',   '0195f300-0001-7000-a000-000000000005', 4, 68.0, '2026-02-28', NULL, 'Mistral releases Large 2 with multilingual focus and EU data sovereignty.', 'Key option for EU-compliant deployments.'),
    (14, 'GPT-5.4 Enterprise Features Announced',                            '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000001', 3, 45.0, '2026-04-01', NULL, 'OpenAI adds enterprise-grade audit logs and data residency options to GPT-5.4.', 'Critical for regulated industry adoption.'),
    (15, 'Claude 3.7 Sonnet MCP Integration',                                '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000002', 4, 75.0, '2026-03-18', NULL, 'Anthropic enables native MCP tool use within Claude 3.7 Sonnet.', 'Simplifies building agentic applications with standardized tool protocols.'),
    (16, 'Gemini 2.0 Flash Grounding with Google Search',                    '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000003', 3, 58.0, '2026-03-30', NULL, 'Google integrates real-time search grounding into Gemini 2.0 Flash API.', 'Reduces hallucination for fact-sensitive queries.'),
    (17, 'Grok-3 Mini: Lightweight Version Released',                        '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004', 'xAI Family',       'Grok-3',            '0195f300-0001-7000-a000-000000000007', 3, 42.0, '2026-04-02', NULL, 'xAI launches Grok-3 Mini optimized for edge deployment.', 'Enables on-device inference for mobile apps.'),
    (18, 'LLaMA 4 Safety Evaluation Report',                                  '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           '0195f300-0001-7000-a000-000000000008', 3, 48.0, '2026-03-20', NULL, 'Meta publishes comprehensive safety evaluation for LLaMA 4 across 14 risk categories.', 'Important transparency resource for responsible deployment.'),
    (19, 'DeepSeek-R1 vs Claude 3.7 on Math Benchmarks',                     '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       '0195f300-0001-7000-a000-000000000004', 4, 62.0, '2026-04-03', NULL, 'Independent comparison shows DeepSeek-R1 narrowly leading on MATH and GSM8K.', 'Interesting for math-heavy applications.'),
    (20, 'Mistral Large 2 Function Calling Update',                           '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007', 'Mistral Family',   'Mistral Large 2',   '0195f300-0001-7000-a000-000000000005', 3, 40.0, '2026-04-05', NULL, 'Mistral improves function calling accuracy and adds parallel tool execution.', 'Makes Mistral Large 2 more viable for agentic workflows.'),

    -- =================== FRAMEWORKS (25 articles) ===================
    (21, 'LangChain v0.3: Simplified Chain API',                              '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangChain',         '0195f300-0001-7000-a000-000000000006', 4, 76.0, '2026-02-10', NULL, 'LangChain v0.3 simplifies the chain API with a new declarative syntax.', 'Reduces boilerplate for common LLM application patterns.'),
    (22, 'LangGraph 0.3: State Management Overhaul',                          '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangGraph',         '0195f300-0001-7000-a000-000000000006', 5, 85.0, '2026-02-25', NULL, 'LangGraph 0.3 introduces persistent state and human-in-the-loop patterns.', 'Essential upgrade for production agent systems.'),
    (23, 'CrewAI Multi-Agent Production Patterns',                            '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'CrewAI',            '0195f300-0001-7000-a000-000000000005', 4, 70.0, '2026-03-08', NULL, 'CrewAI shares production patterns for orchestrating specialized agent teams.', 'Practical guide for multi-agent system design.'),
    (24, 'AutoGPT v2.0: Web Browsing Agent',                                  '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'AutoGPT',           '0195f300-0001-7000-a000-000000000005', 3, 55.0, '2026-03-15', NULL, 'AutoGPT v2.0 adds reliable web browsing with improved error recovery.', 'Makes autonomous web research agents more practical.'),
    (25, 'DSPy 2.6: Automatic Prompt Optimization',                           '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013', 'Prompt Engineering','DSPy',              '0195f300-0001-7000-a000-000000000004', 5, 89.0, '2026-03-01', NULL, 'DSPy 2.6 introduces compiler-based prompt optimization with 40% quality improvement.', 'Removes manual prompt engineering for complex pipelines.'),
    (26, 'DSPy + LangGraph Integration Guide',                                '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013', 'Prompt Engineering','DSPy',              '0195f300-0001-7000-a000-000000000006', 3, 52.0, '2026-03-20', NULL, 'Community guide for combining DSPy optimization with LangGraph agent patterns.', 'Best of both worlds for agent prompt optimization.'),
    (27, 'Unsloth 2x Faster QLoRA Fine-Tuning',                               '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'Unsloth',           '0195f300-0001-7000-a000-000000000006', 5, 82.0, '2026-02-18', NULL, 'Unsloth achieves 2x speed improvement for QLoRA with 50% memory reduction.', 'Enables fine-tuning 70B models on single A100 GPU.'),
    (28, 'LLaMA-Factory: One-Click Fine-Tuning Suite',                        '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'LLaMA-Factory',     '0195f300-0001-7000-a000-000000000006', 4, 66.0, '2026-03-10', NULL, 'LLaMA-Factory adds web UI and one-click fine-tuning for 100+ model architectures.', 'Democratizes fine-tuning for non-ML engineers.'),
    (29, 'vLLM 0.8: Speculative Decoding Support',                            '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'vLLM',              '0195f300-0001-7000-a000-000000000006', 5, 80.0, '2026-02-22', NULL, 'vLLM 0.8 adds speculative decoding with 2-3x throughput improvement.', 'Major performance win for high-traffic LLM serving.'),
    (30, 'vLLM Multi-LoRA Serving',                                            '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'vLLM',              '0195f300-0001-7000-a000-000000000006', 3, 55.0, '2026-03-25', NULL, 'vLLM supports serving multiple LoRA adapters from a single base model.', 'Enables cost-effective multi-tenant LLM serving.'),
    (31, 'Ollama GPU Offloading for Large Models',                             '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'Ollama',            '0195f300-0001-7000-a000-000000000005', 4, 72.0, '2026-03-02', NULL, 'Ollama adds partial GPU offloading for running 70B+ models on consumer hardware.', 'Makes large model inference accessible to individual developers.'),
    (32, 'LlamaIndex Workflows: Async Event-Driven RAG',                      '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'LlamaIndex',        '0195f300-0001-7000-a000-000000000006', 4, 74.0, '2026-03-05', NULL, 'LlamaIndex introduces Workflows for building async event-driven RAG pipelines.', 'Clean abstraction for complex multi-step retrieval.'),
    (33, 'ChromaDB 0.5: Distributed Vector Store',                             '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'ChromaDB',          '0195f300-0001-7000-a000-000000000006', 4, 68.0, '2026-02-28', NULL, 'ChromaDB 0.5 ships distributed mode for horizontal scaling of vector search.', 'Production-ready vector store for large-scale RAG systems.'),
    (34, 'Langfuse 3.0: LLM Cost Dashboard',                                  '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017', 'Observability',    'Langfuse',          '0195f300-0001-7000-a000-000000000006', 4, 63.0, '2026-03-12', NULL, 'Langfuse 3.0 adds real-time cost tracking and anomaly detection for LLM calls.', 'Essential for managing LLM costs in production.'),
    (35, 'Langfuse + DSPy Evaluation Integration',                             '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017', 'Observability',    'Langfuse',          '0195f300-0001-7000-a000-000000000006', 3, 48.0, '2026-04-01', NULL, 'New integration enables tracking DSPy optimization experiments in Langfuse.', 'Unified observability for prompt optimization workflows.'),
    (36, 'RAGFlow: Enterprise RAG with Document Parsing',                      '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'RAGFlow',           '0195f300-0001-7000-a000-000000000005', 4, 71.0, '2026-03-18', NULL, 'RAGFlow adds deep document parsing with table and chart extraction.', 'Solves the hard problem of structured document retrieval.'),
    (37, 'Haystack 2.0: Pipeline-First Architecture',                          '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'Haystack',          '0195f300-0001-7000-a000-000000000006', 4, 65.0, '2026-02-14', NULL, 'Haystack 2.0 adopts pipeline-first architecture with component protocol.', 'Clean separation of concerns for RAG system design.'),
    (38, 'MLflow 3.0: LLM Tracking and Evaluation',                           '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016', 'LLMOps',           'MLflow',            '0195f300-0001-7000-a000-000000000006', 3, 58.0, '2026-03-22', NULL, 'MLflow 3.0 adds native LLM experiment tracking and automated evaluation.', 'Brings ML lifecycle management to LLM workflows.'),
    (39, 'RAGAS v0.2: Comprehensive RAG Evaluation',                           '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'RAGAS',             '0195f300-0001-7000-a000-000000000004', 4, 70.0, '2026-03-08', NULL, 'RAGAS v0.2 introduces faithfulness, relevance and context precision metrics.', 'Standard evaluation framework for RAG pipeline quality.'),
    (40, 'MCP Protocol: Standardizing Tool Use',                               '0195f300-1001-7000-b000-000000000062', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'MCP Protocol',      '0195f300-0001-7000-a000-000000000002', 5, 92.0, '2026-03-15', NULL, 'Anthropic Model Context Protocol becomes the de facto standard for LLM tool integration.', 'Standardizes how AI models interact with external tools and data.'),
    (41, 'LangChain + MCP: Unified Tool Protocol',                             '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangChain',         '0195f300-0001-7000-a000-000000000006', 3, 55.0, '2026-03-28', NULL, 'LangChain adds native MCP support for standardized tool calling.', 'Simplifies multi-tool agent development.'),
    (42, 'CrewAI Enterprise: Team Agent Orchestration',                        '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'CrewAI',            '0195f300-0001-7000-a000-000000000005', 3, 50.0, '2026-04-02', NULL, 'CrewAI launches enterprise version with role-based agent access control.', 'Addresses enterprise security needs for multi-agent systems.'),
    (43, 'Unsloth GaLore: Memory-Efficient Full Fine-Tuning',                  '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'Unsloth',           '0195f300-0001-7000-a000-000000000006', 4, 73.0, '2026-04-04', NULL, 'Unsloth integrates GaLore for full fine-tuning with LoRA-level memory usage.', 'Breaks the LoRA quality ceiling without memory penalty.'),
    (44, 'Ollama Windows Native Support',                                      '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'Ollama',            '0195f300-0001-7000-a000-000000000005', 3, 45.0, '2026-03-30', NULL, 'Ollama ships native Windows support with DirectML GPU acceleration.', 'Expands local LLM access to Windows developers.'),
    (45, 'LlamaIndex Property Graph RAG',                                      '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'LlamaIndex',        '0195f300-0001-7000-a000-000000000006', 4, 67.0, '2026-04-06', NULL, 'LlamaIndex adds property graph index for structured knowledge retrieval.', 'Combines vector search with graph-based reasoning.'),

    -- =================== CASE_STUDIES (15 articles) ===================
    (46, 'Netomi Deploys GPT-5.4 for Customer Support',                        '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'Netomi AI Support', '0195f300-0001-7000-a000-000000000005', 3, 55.0, '2026-02-24', 'CASE_STUDY', 'Netomi achieves 85% resolution rate using GPT-5.4 for automated customer support.', 'Validates GPT-5.4 for production customer service automation.'),
    (47, 'HIPAA-Compliant AI with OpenAI Enterprise',                          '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000001', 3, 52.0, '2026-03-05', 'CASE_STUDY', 'Healthcare startup deploys GPT-5.4 Enterprise with HIPAA compliance.', 'Shows path to AI adoption in regulated healthcare.'),
    (48, 'Tolan AI Voice Agent with GPT-5.4',                                  '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           '0195f300-0001-7000-a000-000000000005', 3, 48.0, '2026-03-15', 'CASE_STUDY', 'Tolan builds real-time AI voice agent using GPT-5.4 with sub-500ms latency.', 'Demonstrates feasibility of production voice AI agents.'),
    (49, 'AutoBNN: Google Weather Forecasting',                                '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'AutoBNN',           '0195f300-0001-7000-a000-000000000003', 3, 58.0, '2026-02-20', 'APPLIED_RESEARCH', 'Google applies AutoBNN to weather forecasting with 15% accuracy improvement.', 'Novel ML approach outperforms traditional meteorological models.'),
    (50, 'Google AutoBNN Architecture Details',                                '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'AutoBNN',           '0195f300-0001-7000-a000-000000000003', 3, 45.0, '2026-03-10', 'APPLIED_RESEARCH', 'Deep dive into AutoBNN architecture and training methodology.', 'Useful reference for Bayesian neural network practitioners.'),
    (51, 'MedPaLM NHS Lung Cancer Screening',                                 '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'MedPaLM',           '0195f300-0001-7000-a000-000000000009', 4, 75.0, '2026-02-28', 'APPLIED_RESEARCH', 'NHS pilot uses MedPaLM for lung cancer screening with 92% sensitivity.', 'Promising clinical AI application with significant health impact.'),
    (52, 'Claude 3.7 for Legal Document Analysis',                             '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000002', 4, 72.0, '2026-03-08', 'CASE_STUDY', 'Law firm deploys Claude 3.7 for contract analysis with 90% accuracy.', 'Shows Claude effectiveness for complex document understanding.'),
    (53, 'Claude 3.7 Agentic Coding at Scale',                                '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000002', 5, 85.0, '2026-03-22', 'CASE_STUDY', 'Tech company uses Claude 3.7 extended thinking for autonomous code migration.', 'Demonstrates viability of AI-driven large-scale code refactoring.'),
    (54, 'Copilot Workspace: AI-Driven Dev Environment',                       '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', '0195f300-0001-7000-a000-000000000005', 4, 70.0, '2026-03-12', 'CASE_STUDY', 'GitHub Copilot Workspace achieves 40% productivity improvement in beta.', 'Validates AI-first development environment concept.'),
    (55, 'Microsoft Azure AI Studio Enterprise Deployment',                    '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', '0195f300-0001-7000-a000-000000000005', 3, 52.0, '2026-03-28', 'CASE_STUDY', 'Enterprise deploys Azure AI Studio for unified LLM management.', 'Practical guide for enterprise AI platform adoption.'),
    (56, 'OpenAI API in Korean Fintech',                                       '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           '0195f300-0001-7000-a000-00000000000a', 3, 60.0, '2026-04-01', 'CASE_STUDY', 'Korean fintech startup uses GPT-5.4 for fraud detection with 95% precision.', 'Shows GPT-5.4 applicability in financial compliance.'),
    (57, 'Google Gemini in Education Platform',                                '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000003', 3, 50.0, '2026-04-03', 'CASE_STUDY',  'EdTech platform integrates Gemini 2.0 Flash for personalized tutoring.', 'Demonstrates multimodal AI in education.'),
    (58, 'Anthropic Claude in Healthcare Records',                             '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', '0195f300-0001-7000-a000-000000000002', 4, 68.0, '2026-04-05', 'APPLIED_RESEARCH', 'Research paper on Claude 3.7 for medical record summarization.', 'Shows promise for reducing clinician documentation burden.'),
    (59, 'Microsoft Copilot in Supply Chain',                                  '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', '0195f300-0001-7000-a000-000000000005', 3, 45.0, '2026-03-25', 'CASE_STUDY', 'Logistics company uses Copilot for supply chain optimization.', 'AI-assisted demand forecasting reduces waste by 20%.'),
    (60, 'Google MedPaLM Radiology Assistant',                                 '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'MedPaLM',           '0195f300-0001-7000-a000-000000000009', 4, 78.0, '2026-04-06', 'APPLIED_RESEARCH', 'MedPaLM assists radiologists with 88% concordance on chest X-ray findings.', 'Advancing AI-assisted medical imaging interpretation.'),

    -- =================== PAPER_BENCHMARK (10 articles) ===================
    (61, 'MMLU-Pro: Harder Multitask Benchmark Released',                      '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     '0195f300-0001-7000-a000-000000000004', 4, 75.0, '2026-02-15', NULL, 'MMLU-Pro introduces harder questions filtered from original MMLU with reasoning chains.', 'New standard benchmark for evaluating frontier model capabilities.'),
    (62, 'SWE-bench Verified: Real GitHub Issues',                             '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    '0195f300-0001-7000-a000-000000000004', 5, 82.0, '2026-02-20', NULL, 'SWE-bench Verified curates human-validated GitHub issues for code generation eval.', 'Gold standard for evaluating AI coding capabilities on real-world tasks.'),
    (63, 'GPQA Diamond: Graduate-Level QA',                                    '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'GPQA Diamond', '0195f300-0001-7000-a000-000000000004', 4, 70.0, '2026-03-01', NULL, 'GPQA Diamond includes PhD-level questions across physics, biology, and chemistry.', 'Distinguishes frontier models from near-frontier.'),
    (64, 'Frontier Models on MMLU-Pro: March Standings',                       '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     '0195f300-0001-7000-a000-000000000004', 3, 58.0, '2026-03-15', NULL, 'Monthly leaderboard update shows GPT-5.4 and Claude 3.7 neck and neck on MMLU-Pro.', 'Useful tracking of frontier model progress.'),
    (65, 'SWE-bench: Agent Framework Comparison',                              '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    '0195f300-0001-7000-a000-000000000004', 4, 72.0, '2026-03-20', NULL, 'Comparison of SWE-agent, AutoCodeRover, and Devin on SWE-bench Verified.', 'Reveals which agentic approaches solve real coding tasks best.'),
    (66, 'Multimodal Benchmark: MMMU Updated',                                '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     '0195f300-0001-7000-a000-000000000004', 3, 55.0, '2026-03-25', NULL, 'MMMU benchmark updated with harder visual reasoning tasks.', 'Better evaluation of multimodal understanding capabilities.'),
    (67, 'Code Generation Benchmark: HumanEval++',                             '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    '0195f300-0001-7000-a000-000000000004', 3, 50.0, '2026-04-01', NULL, 'HumanEval++ adds edge cases and security tests to original HumanEval.', 'More robust evaluation of code generation safety and correctness.'),
    (68, 'GPQA Diamond: April Model Rankings',                                 '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'GPQA Diamond', '0195f300-0001-7000-a000-000000000004', 3, 48.0, '2026-04-05', NULL, 'April GPQA Diamond rankings show GPT-5.4 at 92.4% and Claude 3.7 at 91.0%.', 'Monthly tracking of graduate-level reasoning capabilities.'),
    (69, 'Vision Language Model Benchmark: VQAv3',                             '0195f300-1001-7000-b000-000000000003', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000031', 'Multimodal', 'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000004', 3, 52.0, '2026-03-30', NULL, 'VQAv3 evaluates visual question answering with multi-hop reasoning.', 'Differentiates genuine visual understanding from pattern matching.'),
    (70, 'Coding Benchmark Contamination Analysis',                            '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    '0195f300-0001-7000-a000-000000000004', 4, 65.0, '2026-04-03', NULL, 'Study finds significant contamination in HumanEval; SWE-bench remains clean.', 'Important finding for benchmark integrity and model evaluation.'),

    -- =================== TOOLS (8 articles) ===================
    (71, 'Cursor 1.0: AI-Native Code Editor',                                  '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        '0195f300-0001-7000-a000-000000000005', 5, 88.0, '2026-02-28', NULL, 'Cursor 1.0 launches with composer mode for multi-file AI editing.', 'Redefines the code editor experience with AI-first design.'),
    (72, 'GitHub Copilot Multi-Model Support',                                 '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'GitHub Copilot','0195f300-0001-7000-a000-000000000005', 4, 75.0, '2026-03-05', NULL, 'Copilot now supports GPT-5.4, Claude 3.7, and Gemini as backend models.', 'Users can choose the best model for their coding style.'),
    (73, 'Claude Code: Terminal-First AI Agent',                               '0195f300-1001-7000-b000-000000000022', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Claude Code',   '0195f300-0001-7000-a000-000000000002', 5, 90.0, '2026-03-15', NULL, 'Anthropic launches Claude Code for autonomous coding tasks from the terminal.', 'New paradigm for AI-assisted development without IDE dependency.'),
    (74, 'Cursor + Claude Code Comparison',                                    '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        '0195f300-0001-7000-a000-000000000007', 3, 60.0, '2026-03-25', NULL, 'Head-to-head comparison of Cursor and Claude Code for different development workflows.', 'Helps developers choose the right AI coding tool.'),
    (75, 'Docker AI: Containerizing LLM Workloads',                            '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041', 'Infrastructure','Docker AI',     '0195f300-0001-7000-a000-000000000005', 3, 55.0, '2026-03-10', NULL, 'Docker adds AI-specific container templates for LLM serving.', 'Simplifies deployment of ML workloads in container environments.'),
    (76, 'GitHub Copilot Workspace GA',                                        '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'GitHub Copilot','0195f300-0001-7000-a000-000000000005', 4, 72.0, '2026-04-01', NULL, 'GitHub Copilot Workspace exits beta with issue-to-PR automation.', 'Automates the entire development workflow from issue to implementation.'),
    (77, 'Cursor Agent Mode Beta',                                              '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        '0195f300-0001-7000-a000-000000000005', 4, 78.0, '2026-04-03', NULL, 'Cursor launches agent mode for autonomous multi-file project changes.', 'Brings agentic coding to the IDE with visual diff review.'),
    (78, 'Docker AI Compose: LLM Stack Templates',                             '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041', 'Infrastructure','Docker AI',     '0195f300-0001-7000-a000-000000000005', 3, 48.0, '2026-04-05', NULL, 'Docker AI Compose provides one-click deployment for common LLM stacks.', 'Reduces LLM infrastructure setup time from hours to minutes.'),

    -- =================== SHARED_RESOURCES (7 articles) ===================
    (79, 'HuggingFace Reaches 1M Models',                                      '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      '0195f300-0001-7000-a000-000000000006', 4, 70.0, '2026-02-15', NULL, 'HuggingFace Hub surpasses 1 million publicly available models.', 'Milestone for open-source ML ecosystem growth.'),
    (80, 'Papers with Code: LLM Leaderboard Update',                          '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'Papers with Code', '0195f300-0001-7000-a000-000000000004', 3, 55.0, '2026-03-01', NULL, 'Papers with Code launches unified LLM leaderboard across 50+ benchmarks.', 'Central tracking for model performance comparison.'),
    (81, 'Awesome LLM: 2026 Q1 Resource Roundup',                             '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051', 'Tutorial',  'Awesome LLM',      '0195f300-0001-7000-a000-000000000006', 3, 45.0, '2026-03-15', NULL, 'Quarterly roundup of best LLM resources, tutorials, and papers from Q1 2026.', 'Curated starting point for new AI engineers.'),
    (82, 'HuggingFace Open LLM Leaderboard v3',                               '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      '0195f300-0001-7000-a000-000000000006', 4, 68.0, '2026-03-20', NULL, 'HuggingFace launches Open LLM Leaderboard v3 with new evaluation suite.', 'Improved evaluation methodology for open-source model comparison.'),
    (83, 'Papers with Code Trends: Agent Papers Surge',                        '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'Papers with Code', '0195f300-0001-7000-a000-000000000004', 3, 52.0, '2026-03-28', NULL, 'Agent-related papers increase 300% YoY according to Papers with Code data.', 'Confirms agent architectures as dominant research trend.'),
    (84, 'HuggingFace Inference Endpoints v2',                                 '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      '0195f300-0001-7000-a000-000000000006', 3, 50.0, '2026-04-02', NULL, 'HuggingFace Inference Endpoints v2 adds auto-scaling and GPU optimization.', 'One-click model deployment for production use.'),
    (85, 'Awesome LLM: Korean AI Resources',                                   '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051', 'Tutorial',  'Awesome LLM',      '0195f300-0001-7000-a000-00000000000a', 3, 42.0, '2026-04-05', NULL, 'Community-curated list of Korean-language LLM resources and tutorials.', 'Growing Korean AI ecosystem resources.'),

    -- =================== REGULATIONS (5 articles) ===================
    (86, 'EU AI Act: Implementation Timeline Published',                       '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   '0195f300-0001-7000-a000-000000000007', 5, 85.0, '2026-02-10', NULL, 'European Commission publishes detailed implementation timeline for AI Act.', 'Critical compliance milestone for AI companies operating in EU.'),
    (87, 'NIST AI RMF 2.0 Draft Released',                                    '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'NIST AI RMF', '0195f300-0001-7000-a000-000000000007', 4, 72.0, '2026-03-01', NULL, 'NIST releases draft update to AI Risk Management Framework with LLM-specific guidance.', 'New standard for responsible LLM deployment in US market.'),
    (88, 'EU AI Act: High-Risk AI Systems List Finalized',                     '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   '0195f300-0001-7000-a000-000000000007', 4, 68.0, '2026-03-15', NULL, 'EU finalizes the list of high-risk AI systems requiring conformity assessment.', 'Determines which AI systems face strictest compliance requirements.'),
    (89, 'Korea AI Basic Act: National Assembly Review',                       '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   '0195f300-0001-7000-a000-00000000000a', 3, 55.0, '2026-03-28', NULL, 'Korean National Assembly begins review of AI Basic Act legislation.', 'Key development for Korean AI industry regulatory framework.'),
    (90, 'NIST AI RMF: Generative AI Profile Published',                       '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'NIST AI RMF', '0195f300-0001-7000-a000-000000000007', 4, 62.0, '2026-04-03', NULL, 'NIST publishes Generative AI Profile companion to AI RMF 2.0 draft.', 'Specific guidance for managing generative AI risks.'),

    -- =================== BIG_TECH_TRENDS (5 articles) ===================
    (91, 'MCP Protocol Adoption: 500+ Integrations',                           '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'MCP Protocol', '0195f300-0001-7000-a000-000000000002', 5, 92.0, '2026-03-10', NULL, 'Anthropic MCP Protocol reaches 500+ community integrations in 3 months.', 'Fastest-growing standard for AI tool integration.'),
    (92, 'OpenAI $10B Revenue Run Rate',                                       '0195f300-1001-7000-b000-000000000001', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'GPT-5.4',      '0195f300-0001-7000-a000-000000000005', 4, 75.0, '2026-03-20', NULL, 'OpenAI reaches $10B annual revenue run rate driven by enterprise adoption.', 'Validates the AI business model at scale.'),
    (93, 'Google AI Revenue Surpasses Cloud Revenue',                          '0195f300-1001-7000-b000-000000000003', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'Gemini 2.0 Flash',  '0195f300-0001-7000-a000-000000000003', 4, 70.0, '2026-04-01', NULL, 'Google AI products revenue exceeds traditional cloud revenue for first time.', 'Major shift in tech industry revenue composition.'),
    (94, 'AI Startup Funding Q1 2026: $25B Record',                            '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',    'MCP Protocol', '0195f300-0001-7000-a000-000000000005', 3, 58.0, '2026-04-03', NULL, 'AI startup funding reaches $25B in Q1 2026, setting quarterly record.', 'Capital continues flowing into AI despite broader market caution.'),
    (95, 'Meta Open Source AI Strategy Payoff',                                '0195f300-1001-7000-b000-000000000005', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'LLaMA 4',      '0195f300-0001-7000-a000-000000000008', 4, 65.0, '2026-04-05', NULL, 'Meta open-source strategy drives LLaMA 4 to 100M+ downloads.', 'Open-source AI as competitive moat strategy validated.'),

    -- =================== THIS_WEEKS_POSTS (5 articles) ===================
    (96, 'Simon Willison: AI Engineering in 2026',                             '0195f300-1001-7000-b000-000000000062', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'MCP Protocol', '0195f300-0001-7000-a000-000000000005', 4, 72.0, '2026-04-01', NULL, 'Simon Willison shares predictions for AI engineering trends in 2026.', 'Insightful perspective from a respected AI practitioner.'),
    (97, 'r/MachineLearning: Best Agent Frameworks',                           '0195f300-1001-7000-b000-000000000010', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000080', 'Community', 'LangChain',    '0195f300-0001-7000-a000-000000000005', 3, 55.0, '2026-04-02', NULL, 'Reddit community discusses pros and cons of current agent frameworks.', 'Useful community consensus on framework selection.'),
    (98, 'Andrej Karpathy: Building with LLMs',                                '0195f300-1001-7000-b000-000000000001', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'GPT-5.4',      '0195f300-0001-7000-a000-000000000005', 5, 85.0, '2026-04-03', NULL, 'Karpathy shares practical lessons from building production LLM systems.', 'Must-read for AI engineers from a leading practitioner.'),
    (99, 'Hacker News: Self-Hosted LLM Setup Guide',                           '0195f300-1001-7000-b000-000000000018', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000080', 'Community', 'Ollama',       '0195f300-0001-7000-a000-000000000005', 3, 48.0, '2026-04-05', NULL, 'Popular HN guide for setting up self-hosted LLM with Ollama and vLLM.', 'Practical guide for privacy-conscious deployments.'),
    (100,'AI Engineering Blog: RAG vs Fine-Tuning Decision',                   '0195f300-1001-7000-b000-00000000001c', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'RAGFlow',      '0195f300-0001-7000-a000-000000000006', 4, 68.0, '2026-04-06', NULL, 'Comprehensive decision framework for choosing between RAG and fine-tuning.', 'Answers the most common AI engineering architecture question.')
    ) AS t(seq, title, entity_id, page, cat_id, cat_name, entity_name, source_id, score, impact, pub_date, side_cat, summary, why_matters)
)
LOOP
    i := i + 1;

    v_art_id  := ('0195f300-a' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_uas_id  := ('0195f300-b' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_aai_id  := ('0195f300-c' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_pub_at  := (rec.pub_date || 'T08:00:00Z')::TIMESTAMPTZ;
    v_url     := 'https://example.com/article-' || rec.seq;

    -- side_category lookup
    IF rec.side_cat = 'CASE_STUDY' THEN
        v_side_cat_id := '0195f300-4001-7000-a100-000000000001';
    ELSIF rec.side_cat = 'APPLIED_RESEARCH' THEN
        v_side_cat_id := '0195f300-4001-7000-a100-000000000002';
    ELSE
        v_side_cat_id := NULL;
    END IF;

    -- 6. article_raw
    INSERT INTO content.article_raw (id, source_id, title, url, published_at, representative_key)
    VALUES (
        v_art_id,
        rec.source_id::UUID,
        rec.title,
        v_url,
        v_pub_at,
        'seed-' || rec.seq || '-' || md5(rec.title)
    );

    -- 7. user_article_state
    INSERT INTO content.user_article_state (
        id, user_id, article_raw_id, representative_entity_id,
        side_category_id, impact_score, is_high_impact, discovered_at
    ) VALUES (
        v_uas_id,
        v_user_id,
        v_art_id,
        rec.entity_id::UUID,
        v_side_cat_id,
        rec.impact,
        rec.impact > 75,
        v_pub_at + INTERVAL '1 hour'
    );

    -- Build tags JSON
    v_tags := jsonb_build_array(
        jsonb_build_object('kind', 'TAG', 'value', lower(rec.entity_name)),
        jsonb_build_object('kind', 'TAG', 'value', lower(replace(rec.cat_name, ' ', '-'))),
        jsonb_build_object('kind', 'KEYWORD', 'value', lower(rec.page::TEXT), 'frequency', (3 + rec.score), 'confidence', round(0.6 + rec.score * 0.08, 2))
    );

    -- Build key_points and risk_notes
    v_key_points := jsonb_build_array(
        'Key update for ' || rec.entity_name,
        rec.cat_name || ' category development'
    );
    v_risk_notes := jsonb_build_array(
        'Verify claims with independent benchmarks'
    );

    -- 8. user_article_ai_state (with agent_json_raw)
    INSERT INTO content.user_article_ai_state (
        id, user_id, user_article_state_id,
        ai_status,
        representative_entity_id, representative_entity_page,
        representative_entity_category_id, representative_entity_category_name,
        representative_entity_name,
        ai_summary, ai_score,
        ai_classification_json, ai_tags_json, ai_snippets_json,
        ai_evidence_json, ai_structured_extraction_json,
        agent_json_raw,
        ai_model_name, ai_processed_at
    ) VALUES (
        v_aai_id,
        v_user_id,
        v_uas_id,
        'SUCCESS',
        rec.entity_id::UUID,
        rec.page::content.entity_page_enum,
        rec.cat_id::UUID,
        rec.cat_name,
        rec.entity_name,
        rec.summary,
        rec.score,
        -- ai_classification_json
        jsonb_build_object(
            'final_path', jsonb_build_object(
                'page', rec.page,
                'category_name', rec.cat_name,
                'entity_name', rec.entity_name
            ),
            'candidates', jsonb_build_array(
                jsonb_build_object(
                    'page', rec.page,
                    'category_name', rec.cat_name,
                    'entity_name', rec.entity_name,
                    'confidence', round(0.80 + rec.score * 0.03, 2)
                )
            ),
            'decision_reason', 'title and source strongly match tracked entity'
        ),
        -- ai_tags_json
        v_tags,
        -- ai_snippets_json
        jsonb_build_object(
            'why_it_matters', rec.why_matters,
            'key_points', v_key_points,
            'risk_notes', v_risk_notes
        ),
        -- ai_evidence_json
        jsonb_build_object(
            'evidence_items', jsonb_build_array(
                jsonb_build_object(
                    'kind', 'quote',
                    'text', left(rec.summary, 80),
                    'url', v_url,
                    'source_name', 'Seed Source',
                    'published_at', v_pub_at
                )
            )
        ),
        -- ai_structured_extraction_json
        jsonb_build_object(
            'source', jsonb_build_object('name', 'Seed Source', 'type', 'RSS'),
            'review', jsonb_build_object('type', 'Announcement', 'reviewer', NULL, 'comment', NULL)
        ),
        -- agent_json_raw
        jsonb_build_object(
            'idempotency_key', 'uas:' || lower(v_uas_id::TEXT),
            'version', '0.3',
            'representative_entity', jsonb_build_object(
                'id', rec.entity_id,
                'page', rec.page,
                'category_id', rec.cat_id,
                'category_name', rec.cat_name,
                'name', rec.entity_name
            ),
            'ai_summary', rec.summary,
            'ai_score', rec.score,
            'ai_classification_json', jsonb_build_object(
                'final_path', jsonb_build_object(
                    'page', rec.page,
                    'category_name', rec.cat_name,
                    'entity_name', rec.entity_name
                ),
                'candidates', jsonb_build_array(
                    jsonb_build_object(
                        'page', rec.page,
                        'category_name', rec.cat_name,
                        'entity_name', rec.entity_name,
                        'confidence', round(0.80 + rec.score * 0.03, 2)
                    )
                ),
                'decision_reason', 'title and source strongly match tracked entity'
            ),
            'ai_tags_json', v_tags,
            'ai_snippets_json', jsonb_build_object(
                'why_it_matters', rec.why_matters,
                'key_points', v_key_points,
                'risk_notes', v_risk_notes
            ),
            'ai_evidence_json', jsonb_build_object(
                'evidence_items', jsonb_build_array(
                    jsonb_build_object(
                        'kind', 'quote',
                        'text', left(rec.summary, 80),
                        'url', v_url,
                        'source_name', 'Seed Source',
                        'published_at', v_pub_at
                    )
                )
            ),
            'ai_structured_extraction_json', jsonb_build_object(
                'source', jsonb_build_object('name', 'Seed Source', 'type', 'RSS'),
                'review', jsonb_build_object('type', 'Announcement', 'reviewer', NULL, 'comment', NULL)
            )
        ),
        'claude-3.7-sonnet',
        v_pub_at + INTERVAL '2 hours'
    );

END LOOP;

RAISE NOTICE 'Seeded % articles successfully.', i;
END $$;

COMMIT;

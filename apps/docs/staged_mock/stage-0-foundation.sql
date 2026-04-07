-- ============================================================
-- Stage 0 — Foundation (Reference Data)
-- Cherry Platform Staged Mock Data
-- Prerequisites: DDL v1.1 applied, at least 1 active app_user exists
-- ============================================================

BEGIN;

-- ============================================================
-- 0. User ID lookup — sets session variable for subsequent stages
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
-- 1. SOURCES (10)
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
-- 2. TRACKED ENTITIES (40)
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
-- 3. ENTITY CATEGORIES (25, across 9 pages)
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
-- 4. TRACKED ENTITY PLACEMENTS (entity -> page/category mapping)
-- ============================================================
INSERT INTO content.tracked_entity_placement (id, tracked_entity_id, entity_page, entity_category_id) VALUES
-- MODEL_UPDATES placements
('0195f300-3001-7000-b000-000000000001', '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001'), -- GPT-5.4 -> OpenAI
('0195f300-3001-7000-b000-000000000002', '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002'), -- Claude 3.7 -> Anthropic
('0195f300-3001-7000-b000-000000000003', '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003'), -- Gemini 2.0 -> Google
('0195f300-3001-7000-b000-000000000004', '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004'), -- Grok-3 -> xAI
('0195f300-3001-7000-b000-000000000005', '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005'), -- LLaMA 4 -> Meta
('0195f300-3001-7000-b000-000000000006', '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006'), -- DeepSeek-R1 -> DeepSeek
('0195f300-3001-7000-b000-000000000007', '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007'), -- Mistral Large 2 -> Mistral
-- FRAMEWORKS placements
('0195f300-3001-7000-b000-000000000010', '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- LangChain -> Agent
('0195f300-3001-7000-b000-000000000011', '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- LangGraph -> Agent
('0195f300-3001-7000-b000-000000000012', '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- CrewAI -> Agent
('0195f300-3001-7000-b000-000000000013', '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010'), -- AutoGPT -> Agent
('0195f300-3001-7000-b000-000000000014', '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013'), -- DSPy -> Prompt Eng
('0195f300-3001-7000-b000-000000000015', '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011'), -- Unsloth -> Fine-Tuning
('0195f300-3001-7000-b000-000000000016', '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011'), -- LLaMA-Factory -> Fine-Tuning
('0195f300-3001-7000-b000-000000000017', '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014'), -- vLLM -> Serving
('0195f300-3001-7000-b000-000000000018', '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014'), -- Ollama -> Serving
('0195f300-3001-7000-b000-000000000019', '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015'), -- LlamaIndex -> Data/Storage
('0195f300-3001-7000-b000-00000000001a', '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015'), -- ChromaDB -> Data/Storage
('0195f300-3001-7000-b000-00000000001b', '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017'), -- Langfuse -> Observability
('0195f300-3001-7000-b000-00000000001c', '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- RAGFlow -> RAG
('0195f300-3001-7000-b000-00000000001d', '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- Haystack -> RAG
('0195f300-3001-7000-b000-00000000001e', '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016'), -- MLflow -> LLMOps
('0195f300-3001-7000-b000-00000000001f', '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012'), -- RAGAS -> RAG
-- CASE_STUDIES placements
('0195f300-3001-7000-b000-000000000020', '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020'), -- Netomi -> OpenAI
('0195f300-3001-7000-b000-000000000021', '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021'), -- AutoBNN -> Google
('0195f300-3001-7000-b000-000000000022', '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021'), -- MedPaLM -> Google
('0195f300-3001-7000-b000-000000000023', '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023'), -- Copilot Workspace -> Microsoft
-- TOOLS placements
('0195f300-3001-7000-b000-000000000030', '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Cursor -> IDE
('0195f300-3001-7000-b000-000000000031', '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Copilot -> IDE
('0195f300-3001-7000-b000-000000000032', '0195f300-1001-7000-b000-000000000022', 'TOOLS', '0195f300-2001-7000-a000-000000000040'), -- Claude Code -> IDE
('0195f300-3001-7000-b000-000000000033', '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041'), -- Docker AI -> Infra
-- SHARED_RESOURCES placements
('0195f300-3001-7000-b000-000000000040', '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050'), -- HuggingFace -> Hub
('0195f300-3001-7000-b000-000000000041', '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050'), -- Papers with Code -> Hub
('0195f300-3001-7000-b000-000000000042', '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051'), -- Awesome LLM -> Tutorial
-- PAPER_BENCHMARK placements
('0195f300-3001-7000-b000-000000000050', '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030'), -- MMLU-Pro -> NLP
('0195f300-3001-7000-b000-000000000051', '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032'), -- SWE-bench -> Coding
('0195f300-3001-7000-b000-000000000052', '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030'), -- GPQA Diamond -> NLP
-- REGULATIONS placements
('0195f300-3001-7000-b000-000000000060', '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060'), -- EU AI Act -> Intl
('0195f300-3001-7000-b000-000000000061', '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060'), -- NIST AI RMF -> Intl
-- BIG_TECH_TRENDS
('0195f300-3001-7000-b000-000000000070', '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- MCP -> FAANG
-- Cross-page placements (same entity on different pages)
('0195f300-3001-7000-b000-000000000080', '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000022'), -- Claude 3.7 -> CS:Anthropic
('0195f300-3001-7000-b000-000000000081', '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000020'), -- GPT-5.4 -> CS:OpenAI
('0195f300-3001-7000-b000-000000000082', '0195f300-1001-7000-b000-000000000062', 'FRAMEWORKS',      '0195f300-2001-7000-a000-000000000010'), -- MCP -> FW:Agent
-- Additional cross-page placements needed by articles
('0195f300-3001-7000-b000-000000000083', '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES',    '0195f300-2001-7000-a000-000000000021'), -- Gemini 2.0 Flash -> CS:Google
('0195f300-3001-7000-b000-000000000084', '0195f300-1001-7000-b000-000000000003', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000031'), -- Gemini 2.0 Flash -> PB:Multimodal
('0195f300-3001-7000-b000-000000000085', '0195f300-1001-7000-b000-000000000001', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- GPT-5.4 -> BT:FAANG
('0195f300-3001-7000-b000-000000000086', '0195f300-1001-7000-b000-000000000003', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- Gemini 2.0 Flash -> BT:FAANG
('0195f300-3001-7000-b000-000000000087', '0195f300-1001-7000-b000-000000000005', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070'), -- LLaMA 4 -> BT:FAANG
('0195f300-3001-7000-b000-000000000088', '0195f300-1001-7000-b000-000000000062', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'), -- MCP Protocol -> TWP:Blog
('0195f300-3001-7000-b000-000000000089', '0195f300-1001-7000-b000-000000000010', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000080'), -- LangChain -> TWP:Community
('0195f300-3001-7000-b000-00000000008a', '0195f300-1001-7000-b000-000000000001', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'), -- GPT-5.4 -> TWP:Blog
('0195f300-3001-7000-b000-00000000008b', '0195f300-1001-7000-b000-000000000018', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000080'), -- Ollama -> TWP:Community
('0195f300-3001-7000-b000-00000000008c', '0195f300-1001-7000-b000-00000000001c', 'THIS_WEEKS_POSTS','0195f300-2001-7000-a000-000000000081'); -- RAGFlow -> TWP:Blog

-- ============================================================
-- 5. SIDE CATEGORIES (CASE_STUDY, APPLIED_RESEARCH)
-- ============================================================
INSERT INTO content.side_category (id, code, name, description, sort_order) VALUES
('0195f300-4001-7000-a100-000000000001', 'CASE_STUDY',       'Case Study',       'Enterprise adoption case studies', 1),
('0195f300-4001-7000-a100-000000000002', 'APPLIED_RESEARCH', 'Applied Research', 'Applied research papers',          2)
ON CONFLICT (code) WHERE (revoked_at IS NULL) DO NOTHING;

COMMIT;

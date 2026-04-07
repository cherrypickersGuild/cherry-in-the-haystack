-- ============================================================
-- Stage 1 — article_raw INSERT (External Collector Simulation)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stage 0 applied
-- Inserts 100 article_raw rows with only Collector-written columns
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_art_id   UUID;
    v_pub_at   TIMESTAMPTZ;
    v_url      VARCHAR(1000);
    v_lang     VARCHAR(10);
    rec        RECORD;
    i          INT := 0;
BEGIN

FOR rec IN (
    SELECT * FROM (VALUES
    -- =================== MODEL_UPDATES (20 articles) ===================
    (1,  'GPT-5.4 Launch: Stronger Coding and Reasoning',                     '0195f300-0001-7000-a000-000000000001', '2026-03-20'),
    (2,  'GPT-5.4 Benchmark Results: GPQA 92.4%',                            '0195f300-0001-7000-a000-000000000001', '2026-03-22'),
    (3,  'GPT-5.4 API Pricing and Availability',                             '0195f300-0001-7000-a000-000000000005', '2026-03-25'),
    (4,  'Claude 3.7 Sonnet: Extended Thinking Deep Dive',                   '0195f300-0001-7000-a000-000000000002', '2026-02-25'),
    (5,  'Claude 3.7 Sonnet vs GPT-5.4: Head-to-Head Comparison',           '0195f300-0001-7000-a000-000000000007', '2026-03-28'),
    (6,  'Gemini 2.0 Flash: 1M Token Context Window',                       '0195f300-0001-7000-a000-000000000003', '2026-02-15'),
    (7,  'Gemini 2.0 Flash Multimodal Capabilities',                         '0195f300-0001-7000-a000-000000000003', '2026-03-01'),
    (8,  'Grok-3 Released: xAI Open-Weights Model',                         '0195f300-0001-7000-a000-000000000007', '2026-03-10'),
    (9,  'LLaMA 4 Multimodal Architecture',                                  '0195f300-0001-7000-a000-000000000008', '2026-03-05'),
    (10, 'LLaMA 4 Fine-Tuning Guide',                                        '0195f300-0001-7000-a000-000000000008', '2026-03-12'),
    (11, 'DeepSeek-R1: Reasoning-First Architecture',                        '0195f300-0001-7000-a000-000000000004', '2026-02-20'),
    (12, 'DeepSeek-R1 Open-Source Release',                                   '0195f300-0001-7000-a000-000000000005', '2026-03-15'),
    (13, 'Mistral Large 2: European AI Flagship',                            '0195f300-0001-7000-a000-000000000005', '2026-02-28'),
    (14, 'GPT-5.4 Enterprise Features Announced',                            '0195f300-0001-7000-a000-000000000001', '2026-04-01'),
    (15, 'Claude 3.7 Sonnet MCP Integration',                                '0195f300-0001-7000-a000-000000000002', '2026-03-18'),
    (16, 'Gemini 2.0 Flash Grounding with Google Search',                    '0195f300-0001-7000-a000-000000000003', '2026-03-30'),
    (17, 'Grok-3 Mini: Lightweight Version Released',                        '0195f300-0001-7000-a000-000000000007', '2026-04-02'),
    (18, 'LLaMA 4 Safety Evaluation Report',                                  '0195f300-0001-7000-a000-000000000008', '2026-03-20'),
    (19, 'DeepSeek-R1 vs Claude 3.7 on Math Benchmarks',                     '0195f300-0001-7000-a000-000000000004', '2026-04-03'),
    (20, 'Mistral Large 2 Function Calling Update',                           '0195f300-0001-7000-a000-000000000005', '2026-04-05'),

    -- =================== FRAMEWORKS (25 articles) ===================
    (21, 'LangChain v0.3: Simplified Chain API',                              '0195f300-0001-7000-a000-000000000006', '2026-02-10'),
    (22, 'LangGraph 0.3: State Management Overhaul',                          '0195f300-0001-7000-a000-000000000006', '2026-02-25'),
    (23, 'CrewAI Multi-Agent Production Patterns',                            '0195f300-0001-7000-a000-000000000005', '2026-03-08'),
    (24, 'AutoGPT v2.0: Web Browsing Agent',                                  '0195f300-0001-7000-a000-000000000005', '2026-03-15'),
    (25, 'DSPy 2.6: Automatic Prompt Optimization',                           '0195f300-0001-7000-a000-000000000004', '2026-03-01'),
    (26, 'DSPy + LangGraph Integration Guide',                                '0195f300-0001-7000-a000-000000000006', '2026-03-20'),
    (27, 'Unsloth 2x Faster QLoRA Fine-Tuning',                               '0195f300-0001-7000-a000-000000000006', '2026-02-18'),
    (28, 'LLaMA-Factory: One-Click Fine-Tuning Suite',                        '0195f300-0001-7000-a000-000000000006', '2026-03-10'),
    (29, 'vLLM 0.8: Speculative Decoding Support',                            '0195f300-0001-7000-a000-000000000006', '2026-02-22'),
    (30, 'vLLM Multi-LoRA Serving',                                            '0195f300-0001-7000-a000-000000000006', '2026-03-25'),
    (31, 'Ollama GPU Offloading for Large Models',                             '0195f300-0001-7000-a000-000000000005', '2026-03-02'),
    (32, 'LlamaIndex Workflows: Async Event-Driven RAG',                      '0195f300-0001-7000-a000-000000000006', '2026-03-05'),
    (33, 'ChromaDB 0.5: Distributed Vector Store',                             '0195f300-0001-7000-a000-000000000006', '2026-02-28'),
    (34, 'Langfuse 3.0: LLM Cost Dashboard',                                  '0195f300-0001-7000-a000-000000000006', '2026-03-12'),
    (35, 'Langfuse + DSPy Evaluation Integration',                             '0195f300-0001-7000-a000-000000000006', '2026-04-01'),
    (36, 'RAGFlow: Enterprise RAG with Document Parsing',                      '0195f300-0001-7000-a000-000000000005', '2026-03-18'),
    (37, 'Haystack 2.0: Pipeline-First Architecture',                          '0195f300-0001-7000-a000-000000000006', '2026-02-14'),
    (38, 'MLflow 3.0: LLM Tracking and Evaluation',                           '0195f300-0001-7000-a000-000000000006', '2026-03-22'),
    (39, 'RAGAS v0.2: Comprehensive RAG Evaluation',                           '0195f300-0001-7000-a000-000000000004', '2026-03-08'),
    (40, 'MCP Protocol: Standardizing Tool Use',                               '0195f300-0001-7000-a000-000000000002', '2026-03-15'),
    (41, 'LangChain + MCP: Unified Tool Protocol',                             '0195f300-0001-7000-a000-000000000006', '2026-03-28'),
    (42, 'CrewAI Enterprise: Team Agent Orchestration',                        '0195f300-0001-7000-a000-000000000005', '2026-04-02'),
    (43, 'Unsloth GaLore: Memory-Efficient Full Fine-Tuning',                  '0195f300-0001-7000-a000-000000000006', '2026-04-04'),
    (44, 'Ollama Windows Native Support',                                      '0195f300-0001-7000-a000-000000000005', '2026-03-30'),
    (45, 'LlamaIndex Property Graph RAG',                                      '0195f300-0001-7000-a000-000000000006', '2026-04-06'),

    -- =================== CASE_STUDIES (15 articles) ===================
    (46, 'Netomi Deploys GPT-5.4 for Customer Support',                        '0195f300-0001-7000-a000-000000000005', '2026-02-24'),
    (47, 'HIPAA-Compliant AI with OpenAI Enterprise',                          '0195f300-0001-7000-a000-000000000001', '2026-03-05'),
    (48, 'Tolan AI Voice Agent with GPT-5.4',                                  '0195f300-0001-7000-a000-000000000005', '2026-03-15'),
    (49, 'AutoBNN: Google Weather Forecasting',                                '0195f300-0001-7000-a000-000000000003', '2026-02-20'),
    (50, 'Google AutoBNN Architecture Details',                                '0195f300-0001-7000-a000-000000000003', '2026-03-10'),
    (51, 'MedPaLM NHS Lung Cancer Screening',                                 '0195f300-0001-7000-a000-000000000009', '2026-02-28'),
    (52, 'Claude 3.7 for Legal Document Analysis',                             '0195f300-0001-7000-a000-000000000002', '2026-03-08'),
    (53, 'Claude 3.7 Agentic Coding at Scale',                                '0195f300-0001-7000-a000-000000000002', '2026-03-22'),
    (54, 'Copilot Workspace: AI-Driven Dev Environment',                       '0195f300-0001-7000-a000-000000000005', '2026-03-12'),
    (55, 'Microsoft Azure AI Studio Enterprise Deployment',                    '0195f300-0001-7000-a000-000000000005', '2026-03-28'),
    (56, 'OpenAI API in Korean Fintech',                                       '0195f300-0001-7000-a000-00000000000a', '2026-04-01'),
    (57, 'Google Gemini in Education Platform',                                '0195f300-0001-7000-a000-000000000003', '2026-04-03'),
    (58, 'Anthropic Claude in Healthcare Records',                             '0195f300-0001-7000-a000-000000000002', '2026-04-05'),
    (59, 'Microsoft Copilot in Supply Chain',                                  '0195f300-0001-7000-a000-000000000005', '2026-03-25'),
    (60, 'Google MedPaLM Radiology Assistant',                                 '0195f300-0001-7000-a000-000000000009', '2026-04-06'),

    -- =================== PAPER_BENCHMARK (10 articles) ===================
    (61, 'MMLU-Pro: Harder Multitask Benchmark Released',                      '0195f300-0001-7000-a000-000000000004', '2026-02-15'),
    (62, 'SWE-bench Verified: Real GitHub Issues',                             '0195f300-0001-7000-a000-000000000004', '2026-02-20'),
    (63, 'GPQA Diamond: Graduate-Level QA',                                    '0195f300-0001-7000-a000-000000000004', '2026-03-01'),
    (64, 'Frontier Models on MMLU-Pro: March Standings',                       '0195f300-0001-7000-a000-000000000004', '2026-03-15'),
    (65, 'SWE-bench: Agent Framework Comparison',                              '0195f300-0001-7000-a000-000000000004', '2026-03-20'),
    (66, 'Multimodal Benchmark: MMMU Updated',                                '0195f300-0001-7000-a000-000000000004', '2026-03-25'),
    (67, 'Code Generation Benchmark: HumanEval++',                             '0195f300-0001-7000-a000-000000000004', '2026-04-01'),
    (68, 'GPQA Diamond: April Model Rankings',                                 '0195f300-0001-7000-a000-000000000004', '2026-04-05'),
    (69, 'Vision Language Model Benchmark: VQAv3',                             '0195f300-0001-7000-a000-000000000004', '2026-03-30'),
    (70, 'Coding Benchmark Contamination Analysis',                            '0195f300-0001-7000-a000-000000000004', '2026-04-03'),

    -- =================== TOOLS (8 articles) ===================
    (71, 'Cursor 1.0: AI-Native Code Editor',                                  '0195f300-0001-7000-a000-000000000005', '2026-02-28'),
    (72, 'GitHub Copilot Multi-Model Support',                                 '0195f300-0001-7000-a000-000000000005', '2026-03-05'),
    (73, 'Claude Code: Terminal-First AI Agent',                               '0195f300-0001-7000-a000-000000000002', '2026-03-15'),
    (74, 'Cursor + Claude Code Comparison',                                    '0195f300-0001-7000-a000-000000000007', '2026-03-25'),
    (75, 'Docker AI: Containerizing LLM Workloads',                            '0195f300-0001-7000-a000-000000000005', '2026-03-10'),
    (76, 'GitHub Copilot Workspace GA',                                        '0195f300-0001-7000-a000-000000000005', '2026-04-01'),
    (77, 'Cursor Agent Mode Beta',                                              '0195f300-0001-7000-a000-000000000005', '2026-04-03'),
    (78, 'Docker AI Compose: LLM Stack Templates',                             '0195f300-0001-7000-a000-000000000005', '2026-04-05'),

    -- =================== SHARED_RESOURCES (7 articles) ===================
    (79, 'HuggingFace Reaches 1M Models',                                      '0195f300-0001-7000-a000-000000000006', '2026-02-15'),
    (80, 'Papers with Code: LLM Leaderboard Update',                          '0195f300-0001-7000-a000-000000000004', '2026-03-01'),
    (81, 'Awesome LLM: 2026 Q1 Resource Roundup',                             '0195f300-0001-7000-a000-000000000006', '2026-03-15'),
    (82, 'HuggingFace Open LLM Leaderboard v3',                               '0195f300-0001-7000-a000-000000000006', '2026-03-20'),
    (83, 'Papers with Code Trends: Agent Papers Surge',                        '0195f300-0001-7000-a000-000000000004', '2026-03-28'),
    (84, 'HuggingFace Inference Endpoints v2',                                 '0195f300-0001-7000-a000-000000000006', '2026-04-02'),
    (85, 'Awesome LLM: Korean AI Resources',                                   '0195f300-0001-7000-a000-00000000000a', '2026-04-05'),

    -- =================== REGULATIONS (5 articles) ===================
    (86, 'EU AI Act: Implementation Timeline Published',                       '0195f300-0001-7000-a000-000000000007', '2026-02-10'),
    (87, 'NIST AI RMF 2.0 Draft Released',                                    '0195f300-0001-7000-a000-000000000007', '2026-03-01'),
    (88, 'EU AI Act: High-Risk AI Systems List Finalized',                     '0195f300-0001-7000-a000-000000000007', '2026-03-15'),
    (89, 'Korea AI Basic Act: National Assembly Review',                       '0195f300-0001-7000-a000-00000000000a', '2026-03-28'),
    (90, 'NIST AI RMF: Generative AI Profile Published',                       '0195f300-0001-7000-a000-000000000007', '2026-04-03'),

    -- =================== BIG_TECH_TRENDS (5 articles) ===================
    (91, 'MCP Protocol Adoption: 500+ Integrations',                           '0195f300-0001-7000-a000-000000000002', '2026-03-10'),
    (92, 'OpenAI $10B Revenue Run Rate',                                       '0195f300-0001-7000-a000-000000000005', '2026-03-20'),
    (93, 'Google AI Revenue Surpasses Cloud Revenue',                          '0195f300-0001-7000-a000-000000000003', '2026-04-01'),
    (94, 'AI Startup Funding Q1 2026: $25B Record',                            '0195f300-0001-7000-a000-000000000005', '2026-04-03'),
    (95, 'Meta Open Source AI Strategy Payoff',                                '0195f300-0001-7000-a000-000000000008', '2026-04-05'),

    -- =================== THIS_WEEKS_POSTS (5 articles) ===================
    (96, 'Simon Willison: AI Engineering in 2026',                             '0195f300-0001-7000-a000-000000000005', '2026-04-01'),
    (97, 'r/MachineLearning: Best Agent Frameworks',                           '0195f300-0001-7000-a000-000000000005', '2026-04-02'),
    (98, 'Andrej Karpathy: Building with LLMs',                                '0195f300-0001-7000-a000-000000000005', '2026-04-03'),
    (99, 'Hacker News: Self-Hosted LLM Setup Guide',                           '0195f300-0001-7000-a000-000000000005', '2026-04-05'),
    (100,'AI Engineering Blog: RAG vs Fine-Tuning Decision',                   '0195f300-0001-7000-a000-000000000006', '2026-04-06')
    ) AS t(seq, title, source_id, pub_date)
)
LOOP
    i := i + 1;

    v_art_id := ('0195f300-a' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_pub_at := (rec.pub_date || 'T08:00:00Z')::TIMESTAMPTZ;
    v_url    := 'https://example.com/article-' || rec.seq;

    -- Determine language based on source_id
    -- source 0195f300-0001-7000-a000-00000000000a is Korean; all others English
    IF rec.source_id = '0195f300-0001-7000-a000-00000000000a' THEN
        v_lang := 'ko';
    ELSE
        v_lang := 'en';
    END IF;

    INSERT INTO content.article_raw (id, source_id, title, url, published_at, representative_key, language)
    VALUES (
        v_art_id,
        rec.source_id::UUID,
        rec.title,
        v_url,
        v_pub_at,
        'seed-' || rec.seq || '-' || md5(rec.title),
        v_lang
    );

END LOOP;

RAISE NOTICE 'Stage 1: Inserted % article_raw rows.', i;
END $$;

COMMIT;

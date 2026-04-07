-- ============================================================
-- Stage 4 — agent_json_raw UPDATE (Agent Simulation)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stage 0 + Stage 1 + Stage 2 + Stage 3 applied
-- Updates 100 existing PENDING ai_state rows with ONLY:
--   agent_json_raw, ai_model_name, ai_processed_at
-- Does NOT set ai_status (stays PENDING), does NOT set
-- representative_entity_*, ai_summary, ai_score, or parsed columns.
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user_id   UUID := current_setting('cherry.seed_user_id')::UUID;
    v_aai_id    UUID;
    v_uas_id    UUID;
    v_art_id    UUID;
    v_pub_at    TIMESTAMPTZ;
    v_url       VARCHAR(1000);
    v_tags      JSONB;
    v_key_pts   JSONB;
    v_risk_nts  JSONB;
    v_review_type TEXT;
    rec         RECORD;
    i           INT := 0;
BEGIN

FOR rec IN (
    SELECT * FROM (VALUES
    -- (seq, title, entity_id, page, cat_id, cat_name, entity_name, score, summary, why_matters, side_cat)
    -- =================== MODEL_UPDATES (20 articles) ===================
    (1,  'GPT-5.4 Launch: Stronger Coding and Reasoning',                     '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           5, 'GPT-5.4 brings significant improvements in coding reliability and multi-step reasoning.', 'Boosts production agent reliability for complex task chains.', NULL),
    (2,  'GPT-5.4 Benchmark Results: GPQA 92.4%',                            '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           4, 'OpenAI publishes GPQA Diamond results for GPT-5.4 at 92.4%, topping the leaderboard.', 'Validates GPT-5.4 as current SOTA on graduate-level reasoning.', NULL),
    (3,  'GPT-5.4 API Pricing and Availability',                             '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           3, 'OpenAI announces GPT-5.4 API pricing with 30% cost reduction from GPT-5.', 'Lower cost enables broader adoption in cost-sensitive pipelines.', NULL),
    (4,  'Claude 3.7 Sonnet: Extended Thinking Deep Dive',                   '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 5, 'Claude 3.7 Sonnet introduces extended thinking mode for complex reasoning tasks.', 'Game-changer for agentic coding and multi-step analysis tasks.', NULL),
    (5,  'Claude 3.7 Sonnet vs GPT-5.4: Head-to-Head Comparison',           '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 4, 'Independent benchmark comparison shows Claude 3.7 leading in coding while GPT-5.4 leads in math.', 'Helps teams choose the right model for their use case.', NULL),
    (6,  'Gemini 2.0 Flash: 1M Token Context Window',                       '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  4, 'Gemini 2.0 Flash ships with native 1M token context and improved speed.', 'Enables processing entire codebases or long documents in one pass.', NULL),
    (7,  'Gemini 2.0 Flash Multimodal Capabilities',                         '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  3, 'Google demonstrates Gemini 2.0 Flash processing video, audio, and code simultaneously.', 'Opens new multimodal pipeline possibilities.', NULL),
    (8,  'Grok-3 Released: xAI Open-Weights Model',                         '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004', 'xAI Family',       'Grok-3',            4, 'xAI releases Grok-3 with open weights and competitive benchmark scores.', 'Adds another open-weight option for self-hosted deployments.', NULL),
    (9,  'LLaMA 4 Multimodal Architecture',                                  '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           5, 'Meta unveils LLaMA 4 with native vision and improved instruction following.', 'Strongest open-weight multimodal model for self-hosting.', NULL),
    (10, 'LLaMA 4 Fine-Tuning Guide',                                        '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           3, 'Official guide for fine-tuning LLaMA 4 on custom datasets.', 'Practical resource for teams deploying customized LLaMA 4.', NULL),
    (11, 'DeepSeek-R1: Reasoning-First Architecture',                        '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       5, 'DeepSeek introduces R1 with chain-of-thought reasoning baked into architecture.', 'Novel approach to reasoning that competes with much larger models.', NULL),
    (12, 'DeepSeek-R1 Open-Source Release',                                   '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       3, 'DeepSeek-R1 weights and training code now available on HuggingFace.', 'Enables community fine-tuning and research reproduction.', NULL),
    (13, 'Mistral Large 2: European AI Flagship',                            '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007', 'Mistral Family',   'Mistral Large 2',   4, 'Mistral releases Large 2 with multilingual focus and EU data sovereignty.', 'Key option for EU-compliant deployments.', NULL),
    (14, 'GPT-5.4 Enterprise Features Announced',                            '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family',    'GPT-5.4',           3, 'OpenAI adds enterprise-grade audit logs and data residency options to GPT-5.4.', 'Critical for regulated industry adoption.', NULL),
    (15, 'Claude 3.7 Sonnet MCP Integration',                                '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 4, 'Anthropic enables native MCP tool use within Claude 3.7 Sonnet.', 'Simplifies building agentic applications with standardized tool protocols.', NULL),
    (16, 'Gemini 2.0 Flash Grounding with Google Search',                    '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000003', 'Google Family',    'Gemini 2.0 Flash',  3, 'Google integrates real-time search grounding into Gemini 2.0 Flash API.', 'Reduces hallucination for fact-sensitive queries.', NULL),
    (17, 'Grok-3 Mini: Lightweight Version Released',                        '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000004', 'xAI Family',       'Grok-3',            3, 'xAI launches Grok-3 Mini optimized for edge deployment.', 'Enables on-device inference for mobile apps.', NULL),
    (18, 'LLaMA 4 Safety Evaluation Report',                                  '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000005', 'Meta Family',      'LLaMA 4',           3, 'Meta publishes comprehensive safety evaluation for LLaMA 4 across 14 risk categories.', 'Important transparency resource for responsible deployment.', NULL),
    (19, 'DeepSeek-R1 vs Claude 3.7 on Math Benchmarks',                     '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family',  'DeepSeek-R1',       4, 'Independent comparison shows DeepSeek-R1 narrowly leading on MATH and GSM8K.', 'Interesting for math-heavy applications.', NULL),
    (20, 'Mistral Large 2 Function Calling Update',                           '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', '0195f300-2001-7000-a000-000000000007', 'Mistral Family',   'Mistral Large 2',   3, 'Mistral improves function calling accuracy and adds parallel tool execution.', 'Makes Mistral Large 2 more viable for agentic workflows.', NULL),

    -- =================== FRAMEWORKS (25 articles) ===================
    (21, 'LangChain v0.3: Simplified Chain API',                              '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangChain',         4, 'LangChain v0.3 simplifies the chain API with a new declarative syntax.', 'Reduces boilerplate for common LLM application patterns.', NULL),
    (22, 'LangGraph 0.3: State Management Overhaul',                          '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangGraph',         5, 'LangGraph 0.3 introduces persistent state and human-in-the-loop patterns.', 'Essential upgrade for production agent systems.', NULL),
    (23, 'CrewAI Multi-Agent Production Patterns',                            '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'CrewAI',            4, 'CrewAI shares production patterns for orchestrating specialized agent teams.', 'Practical guide for multi-agent system design.', NULL),
    (24, 'AutoGPT v2.0: Web Browsing Agent',                                  '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'AutoGPT',           3, 'AutoGPT v2.0 adds reliable web browsing with improved error recovery.', 'Makes autonomous web research agents more practical.', NULL),
    (25, 'DSPy 2.6: Automatic Prompt Optimization',                           '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013', 'Prompt Engineering','DSPy',              5, 'DSPy 2.6 introduces compiler-based prompt optimization with 40% quality improvement.', 'Removes manual prompt engineering for complex pipelines.', NULL),
    (26, 'DSPy + LangGraph Integration Guide',                                '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000013', 'Prompt Engineering','DSPy',              3, 'Community guide for combining DSPy optimization with LangGraph agent patterns.', 'Best of both worlds for agent prompt optimization.', NULL),
    (27, 'Unsloth 2x Faster QLoRA Fine-Tuning',                               '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'Unsloth',           5, 'Unsloth achieves 2x speed improvement for QLoRA with 50% memory reduction.', 'Enables fine-tuning 70B models on single A100 GPU.', NULL),
    (28, 'LLaMA-Factory: One-Click Fine-Tuning Suite',                        '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'LLaMA-Factory',     4, 'LLaMA-Factory adds web UI and one-click fine-tuning for 100+ model architectures.', 'Democratizes fine-tuning for non-ML engineers.', NULL),
    (29, 'vLLM 0.8: Speculative Decoding Support',                            '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'vLLM',              5, 'vLLM 0.8 adds speculative decoding with 2-3x throughput improvement.', 'Major performance win for high-traffic LLM serving.', NULL),
    (30, 'vLLM Multi-LoRA Serving',                                            '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'vLLM',              3, 'vLLM supports serving multiple LoRA adapters from a single base model.', 'Enables cost-effective multi-tenant LLM serving.', NULL),
    (31, 'Ollama GPU Offloading for Large Models',                             '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'Ollama',            4, 'Ollama adds partial GPU offloading for running 70B+ models on consumer hardware.', 'Makes large model inference accessible to individual developers.', NULL),
    (32, 'LlamaIndex Workflows: Async Event-Driven RAG',                      '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'LlamaIndex',        4, 'LlamaIndex introduces Workflows for building async event-driven RAG pipelines.', 'Clean abstraction for complex multi-step retrieval.', NULL),
    (33, 'ChromaDB 0.5: Distributed Vector Store',                             '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'ChromaDB',          4, 'ChromaDB 0.5 ships distributed mode for horizontal scaling of vector search.', 'Production-ready vector store for large-scale RAG systems.', NULL),
    (34, 'Langfuse 3.0: LLM Cost Dashboard',                                  '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017', 'Observability',    'Langfuse',          4, 'Langfuse 3.0 adds real-time cost tracking and anomaly detection for LLM calls.', 'Essential for managing LLM costs in production.', NULL),
    (35, 'Langfuse + DSPy Evaluation Integration',                             '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000017', 'Observability',    'Langfuse',          3, 'New integration enables tracking DSPy optimization experiments in Langfuse.', 'Unified observability for prompt optimization workflows.', NULL),
    (36, 'RAGFlow: Enterprise RAG with Document Parsing',                      '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'RAGFlow',           4, 'RAGFlow adds deep document parsing with table and chart extraction.', 'Solves the hard problem of structured document retrieval.', NULL),
    (37, 'Haystack 2.0: Pipeline-First Architecture',                          '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'Haystack',          4, 'Haystack 2.0 adopts pipeline-first architecture with component protocol.', 'Clean separation of concerns for RAG system design.', NULL),
    (38, 'MLflow 3.0: LLM Tracking and Evaluation',                           '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000016', 'LLMOps',           'MLflow',            3, 'MLflow 3.0 adds native LLM experiment tracking and automated evaluation.', 'Brings ML lifecycle management to LLM workflows.', NULL),
    (39, 'RAGAS v0.2: Comprehensive RAG Evaluation',                           '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000012', 'RAG',              'RAGAS',             4, 'RAGAS v0.2 introduces faithfulness, relevance and context precision metrics.', 'Standard evaluation framework for RAG pipeline quality.', NULL),
    (40, 'MCP Protocol: Standardizing Tool Use',                               '0195f300-1001-7000-b000-000000000062', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'MCP Protocol',      5, 'Anthropic Model Context Protocol becomes the de facto standard for LLM tool integration.', 'Standardizes how AI models interact with external tools and data.', NULL),
    (41, 'LangChain + MCP: Unified Tool Protocol',                             '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'LangChain',         3, 'LangChain adds native MCP support for standardized tool calling.', 'Simplifies multi-tool agent development.', NULL),
    (42, 'CrewAI Enterprise: Team Agent Orchestration',                        '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000010', 'Agent',             'CrewAI',            3, 'CrewAI launches enterprise version with role-based agent access control.', 'Addresses enterprise security needs for multi-agent systems.', NULL),
    (43, 'Unsloth GaLore: Memory-Efficient Full Fine-Tuning',                  '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000011', 'Fine-Tuning',      'Unsloth',           4, 'Unsloth integrates GaLore for full fine-tuning with LoRA-level memory usage.', 'Breaks the LoRA quality ceiling without memory penalty.', NULL),
    (44, 'Ollama Windows Native Support',                                      '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000014', 'Serving',           'Ollama',            3, 'Ollama ships native Windows support with DirectML GPU acceleration.', 'Expands local LLM access to Windows developers.', NULL),
    (45, 'LlamaIndex Property Graph RAG',                                      '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', '0195f300-2001-7000-a000-000000000015', 'Data & Storage',   'LlamaIndex',        4, 'LlamaIndex adds property graph index for structured knowledge retrieval.', 'Combines vector search with graph-based reasoning.', NULL),

    -- =================== CASE_STUDIES (15 articles) ===================
    (46, 'Netomi Deploys GPT-5.4 for Customer Support',                        '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'Netomi AI Support', 3, 'Netomi achieves 85% resolution rate using GPT-5.4 for automated customer support.', 'Validates GPT-5.4 for production customer service automation.', 'CASE_STUDY'),
    (47, 'HIPAA-Compliant AI with OpenAI Enterprise',                          '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           3, 'Healthcare startup deploys GPT-5.4 Enterprise with HIPAA compliance.', 'Shows path to AI adoption in regulated healthcare.', 'CASE_STUDY'),
    (48, 'Tolan AI Voice Agent with GPT-5.4',                                  '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           3, 'Tolan builds real-time AI voice agent using GPT-5.4 with sub-500ms latency.', 'Demonstrates feasibility of production voice AI agents.', 'CASE_STUDY'),
    (49, 'AutoBNN: Google Weather Forecasting',                                '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'AutoBNN',           3, 'Google applies AutoBNN to weather forecasting with 15% accuracy improvement.', 'Novel ML approach outperforms traditional meteorological models.', 'APPLIED_RESEARCH'),
    (50, 'Google AutoBNN Architecture Details',                                '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'AutoBNN',           3, 'Deep dive into AutoBNN architecture and training methodology.', 'Useful reference for Bayesian neural network practitioners.', 'APPLIED_RESEARCH'),
    (51, 'MedPaLM NHS Lung Cancer Screening',                                 '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'MedPaLM',           4, 'NHS pilot uses MedPaLM for lung cancer screening with 92% sensitivity.', 'Promising clinical AI application with significant health impact.', 'APPLIED_RESEARCH'),
    (52, 'Claude 3.7 for Legal Document Analysis',                             '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', 4, 'Law firm deploys Claude 3.7 for contract analysis with 90% accuracy.', 'Shows Claude effectiveness for complex document understanding.', 'CASE_STUDY'),
    (53, 'Claude 3.7 Agentic Coding at Scale',                                '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', 5, 'Tech company uses Claude 3.7 extended thinking for autonomous code migration.', 'Demonstrates viability of AI-driven large-scale code refactoring.', 'CASE_STUDY'),
    (54, 'Copilot Workspace: AI-Driven Dev Environment',                       '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', 4, 'GitHub Copilot Workspace achieves 40% productivity improvement in beta.', 'Validates AI-first development environment concept.', 'CASE_STUDY'),
    (55, 'Microsoft Azure AI Studio Enterprise Deployment',                    '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', 3, 'Enterprise deploys Azure AI Studio for unified LLM management.', 'Practical guide for enterprise AI platform adoption.', 'CASE_STUDY'),
    (56, 'OpenAI API in Korean Fintech',                                       '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000020', 'OpenAI',    'GPT-5.4',           3, 'Korean fintech startup uses GPT-5.4 for fraud detection with 95% precision.', 'Shows GPT-5.4 applicability in financial compliance.', 'CASE_STUDY'),
    (57, 'Google Gemini in Education Platform',                                '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'Gemini 2.0 Flash',  3, 'EdTech platform integrates Gemini 2.0 Flash for personalized tutoring.', 'Demonstrates multimodal AI in education.', 'CASE_STUDY'),
    (58, 'Anthropic Claude in Healthcare Records',                             '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000022', 'Anthropic', 'Claude 3.7 Sonnet', 4, 'Research paper on Claude 3.7 for medical record summarization.', 'Shows promise for reducing clinician documentation burden.', 'APPLIED_RESEARCH'),
    (59, 'Microsoft Copilot in Supply Chain',                                  '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000023', 'Microsoft', 'Copilot Workspace', 3, 'Logistics company uses Copilot for supply chain optimization.', 'AI-assisted demand forecasting reduces waste by 20%.', 'CASE_STUDY'),
    (60, 'Google MedPaLM Radiology Assistant',                                 '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', '0195f300-2001-7000-a000-000000000021', 'Google',    'MedPaLM',           4, 'MedPaLM assists radiologists with 88% concordance on chest X-ray findings.', 'Advancing AI-assisted medical imaging interpretation.', 'APPLIED_RESEARCH'),

    -- =================== PAPER_BENCHMARK (10 articles) ===================
    (61, 'MMLU-Pro: Harder Multitask Benchmark Released',                      '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     4, 'MMLU-Pro introduces harder questions filtered from original MMLU with reasoning chains.', 'New standard benchmark for evaluating frontier model capabilities.', NULL),
    (62, 'SWE-bench Verified: Real GitHub Issues',                             '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    5, 'SWE-bench Verified curates human-validated GitHub issues for code generation eval.', 'Gold standard for evaluating AI coding capabilities on real-world tasks.', NULL),
    (63, 'GPQA Diamond: Graduate-Level QA',                                    '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'GPQA Diamond', 4, 'GPQA Diamond includes PhD-level questions across physics, biology, and chemistry.', 'Distinguishes frontier models from near-frontier.', NULL),
    (64, 'Frontier Models on MMLU-Pro: March Standings',                       '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     3, 'Monthly leaderboard update shows GPT-5.4 and Claude 3.7 neck and neck on MMLU-Pro.', 'Useful tracking of frontier model progress.', NULL),
    (65, 'SWE-bench: Agent Framework Comparison',                              '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    4, 'Comparison of SWE-agent, AutoCodeRover, and Devin on SWE-bench Verified.', 'Reveals which agentic approaches solve real coding tasks best.', NULL),
    (66, 'Multimodal Benchmark: MMMU Updated',                                '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'MMLU-Pro',     3, 'MMMU benchmark updated with harder visual reasoning tasks.', 'Better evaluation of multimodal understanding capabilities.', NULL),
    (67, 'Code Generation Benchmark: HumanEval++',                             '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    3, 'HumanEval++ adds edge cases and security tests to original HumanEval.', 'More robust evaluation of code generation safety and correctness.', NULL),
    (68, 'GPQA Diamond: April Model Rankings',                                 '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000030', 'NLP',        'GPQA Diamond', 3, 'April GPQA Diamond rankings show GPT-5.4 at 92.4% and Claude 3.7 at 91.0%.', 'Monthly tracking of graduate-level reasoning capabilities.', NULL),
    (69, 'Vision Language Model Benchmark: VQAv3',                             '0195f300-1001-7000-b000-000000000003', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000031', 'Multimodal', 'Gemini 2.0 Flash',  3, 'VQAv3 evaluates visual question answering with multi-hop reasoning.', 'Differentiates genuine visual understanding from pattern matching.', NULL),
    (70, 'Coding Benchmark Contamination Analysis',                            '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', '0195f300-2001-7000-a000-000000000032', 'Coding',     'SWE-bench',    4, 'Study finds significant contamination in HumanEval; SWE-bench remains clean.', 'Important finding for benchmark integrity and model evaluation.', NULL),

    -- =================== TOOLS (8 articles) ===================
    (71, 'Cursor 1.0: AI-Native Code Editor',                                  '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        5, 'Cursor 1.0 launches with composer mode for multi-file AI editing.', 'Redefines the code editor experience with AI-first design.', NULL),
    (72, 'GitHub Copilot Multi-Model Support',                                 '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'GitHub Copilot',4, 'Copilot now supports GPT-5.4, Claude 3.7, and Gemini as backend models.', 'Users can choose the best model for their coding style.', NULL),
    (73, 'Claude Code: Terminal-First AI Agent',                               '0195f300-1001-7000-b000-000000000022', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Claude Code',   5, 'Anthropic launches Claude Code for autonomous coding tasks from the terminal.', 'New paradigm for AI-assisted development without IDE dependency.', NULL),
    (74, 'Cursor + Claude Code Comparison',                                    '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        3, 'Head-to-head comparison of Cursor and Claude Code for different development workflows.', 'Helps developers choose the right AI coding tool.', NULL),
    (75, 'Docker AI: Containerizing LLM Workloads',                            '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041', 'Infrastructure','Docker AI',     3, 'Docker adds AI-specific container templates for LLM serving.', 'Simplifies deployment of ML workloads in container environments.', NULL),
    (76, 'GitHub Copilot Workspace GA',                                        '0195f300-1001-7000-b000-000000000021', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'GitHub Copilot',4, 'GitHub Copilot Workspace exits beta with issue-to-PR automation.', 'Automates the entire development workflow from issue to implementation.', NULL),
    (77, 'Cursor Agent Mode Beta',                                              '0195f300-1001-7000-b000-000000000020', 'TOOLS', '0195f300-2001-7000-a000-000000000040', 'IDE & Plugin', 'Cursor',        4, 'Cursor launches agent mode for autonomous multi-file project changes.', 'Brings agentic coding to the IDE with visual diff review.', NULL),
    (78, 'Docker AI Compose: LLM Stack Templates',                             '0195f300-1001-7000-b000-000000000023', 'TOOLS', '0195f300-2001-7000-a000-000000000041', 'Infrastructure','Docker AI',     3, 'Docker AI Compose provides one-click deployment for common LLM stacks.', 'Reduces LLM infrastructure setup time from hours to minutes.', NULL),

    -- =================== SHARED_RESOURCES (7 articles) ===================
    (79, 'HuggingFace Reaches 1M Models',                                      '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      4, 'HuggingFace Hub surpasses 1 million publicly available models.', 'Milestone for open-source ML ecosystem growth.', NULL),
    (80, 'Papers with Code: LLM Leaderboard Update',                          '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'Papers with Code', 3, 'Papers with Code launches unified LLM leaderboard across 50+ benchmarks.', 'Central tracking for model performance comparison.', NULL),
    (81, 'Awesome LLM: 2026 Q1 Resource Roundup',                             '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051', 'Tutorial',  'Awesome LLM',      3, 'Quarterly roundup of best LLM resources, tutorials, and papers from Q1 2026.', 'Curated starting point for new AI engineers.', NULL),
    (82, 'HuggingFace Open LLM Leaderboard v3',                               '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      4, 'HuggingFace launches Open LLM Leaderboard v3 with new evaluation suite.', 'Improved evaluation methodology for open-source model comparison.', NULL),
    (83, 'Papers with Code Trends: Agent Papers Surge',                        '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'Papers with Code', 3, 'Agent-related papers increase 300% YoY according to Papers with Code data.', 'Confirms agent architectures as dominant research trend.', NULL),
    (84, 'HuggingFace Inference Endpoints v2',                                 '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000050', 'Model Hub', 'HuggingFace',      3, 'HuggingFace Inference Endpoints v2 adds auto-scaling and GPU optimization.', 'One-click model deployment for production use.', NULL),
    (85, 'Awesome LLM: Korean AI Resources',                                   '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', '0195f300-2001-7000-a000-000000000051', 'Tutorial',  'Awesome LLM',      3, 'Community-curated list of Korean-language LLM resources and tutorials.', 'Growing Korean AI ecosystem resources.', NULL),

    -- =================== REGULATIONS (5 articles) ===================
    (86, 'EU AI Act: Implementation Timeline Published',                       '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   5, 'European Commission publishes detailed implementation timeline for AI Act.', 'Critical compliance milestone for AI companies operating in EU.', NULL),
    (87, 'NIST AI RMF 2.0 Draft Released',                                    '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'NIST AI RMF', 4, 'NIST releases draft update to AI Risk Management Framework with LLM-specific guidance.', 'New standard for responsible LLM deployment in US market.', NULL),
    (88, 'EU AI Act: High-Risk AI Systems List Finalized',                     '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   4, 'EU finalizes the list of high-risk AI systems requiring conformity assessment.', 'Determines which AI systems face strictest compliance requirements.', NULL),
    (89, 'Korea AI Basic Act: National Assembly Review',                       '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'EU AI Act',   3, 'Korean National Assembly begins review of AI Basic Act legislation.', 'Key development for Korean AI industry regulatory framework.', NULL),
    (90, 'NIST AI RMF: Generative AI Profile Published',                       '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', '0195f300-2001-7000-a000-000000000060', 'International', 'NIST AI RMF', 4, 'NIST publishes Generative AI Profile companion to AI RMF 2.0 draft.', 'Specific guidance for managing generative AI risks.', NULL),

    -- =================== BIG_TECH_TRENDS (5 articles) ===================
    (91, 'MCP Protocol Adoption: 500+ Integrations',                           '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'MCP Protocol', 5, 'Anthropic MCP Protocol reaches 500+ community integrations in 3 months.', 'Fastest-growing standard for AI tool integration.', NULL),
    (92, 'OpenAI $10B Revenue Run Rate',                                       '0195f300-1001-7000-b000-000000000001', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'GPT-5.4',      4, 'OpenAI reaches $10B annual revenue run rate driven by enterprise adoption.', 'Validates the AI business model at scale.', NULL),
    (93, 'Google AI Revenue Surpasses Cloud Revenue',                          '0195f300-1001-7000-b000-000000000003', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'Gemini 2.0 Flash',  4, 'Google AI products revenue exceeds traditional cloud revenue for first time.', 'Major shift in tech industry revenue composition.', NULL),
    (94, 'AI Startup Funding Q1 2026: $25B Record',                            '0195f300-1001-7000-b000-000000000062', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',    'MCP Protocol', 3, 'AI startup funding reaches $25B in Q1 2026, setting quarterly record.', 'Capital continues flowing into AI despite broader market caution.', NULL),
    (95, 'Meta Open Source AI Strategy Payoff',                                '0195f300-1001-7000-b000-000000000005', 'BIG_TECH_TRENDS', '0195f300-2001-7000-a000-000000000070', 'FAANG',   'LLaMA 4',      4, 'Meta open-source strategy drives LLaMA 4 to 100M+ downloads.', 'Open-source AI as competitive moat strategy validated.', NULL),

    -- =================== THIS_WEEKS_POSTS (5 articles) ===================
    (96, 'Simon Willison: AI Engineering in 2026',                             '0195f300-1001-7000-b000-000000000062', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'MCP Protocol', 4, 'Simon Willison shares predictions for AI engineering trends in 2026.', 'Insightful perspective from a respected AI practitioner.', NULL),
    (97, 'r/MachineLearning: Best Agent Frameworks',                           '0195f300-1001-7000-b000-000000000010', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000080', 'Community', 'LangChain',    3, 'Reddit community discusses pros and cons of current agent frameworks.', 'Useful community consensus on framework selection.', NULL),
    (98, 'Andrej Karpathy: Building with LLMs',                                '0195f300-1001-7000-b000-000000000001', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'GPT-5.4',      5, 'Karpathy shares practical lessons from building production LLM systems.', 'Must-read for AI engineers from a leading practitioner.', NULL),
    (99, 'Hacker News: Self-Hosted LLM Setup Guide',                           '0195f300-1001-7000-b000-000000000018', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000080', 'Community', 'Ollama',       3, 'Popular HN guide for setting up self-hosted LLM with Ollama and vLLM.', 'Practical guide for privacy-conscious deployments.', NULL),
    (100,'AI Engineering Blog: RAG vs Fine-Tuning Decision',                   '0195f300-1001-7000-b000-00000000001c', 'THIS_WEEKS_POSTS', '0195f300-2001-7000-a000-000000000081', 'Blog',      'RAGFlow',      4, 'Comprehensive decision framework for choosing between RAG and fine-tuning.', 'Answers the most common AI engineering architecture question.', NULL)
    ) AS t(seq, title, entity_id, page, cat_id, cat_name, entity_name, score, summary, why_matters, side_cat)
)
LOOP
    i := i + 1;

    v_uas_id  := ('0195f300-b' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_aai_id  := ('0195f300-c' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;
    v_art_id  := ('0195f300-a' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;

    -- Look up published_at from article_raw
    SELECT published_at INTO v_pub_at FROM content.article_raw WHERE id = v_art_id;
    v_url := 'https://example.com/article-' || rec.seq;

    -- Build tags JSON
    v_tags := jsonb_build_array(
        jsonb_build_object('kind', 'TAG', 'value', lower(rec.entity_name)),
        jsonb_build_object('kind', 'TAG', 'value', lower(replace(rec.cat_name, ' ', '-'))),
        jsonb_build_object('kind', 'KEYWORD', 'value', lower(rec.page::TEXT), 'frequency', (3 + rec.score), 'confidence', round(0.6 + rec.score * 0.08, 2))
    );

    -- Build key_points and risk_notes
    v_key_pts := jsonb_build_array(
        'Key update for ' || rec.entity_name,
        rec.cat_name || ' category development'
    );
    v_risk_nts := jsonb_build_array(
        'Verify claims with independent benchmarks'
    );

    -- Determine review type for ai_structured_extraction_json
    IF rec.side_cat = 'CASE_STUDY' THEN
        v_review_type := 'Case Study';
    ELSIF rec.side_cat = 'APPLIED_RESEARCH' THEN
        v_review_type := 'Applied Research';
    ELSE
        v_review_type := 'Announcement';
    END IF;

    -- UPDATE only agent_json_raw, ai_model_name, ai_processed_at
    -- ai_status stays PENDING; no parsed columns set
    UPDATE content.user_article_ai_state
    SET
        agent_json_raw = jsonb_build_object(
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
                'key_points', v_key_pts,
                'risk_notes', v_risk_nts
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
                'review', jsonb_build_object('type', v_review_type, 'reviewer', NULL, 'comment', NULL)
            )
        ),
        ai_model_name = 'claude-3.7-sonnet',
        ai_processed_at = v_pub_at + INTERVAL '2 hours'
    WHERE id = v_aai_id;

END LOOP;

RAISE NOTICE 'Stage 4: Updated % ai_state rows with agent_json_raw.', i;
END $$;

COMMIT;

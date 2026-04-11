-- ============================================================
-- Stage 4 Extra NEW — 200개 agent_json_raw UPDATE (PENDING 상태 유지)
-- seq 301 ~ 500 / article_raw ID: 0195f300-c{seq:03d}-...
-- user_id: SYSTEM_USER_ID = 00000000-0000-0000-0000-000000000000
-- agent_json_raw: v0.3 format (representative_entity nested object)
-- ai_status: PENDING으로 유지 → parse-agent-json API 호출 후 SUCCESS
--
-- Prerequisites:
--   stage-1-extra-new-200.sql 적용
--   + API ingest-bulk 호출 (user_article_state 생성)
--   + API pregen-ai-state 호출 (PENDING ai_state 생성)
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user_id   UUID := '00000000-0000-0000-0000-000000000000'::UUID;
    v_art_id    UUID;
    v_uas_id    UUID;
    v_aai_id    UUID;
    v_pub_at    TIMESTAMPTZ;
    rec         RECORD;
    i           INT := 0;
    skipped     INT := 0;
BEGIN

FOR rec IN (
    SELECT * FROM (VALUES
    -- (seq, entity_id, page, score, summary)
    -- =================== FRAMEWORKS: Agent ===================
    -- LangChain (301-308)
    (301, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 4, 'LangChain v0.4 introduces a structured output API that enforces type-safe JSON responses using Pydantic schemas.'),
    (302, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'LangChain LCEL streaming latency is reduced by 30% in v0.4.2 through optimized async generator handling.'),
    (303, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'A practical guide covers building production RAG with LangChain and PGVector, including indexing and retrieval tuning.'),
    (304, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 4, 'LangChain tool calling protocol now supports parallel tool execution, enabling concurrent API calls from a single agent step.'),
    (305, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'Best practices for LangChain memory management cover windowed buffer, summary memory, and entity tracking for long conversations.'),
    (306, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'A 2026 comparison between LangChain and LlamaIndex evaluates API ergonomics, community size, and production readiness for RAG.'),
    (307, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 4, 'LangChain agents now support the Anthropic Computer Use tool interface, enabling browser and desktop automation.'),
    (308, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'The LangChain Runnable interface enables declarative composition of complex AI pipelines with streaming and async support.'),
    -- LangGraph (309-316)
    (309, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 5, 'LangGraph 0.4 introduces cross-thread memory that persists agent state across multiple conversation sessions.'),
    (310, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 4, 'LangGraph Studio provides a visual debugger for inspecting agent state, edges, and conditional transitions at runtime.'),
    (311, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 4, 'The LangGraph subgraph pattern enables modular multi-agent architecture with independent lifecycle management per agent.'),
    (312, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 4, 'LangGraph time travel allows developers to rewind agent state to any prior checkpoint for debugging complex task failures.'),
    (313, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 3, 'Building reliable coding agents with LangGraph checkpointing enables recovery from failures mid-task without data loss.'),
    (314, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 4, 'LangGraph Cloud provides managed agent hosting with auto-scaling, monitoring, and zero-downtime deployment support.'),
    (315, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 4, 'LangGraph interrupt pattern enables safe human-in-the-loop workflows where agents pause and await user approval.'),
    (316, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 3, 'A scalability comparison between LangGraph and AutoGen evaluates throughput, developer experience, and enterprise readiness.'),
    -- CrewAI (317-323)
    (317, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 4, 'CrewAI 1.0 brings a stable API with enhanced task delegation engine supporting priority queues and retry policies.'),
    (318, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 4, 'CrewAI Flow feature enables linear and conditional agent orchestration without the complexity of graph-based routing.'),
    (319, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 3, 'CrewAI adds knowledge graph integration for context-rich agent tasks, enabling entity-aware reasoning across domains.'),
    (320, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 3, 'CrewAI Enterprise introduces role-based access control for multi-agent systems with audit trails and team management.'),
    (321, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 3, 'A developer experience and scalability comparison between CrewAI and LangGraph in 2026 favors LangGraph for large deployments.'),
    (322, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 3, 'CrewAI custom tool integration guide covers building domain-specific agent capabilities with typed tool schemas.'),
    (323, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 4, 'CrewAI async task execution reduces agent pipeline latency by 45% through concurrent agent step processing.'),
    -- AutoGPT (324-330)
    (324, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 3, 'AutoGPT Server now supports webhook triggers enabling event-driven automation from external system notifications.'),
    (325, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 4, 'AutoGPT Agent Protocol standardizes inter-agent communication, enabling interoperability across different agent frameworks.'),
    (326, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 3, 'AutoGPT benchmark results measure autonomous agent task completion rates across coding, research, and web tasks.'),
    (327, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 2, 'The AutoGPT plugins ecosystem grows to 200+ community-built integrations covering search, email, and database tools.'),
    (328, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 3, 'AutoGPT migrates its memory backend from Redis to PostgreSQL for improved reliability and query capability.'),
    (329, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 4, 'AutoGPT safety constraints framework prevents unintended destructive actions in autonomous multi-step agent tasks.'),
    (330, '0195f300-1001-7000-b000-000000000013', 'FRAMEWORKS', 3, 'AutoGPT cost control system manages token budgets for long-running agent tasks, preventing runaway API spending.'),
    -- =================== FRAMEWORKS: Fine-Tuning ===================
    -- Unsloth (331-337)
    (331, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 5, 'Unsloth adds support for Llama 4 Maverick 400B fine-tuning on 4 consumer GPUs via dynamic 4-bit quantization.'),
    (332, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 3, 'A quality comparison between Unsloth QLoRA and full fine-tuning on medical benchmarks shows 97% quality retention.'),
    (333, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 4, 'Unsloth dynamic quantization preserves 99.3% model quality at 2x training speed compared to standard LoRA training.'),
    (334, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 3, 'Unsloth chat templates enable fine-tuning for multi-turn instruction following with Alpaca and ChatML formats.'),
    (335, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 3, 'Unsloth Colab notebooks now support H100 SXM instances for faster fine-tuning of 70B parameter models.'),
    (336, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 4, 'Unsloth ORPO training achieves preference alignment without a reference model, reducing compute cost by 35%.'),
    (337, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 3, 'A comparison between Unsloth and Axolotl in 2026 evaluates speed, hardware compatibility, and configuration ergonomics.'),
    -- LLaMA-Factory (338-344)
    (338, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 4, 'LLaMA-Factory v0.9.2 adds GRPO reinforcement learning from human feedback for preference optimization.'),
    (339, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 4, 'LLaMA-Factory multi-GPU DDP training scales to 8xH100 without code changes using the DeepSpeed ZeRO-3 backend.'),
    (340, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 3, 'LLaMA-Factory evaluation module supports MMLU and HumanEval out of the box for rapid capability benchmarking.'),
    (341, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 3, 'LLaMA-Factory reward model training guide covers data formatting, training stability, and evaluation for RLHF pipelines.'),
    (342, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 3, 'A step-by-step guide covers Korean language fine-tuning with LLaMA-Factory for specialized Ko-LLM development.'),
    (343, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 4, 'LLaMA-Factory Web UI v2 introduces drag-and-drop dataset preparation with format validation and preview.'),
    (344, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 3, 'LLaMA-Factory GCP integration guide covers fine-tuning on TPU v5 pods with XLA compilation optimization.'),
    -- =================== FRAMEWORKS: RAG ===================
    -- RAGFlow (351-357)
    (351, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 5, 'RAGFlow v0.15 launches agentic RAG mode with iterative self-querying for complex multi-hop question answering.'),
    (352, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 4, 'RAGFlow DeepDoc v2 achieves 60% improvement in PDF table extraction through layout-aware parsing algorithms.'),
    (353, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 3, 'RAGFlow knowledge base versioning enables A/B testing of chunking and retrieval strategies with rollback support.'),
    (354, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 4, 'RAGFlow multimodal RAG processes images, tables, and text jointly for improved cross-modal question answering.'),
    (355, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 3, 'RAGFlow reranking pipeline comparison shows cross-encoder rerankers outperform LLM rerankers on factual tasks.'),
    (356, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 4, 'RAGFlow scales to 100M document chunks using distributed Elasticsearch backend with shard-level indexing.'),
    (357, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 3, 'RAGFlow REST API redesign follows OpenAPI 3.1 spec with typed SDK generation for TypeScript and Python.'),
    -- Haystack (358-364)
    (358, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 4, 'Haystack 2.1 async pipeline execution halves latency for complex RAG flows through concurrent component processing.'),
    (359, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 4, 'Haystack Agent component enables tool-using RAG pipelines where agents can search, calculate, and verify answers.'),
    (360, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack evaluation framework provides automated quality gates for RAG pipelines integrated into CI/CD workflows.'),
    (361, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack DocumentSplitter strategies guide covers sentence, word, and recursive chunking for optimal retrieval.'),
    (362, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack OpenSearch integration adds BM25 keyword search alongside KNN vector search for hybrid retrieval.'),
    (363, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack Prompt Hub enables versioned prompt management with collaborative editing for NLP pipeline teams.'),
    (364, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack telemetry dashboard provides real-time component performance metrics for production pipeline monitoring.'),
    -- RAGAS (365-370)
    (365, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 4, 'RAGAS v0.3 introduces LLM-as-Judge evaluation with customizable rubric definition for domain-specific assessment.'),
    (366, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 4, 'RAGAS synthetic data generation builds evaluation datasets at scale from source documents using LLM prompting.'),
    (367, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 4, 'RAGAS faithfulness score detects hallucination in 94% of RAG failure cases by comparing claims to retrieved context.'),
    (368, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 3, 'RAGAS context utilization metric reveals retrieval redundancy where 30% of chunks contribute no information.'),
    (369, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 3, 'RAGAS CI/CD integration enables automated RAG quality gates in GitHub Actions with configurable thresholds.'),
    (370, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 3, 'A RAGAS benchmark compares OpenAI, Anthropic, and Gemini as judge models for cost-quality tradeoff analysis.'),
    -- =================== FRAMEWORKS: Serving ===================
    -- vLLM (371-380)
    (371, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 4, 'vLLM v0.9 adds prefix caching that reduces TTFT by 60% for multi-turn conversations with repeated system prompts.'),
    (372, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 4, 'vLLM LoRA serving enables hot-swap of fine-tuned adapters between requests without model reload overhead.'),
    (373, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM tensor parallelism guide covers model sharding across multiple GPUs for serving 70B+ parameter models.'),
    (374, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 5, 'vLLM disaggregated prefill architecture reduces TTFT by 50% by separating prefill and decode computation.'),
    (375, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM production monitoring guide covers Prometheus metrics, Grafana dashboards, and alerting configuration.'),
    (376, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 4, 'vLLM benchmark 2026 shows top throughput versus TGI, TensorRT-LLM, and SGLang across popular model sizes.'),
    (377, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 4, 'vLLM FP8 quantization support doubles token throughput on H100 GPUs with less than 1% quality degradation.'),
    (378, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM multi-model serving guide covers running 10+ models concurrently on a single node via time-sliced scheduling.'),
    (379, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM GKE Autopilot deployment guide covers serverless LLM inference with Kubernetes HPA auto-scaling.'),
    (380, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM AWS SageMaker integration enables production inference with managed endpoints and automatic scaling.'),
    -- =================== FRAMEWORKS: Data & Storage ===================
    -- LlamaIndex (391-397)
    (391, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 4, 'LlamaIndex multi-tenancy index provides isolated knowledge bases per user or organization with access controls.'),
    (392, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 3, 'LlamaIndex structured extraction converts unstructured documents to Pydantic models for type-safe downstream use.'),
    (393, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 3, 'LlamaIndex ingestion pipeline supports async document processing with deduplication via content hash checks.'),
    (394, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 4, 'LlamaIndex auto-retriever translates natural language questions to vector store queries with metadata filters.'),
    (395, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 4, 'LlamaIndex LlamaParse achieves best-in-class PDF and table extraction accuracy for enterprise RAG pipelines.'),
    (396, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 3, 'LlamaIndex production caching with Redis-backed LLM and embedding response cache reduces API costs by 40%.'),
    (397, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 3, 'A LlamaIndex benchmark compares 15 embedding models on retrieval accuracy across domain-specific corpora.'),
    -- ChromaDB (398-404)
    (398, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 4, 'ChromaDB 0.7 launches distributed mode for horizontal scaling across multiple nodes with consistent hashing.'),
    (399, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB HNSW index tuning guide covers ef_construction and M parameters for recall-speed tradeoff optimization.'),
    (400, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB full-text search integration combines BM25 keyword search with semantic vector retrieval for hybrid RAG.'),
    (401, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB access control adds API key authentication and collection-level read/write permission management.'),
    (402, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB S3 backup and restore enables point-in-time recovery for production vector store disaster scenarios.'),
    (403, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB embedded mode vs client-server architecture comparison covers performance tradeoffs for different use cases.'),
    (404, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 3, 'ChromaDB multi-vector document support stores dense and sparse vectors together for flexible hybrid retrieval.'),
    -- =================== FRAMEWORKS: LLMOps ===================
    -- MLflow (411-417)
    (411, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 4, 'MLflow 3.1 introduces a prompt registry with version control, rollback, and A/B testing for production LLMs.'),
    (412, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 3, 'MLflow model serving enables one-click deployment to AWS Lambda for serverless LLM inference at variable load.'),
    (413, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 4, 'MLflow LLM Judge provides automated quality evaluation using LLM-as-Judge with configurable criteria and scoring.'),
    (414, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 3, 'MLflow experiment comparison UI adds parallel coordinate plots for visualizing hyperparameter sweep results.'),
    (415, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 3, 'MLflow dataset versioning automatically tracks training data lineage using content hashes and metadata.'),
    (416, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 3, 'MLflow integration with Databricks Unity Catalog provides enterprise governance with access controls and auditing.'),
    (417, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 3, 'A total cost comparison between self-hosted and managed MLflow reveals 40% savings for teams over 20 engineers.'),
    -- =================== FRAMEWORKS: Observability ===================
    -- Langfuse (431-437)
    (431, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 4, 'Langfuse 3.1 adds real-time cost anomaly detection that alerts teams when LLM spending exceeds configured thresholds.'),
    (432, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'Langfuse prompt management v2 adds template variables and dynamic injection for runtime context customization.'),
    (433, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'Langfuse evaluation pipeline automates LLM quality scoring in CI/CD with threshold-based pass/fail gating.'),
    (434, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'A 5-minute guide covers Langfuse self-hosted deployment on Railway with Docker Compose and PostgreSQL.'),
    (435, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'Langfuse multimodal tracing captures image and audio inputs alongside text in LLM call trace records.'),
    (436, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'Langfuse achieves SOC 2 Type II compliance for enterprise deployments requiring data residency guarantees.'),
    (437, '0195f300-1001-7000-b000-00000000001b', 'FRAMEWORKS', 3, 'A comparison between Langfuse and LangSmith evaluates observability features, pricing, and self-hosting options.'),
    -- =================== CASE_STUDIES ===================
    -- Claude 3.7 Sonnet (CS:Anthropic)
    (451, '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', 4, 'Stripe deploys Claude 3.7 Sonnet for automated fraud detection, processing 10M TPS with 99.8% accuracy.'),
    (452, '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', 3, 'Notion AI document summarization powered by Claude 3.7 delivers 40% productivity gain measured across 5000 users.'),
    (453, '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', 4, 'Salesforce Einstein GPT integrates Claude 3.7 for CRM workflow automation across sales and service clouds.'),
    (454, '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', 4, 'A legal tech startup uses Claude 3.7 for contract analysis, saving 80% of attorney review time per contract.'),
    (455, '0195f300-1001-7000-b000-000000000002', 'CASE_STUDIES', 3, 'A healthcare provider adopts Claude 3.7 for clinical note summarization across 500 physicians at scale.'),
    -- GPT-5.4 (CS:OpenAI)
    (456, '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', 4, 'JPMorgan deploys GPT-5.4 for automated equity research report generation, cutting analyst time by 50%.'),
    (457, '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', 3, 'Microsoft Copilot for M365 upgrades to GPT-5.4 for all enterprise users, improving task completion by 30%.'),
    (458, '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', 3, 'Duolingo uses GPT-5.4 for personalized language learning conversations, increasing lesson completion by 25%.'),
    (459, '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', 4, 'Khan Academy Khanmigo upgrades to GPT-5.4, improving student outcomes by 25% on standardized test simulations.'),
    (460, '0195f300-1001-7000-b000-000000000001', 'CASE_STUDIES', 4, 'An e-commerce giant cuts customer support costs by 60% using GPT-5.4 for first-line ticket resolution.'),
    -- Gemini 2.0 Flash (CS:Google)
    (461, '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', 4, 'YouTube enhances its recommender system with Gemini 2.0 Flash for multimodal thumbnail and content analysis.'),
    (462, '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', 3, 'Google Search AI Overviews powered by Gemini 2.0 Flash processes 500M daily queries with sub-500ms latency.'),
    (463, '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', 4, 'Waymo uses Gemini 2.0 Flash for real-time scene understanding in autonomous vehicle perception pipelines.'),
    (464, '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', 4, 'Google Cloud Healthcare API adds Gemini 2.0 Flash for medical image analysis with FDA-submission-ready accuracy.'),
    (465, '0195f300-1001-7000-b000-000000000003', 'CASE_STUDIES', 3, 'Airbnb integrates Gemini 2.0 Flash for multimodal property listing generation from host photos and descriptions.'),
    -- =================== PAPER_BENCHMARK ===================
    -- MMLU-Pro (466-470)
    (466, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro 2026 update adds 14 new domains including AI ethics and computational biology for comprehensive evaluation.'),
    (467, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 4, 'GPT-5.4 achieves 95.2% on MMLU-Pro, setting a new state-of-the-art record across all 57 academic domains.'),
    (468, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro Korean Language Edition benchmarks Korean LLM reasoning capabilities on localized domain questions.'),
    (469, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro chain-of-thought analysis shows reasoning models generate correct rationales in 89% of correct answers.'),
    (470, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro leaderboard shows open-source models closing the gap with proprietary models to within 3% accuracy.'),
    -- SWE-bench (471-475)
    (471, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 5, 'SWE-bench Verified 2026 shows Claude Code solving 73% of real-world GitHub issues, a 15% jump from 2025.'),
    (472, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 4, 'SWE-bench Multimodal adds UI bug fixing tasks requiring visual understanding of screenshots and error messages.'),
    (473, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 3, 'SWE-bench analysis shows agentic scaffolding with tool use outperforms direct prompting by 35% on hard tasks.'),
    (474, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 3, 'SWE-bench Enterprise Edition benchmarks coding agents on private enterprise codebases with custom metrics.'),
    (475, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 3, 'SWE-bench cost analysis compares token efficiency of top agents, finding Claude Code most efficient per solved issue.'),
    -- GPQA Diamond (476-480)
    (476, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 3, 'GPQA Diamond adds new physics and chemistry questions to challenge frontier models on graduate-level reasoning.'),
    (477, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 5, 'Claude 4 Opus achieves 88.7% on GPQA Diamond, surpassing the estimated 87% average expert human performance.'),
    (478, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 3, 'A comparison of GPQA Diamond and MMLU-Pro finds GPQA better predicts performance on expert-level real tasks.'),
    (479, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 3, 'GPQA Diamond extended edition adds biology and materials science sub-domains for broader scientific coverage.'),
    (480, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 3, 'GPQA Diamond few-shot vs zero-shot study shows few-shot prompting improves scores by 8% on average.'),
    -- =================== TOOLS ===================
    -- Cursor (481-483)
    (481, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 5, 'Cursor 0.50 launches background agent for autonomous multi-file refactoring without blocking the editor.'),
    (482, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 4, 'Cursor Max mode provides unlimited context tokens for complex architectural reasoning and large codebase tasks.'),
    (483, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 4, 'Cursor BugBot automates PR review and bug detection in CI/CD pipelines with configurable severity thresholds.'),
    -- GitHub Copilot (484-487)
    (484, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 5, 'GitHub Copilot Coding Agent handles entire feature implementation end-to-end from issue to merged PR.'),
    (485, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 4, 'GitHub Copilot Workspace automates the issue-to-PR workflow with AI-driven code generation on GitHub.com.'),
    (486, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 4, 'GitHub Copilot Enterprise trains custom models on private codebases for organization-specific code suggestions.'),
    (487, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 4, 'GitHub Copilot Security blocks insecure code patterns before they ship using static analysis and LLM review.'),
    -- Claude Code (488-490)
    (488, '0195f300-1001-7000-b000-000000000022', 'TOOLS', 4, 'Claude Code gains MCP server integration allowing custom tool ecosystems for domain-specific agent workflows.'),
    (489, '0195f300-1001-7000-b000-000000000022', 'TOOLS', 4, 'Claude Code subagent architecture spawns specialized sub-tasks autonomously for parallel workload processing.'),
    (490, '0195f300-1001-7000-b000-000000000022', 'TOOLS', 3, 'Claude Code vs Cursor head-to-head comparison on 50 real-world coding tasks shows Claude Code leads on accuracy.'),
    -- =================== REGULATIONS ===================
    (491, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 3, 'EU AI Act general-purpose AI model provisions take effect Q2 2026 requiring capability evaluations for frontier models.'),
    (492, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 3, 'An EU AI Act compliance checklist covers technical documentation, human oversight, and incident reporting requirements.'),
    (493, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 4, 'EU AI Act enforcement: first investigation letters sent to non-compliant GPAI providers in April 2026.'),
    (494, '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', 3, 'NIST AI RMF 2.0 adds GenAI-specific controls covering hallucination risk, bias testing, and provenance tracking.'),
    (495, '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', 3, 'NIST AI RMF implementation guides for healthcare and finance sectors provide sector-specific control mappings.'),
    -- =================== SHARED_RESOURCES ===================
    (496, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 3, 'Hugging Face Hub reaches 1.5 million public models in April 2026, with LLMs comprising 40% of all repositories.'),
    (497, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 3, 'Hugging Face Inference Providers allow running any Hub model via a unified API without deployment management.'),
    (498, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 3, 'Hugging Face FineWeb Edu provides 1.3T tokens of educational text for high-quality LLM pre-training.'),
    (499, '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', 3, 'Papers with Code adds reproducibility badges for LLM benchmark results with code and data availability checks.'),
    (500, '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', 3, 'Papers with Code real-time leaderboard tracker provides automated state-of-the-art updates across 200+ benchmarks.')
    ) AS t(seq, entity_id, page, score, summary)
) LOOP
    i := i + 1;

    -- article_raw id (c prefix for seq 301-500)
    v_art_id := format('0195f300-c%s-7000-8000-000000000001', lpad(rec.seq::text, 3, '0'))::UUID;

    -- published_at from article_raw
    SELECT published_at INTO v_pub_at
    FROM content.article_raw
    WHERE id = v_art_id;

    IF v_pub_at IS NULL THEN
        RAISE NOTICE 'Skipping seq %: article_raw not found (run stage-1-extra-new-200.sql first)', rec.seq;
        skipped := skipped + 1;
        CONTINUE;
    END IF;

    -- user_article_state id
    SELECT id INTO v_uas_id
    FROM content.user_article_state
    WHERE article_raw_id = v_art_id
      AND user_id = v_user_id
      AND revoked_at IS NULL
    LIMIT 1;

    IF v_uas_id IS NULL THEN
        RAISE NOTICE 'Skipping seq %: user_article_state not found (run ingest-bulk API first)', rec.seq;
        skipped := skipped + 1;
        CONTINUE;
    END IF;

    -- user_article_ai_state id (must be PENDING)
    SELECT id INTO v_aai_id
    FROM content.user_article_ai_state
    WHERE user_article_state_id = v_uas_id
      AND ai_status = 'PENDING'
    LIMIT 1;

    IF v_aai_id IS NULL THEN
        RAISE NOTICE 'Skipping seq %: PENDING ai_state not found (run pregen-ai-state API first)', rec.seq;
        skipped := skipped + 1;
        CONTINUE;
    END IF;

    -- Write agent_json_raw in v0.3 nested format (ai_status stays PENDING)
    UPDATE content.user_article_ai_state
    SET
        agent_json_raw = jsonb_build_object(
            'representative_entity', jsonb_build_object(
                'id',   rec.entity_id,
                'page', rec.page
            ),
            'side_category_code',
              CASE
                WHEN rec.page = 'CASE_STUDIES' THEN
                  CASE
                    WHEN rec.seq IN (455, 460, 464) THEN 'APPLIED_RESEARCH'
                    ELSE 'CASE_STUDY'
                  END
                ELSE NULL
              END,
            'ai_summary', rec.summary,
            'ai_score',   rec.score,
            'ai_model_name', 'claude-opus-4-6'
        ),
        ai_model_name   = 'claude-opus-4-6',
        ai_processed_at = v_pub_at + INTERVAL '2 hours',
        updated_at      = NOW()
    WHERE id = v_aai_id;

END LOOP;

RAISE NOTICE 'Done: processed % records, skipped %', i - skipped, skipped;
END $$;

COMMIT;

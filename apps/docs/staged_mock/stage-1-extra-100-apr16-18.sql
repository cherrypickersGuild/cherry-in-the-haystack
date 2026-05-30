-- ============================================================
-- Stage 1 Extra — 100 article_raw (April 16-18, 2026)
-- seq 701 ~ 800 / ID: 0195f300-d{seq:03x}-7000-8000-000000000001
--
-- Distribution (100 total):
--   MODEL_UPDATES 25
--     - Grok 7 (0→7 rising star ⭐)
--     - DeepSeek 6 (2→6 rising)
--     - Mistral 5 (2→5 rising)
--     - GPT 3 (declining from 12)
--     - Claude 2 (declining from 21)
--     - Gemini 1 (declining from 12)
--     - LLaMA 1
--   FRAMEWORKS 30
--     - Serving 9 (Ollama 7 ⭐ rising, vLLM 1, TGI 1)
--     - Prompt Eng 6 (DSPy 6 ⭐ 0→6 new category activity)
--     - Agent 5 (LangChain 2, LangGraph 2, CrewAI 1)
--     - Fine-Tuning 4 (Unsloth 2, LLaMA-Factory 1, Axolotl 1)
--     - RAG 3 (RAGFlow 1, Haystack 1, RAGAS 1)
--     - Data/Storage 2 (LlamaIndex 1, ChromaDB 1)
--     - LLMOps 1 (MLflow 1)
--   CASE_STUDIES 12 (Netomi 3, AutoBNN 3, MedPaLM 3, Copilot Workspace 3)
--   PAPER_BENCHMARK 12 (MMLU-Pro 4, SWE-bench 4, GPQA Diamond 4)
--   TOOLS 8 (Cursor 3, Copilot 2, Claude Code 2, Docker AI 1)
--   SHARED_RESOURCES 7 (HuggingFace 3, Papers with Code 2, Awesome LLM 2)
--   REGULATIONS 6 (EU AI Act 4, NIST AI RMF 2)
--
-- Date range: 2026-04-16 ~ 2026-04-18 (3 days)
-- All English titles
-- Prerequisites: stage-0-foundation.sql, stage-1-extra-new-200-v2.sql
-- ============================================================

BEGIN;

INSERT INTO content.article_raw (id, source_id, title, url, published_at, representative_key, language)
VALUES

-- =================== MODEL_UPDATES (seq 701-725) ===================
-- Grok (701-707) — Rising Star (0 → 7) ⭐
('0195f300-d701-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Grok-3.5 Launches with 2M Context Window and Real-Time Search Integration',          'https://example.com/new-701', '2026-04-16T09:00:00+09:00', 'seed-new-701-' || md5('Grok-3.5 Launches with 2M Context Window and Real-Time Search Integration'),          'en'),
('0195f300-d702-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'xAI Opens Grok-3 Enterprise Tier with SLA Guarantees and Data Residency Options',    'https://example.com/new-702', '2026-04-16T11:00:00+09:00', 'seed-new-702-' || md5('xAI Opens Grok-3 Enterprise Tier with SLA Guarantees and Data Residency Options'),    'en'),
('0195f300-d703-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Grok Code Mode Matches Claude 3.7 on HumanEval While Being 35 Percent Cheaper',       'https://example.com/new-703', '2026-04-16T14:00:00+09:00', 'seed-new-703-' || md5('Grok Code Mode Matches Claude 3.7 on HumanEval While Being 35 Percent Cheaper'),       'en'),
('0195f300-d704-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Grok-3 Image Understanding Finally Ships After Six Month Waitlist for Developers',    'https://example.com/new-704', '2026-04-17T09:00:00+09:00', 'seed-new-704-' || md5('Grok-3 Image Understanding Finally Ships After Six Month Waitlist for Developers'),    'en'),
('0195f300-d705-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'xAI Announces Grok Mobile SDK for iOS and Android Integration Across Native Apps',    'https://example.com/new-705', '2026-04-17T16:00:00+09:00', 'seed-new-705-' || md5('xAI Announces Grok Mobile SDK for iOS and Android Integration Across Native Apps'),    'en'),
('0195f300-d706-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Grok-3 Function Calling Update Adds Parallel Tool Execution and Streaming Responses', 'https://example.com/new-706', '2026-04-18T09:00:00+09:00', 'seed-new-706-' || md5('Grok-3 Function Calling Update Adds Parallel Tool Execution and Streaming Responses'), 'en'),
('0195f300-d707-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Grok API Pricing Undercuts GPT-5.4 by 40 Percent in New Volume Discount Tier System','https://example.com/new-707', '2026-04-18T14:00:00+09:00', 'seed-new-707-' || md5('Grok API Pricing Undercuts GPT-5.4 by 40 Percent in New Volume Discount Tier System'),'en'),

-- DeepSeek (708-713) — Rising (2 → 6)
('0195f300-d708-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek-R2 Preview Released with Hybrid Reasoning Architecture and MoE Scaling',     'https://example.com/new-708', '2026-04-16T16:00:00+09:00', 'seed-new-708-' || md5('DeepSeek-R2 Preview Released with Hybrid Reasoning Architecture and MoE Scaling'),     'en'),
('0195f300-d709-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'DeepSeek-R1 Distilled Variants Now Available on Hugging Face at 1.5B to 70B Sizes',   'https://example.com/new-709', '2026-04-16T18:00:00+09:00', 'seed-new-709-' || md5('DeepSeek-R1 Distilled Variants Now Available on Hugging Face at 1.5B to 70B Sizes'),   'en'),
('0195f300-d710-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek Math Specialist Model Tops MATH-500 Benchmark at 98.7 Percent Accuracy',     'https://example.com/new-710', '2026-04-17T11:00:00+09:00', 'seed-new-710-' || md5('DeepSeek Math Specialist Model Tops MATH-500 Benchmark at 98.7 Percent Accuracy'),     'en'),
('0195f300-d711-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'DeepSeek Coder 3.0 Outperforms GPT-4 Turbo on LiveCodeBench Suite Across Languages',  'https://example.com/new-711', '2026-04-17T14:00:00+09:00', 'seed-new-711-' || md5('DeepSeek Coder 3.0 Outperforms GPT-4 Turbo on LiveCodeBench Suite Across Languages'),  'en'),
('0195f300-d712-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'DeepSeek-R1 API Response Times Improve 3x After Infrastructure Upgrade Rolls Out',    'https://example.com/new-712', '2026-04-18T11:00:00+09:00', 'seed-new-712-' || md5('DeepSeek-R1 API Response Times Improve 3x After Infrastructure Upgrade Rolls Out'),    'en'),
('0195f300-d713-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'DeepSeek Open Sources Training Data Pipeline for Community Reproduction of R1 Model', 'https://example.com/new-713', '2026-04-18T16:00:00+09:00', 'seed-new-713-' || md5('DeepSeek Open Sources Training Data Pipeline for Community Reproduction of R1 Model'), 'en'),

-- Mistral (714-718) — Rising (2 → 5)
('0195f300-d714-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral Small 3.1 Released with Agentic Tool Use and 128K Context Window Expansion',  'https://example.com/new-714', '2026-04-16T20:00:00+09:00', 'seed-new-714-' || md5('Mistral Small 3.1 Released with Agentic Tool Use and 128K Context Window Expansion'),  'en'),
('0195f300-d715-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Mistral Large 3 Teased at Paris AI Summit with December 2026 Launch Window',         'https://example.com/new-715', '2026-04-17T18:00:00+09:00', 'seed-new-715-' || md5('Mistral Large 3 Teased at Paris AI Summit with December 2026 Launch Window'),         'en'),
('0195f300-d716-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Mistral Codestral 2 Challenges DeepSeek Coder on Permissive Commercial License',     'https://example.com/new-716', '2026-04-17T20:00:00+09:00', 'seed-new-716-' || md5('Mistral Codestral 2 Challenges DeepSeek Coder on Permissive Commercial License'),     'en'),
('0195f300-d717-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral AI Secures 500 Million Euro Series C for EU Sovereign AI Infrastructure',    'https://example.com/new-717', '2026-04-18T18:00:00+09:00', 'seed-new-717-' || md5('Mistral AI Secures 500 Million Euro Series C for EU Sovereign AI Infrastructure'),    'en'),
('0195f300-d718-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Mistral Embed v2 Multilingual Model Beats OpenAI on 20 European Language Benchmarks', 'https://example.com/new-718', '2026-04-18T20:00:00+09:00', 'seed-new-718-' || md5('Mistral Embed v2 Multilingual Model Beats OpenAI on 20 European Language Benchmarks'), 'en'),

-- GPT (719-721) — Declining (12 → 3)
('0195f300-d719-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'GPT-5.4 Structured Output Mode Adds Recursive JSON Schema Support for Nested Data',   'https://example.com/new-719', '2026-04-16T22:00:00+09:00', 'seed-new-719-' || md5('GPT-5.4 Structured Output Mode Adds Recursive JSON Schema Support for Nested Data'),   'en'),
('0195f300-d720-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'OpenAI Ships GPT-5.4 Batch API Pricing with 50 Percent Discount for Async Workloads', 'https://example.com/new-720', '2026-04-17T22:00:00+09:00', 'seed-new-720-' || md5('OpenAI Ships GPT-5.4 Batch API Pricing with 50 Percent Discount for Async Workloads'), 'en'),
('0195f300-d721-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'GPT-5.4 Voice Mode Now Available in EU After GDPR Compliance Review Concludes',      'https://example.com/new-721', '2026-04-18T22:00:00+09:00', 'seed-new-721-' || md5('GPT-5.4 Voice Mode Now Available in EU After GDPR Compliance Review Concludes'),      'en'),

-- Claude (722-723) — Sharp Decline (21 → 2)
('0195f300-d722-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude 3.7 Sonnet Artifacts Update Adds Collaborative Canvas Editing for Teams',     'https://example.com/new-722', '2026-04-17T09:00:00+09:00', 'seed-new-722-' || md5('Claude 3.7 Sonnet Artifacts Update Adds Collaborative Canvas Editing for Teams'),     'en'),
('0195f300-d723-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Anthropic Extends Claude 3.7 Prompt Cache Window to 1M Tokens for Enterprise Tier',   'https://example.com/new-723', '2026-04-18T14:00:00+09:00', 'seed-new-723-' || md5('Anthropic Extends Claude 3.7 Prompt Cache Window to 1M Tokens for Enterprise Tier'),   'en'),

-- Gemini (724) — Sharp Decline (12 → 1)
('0195f300-d724-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Gemini 2.0 Flash Adds Native OpenAI API Compatibility Layer for Easy Migration',     'https://example.com/new-724', '2026-04-18T11:00:00+09:00', 'seed-new-724-' || md5('Gemini 2.0 Flash Adds Native OpenAI API Compatibility Layer for Easy Migration'),     'en'),

-- LLaMA (725) — Decline (9 → 1)
('0195f300-d725-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'LLaMA 4 Instruct Gets 128K Context via YaRN Rope Scaling Community Patch Release',   'https://example.com/new-725', '2026-04-16T11:00:00+09:00', 'seed-new-725-' || md5('LLaMA 4 Instruct Gets 128K Context via YaRN Rope Scaling Community Patch Release'),   'en'),

-- =================== FRAMEWORKS (seq 726-755) ===================
-- Ollama (726-732) — BIG Rising Star ⭐ (0 → 7)
('0195f300-d726-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Ollama v0.6 Ships Concurrent Model Loading for Multi-Agent Workflows on Single Box',  'https://example.com/new-726', '2026-04-16T09:00:00+09:00', 'seed-new-726-' || md5('Ollama v0.6 Ships Concurrent Model Loading for Multi-Agent Workflows on Single Box'),  'en'),
('0195f300-d727-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Ollama Enterprise Tier Launches with RBAC and Audit Logs for Regulated Industries',   'https://example.com/new-727', '2026-04-16T14:00:00+09:00', 'seed-new-727-' || md5('Ollama Enterprise Tier Launches with RBAC and Audit Logs for Regulated Industries'),   'en'),
('0195f300-d728-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Ollama Cloud Preview Announced: Managed Local Model Hosting with Edge Deployment',   'https://example.com/new-728', '2026-04-17T11:00:00+09:00', 'seed-new-728-' || md5('Ollama Cloud Preview Announced: Managed Local Model Hosting with Edge Deployment'),   'en'),
('0195f300-d729-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Ollama Model Registry Integrates Directly with Hugging Face Spaces for One-Click Pull','https://example.com/new-729', '2026-04-17T16:00:00+09:00', 'seed-new-729-' || md5('Ollama Model Registry Integrates Directly with Hugging Face Spaces for One-Click Pull'),'en'),
('0195f300-d730-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Ollama Adds Native Windows ARM64 Installer with GPU Auto-Detection and WSL2 Support', 'https://example.com/new-730', '2026-04-17T20:00:00+09:00', 'seed-new-730-' || md5('Ollama Adds Native Windows ARM64 Installer with GPU Auto-Detection and WSL2 Support'), 'en'),
('0195f300-d731-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Ollama Tool Calling Performance Improves 2.8x in Latest Benchmark vs v0.5 Baseline', 'https://example.com/new-731', '2026-04-18T09:00:00+09:00', 'seed-new-731-' || md5('Ollama Tool Calling Performance Improves 2.8x in Latest Benchmark vs v0.5 Baseline'), 'en'),
('0195f300-d732-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Ollama Community Hits 500K Monthly Active Instances Milestone According to Telemetry','https://example.com/new-732', '2026-04-18T16:00:00+09:00', 'seed-new-732-' || md5('Ollama Community Hits 500K Monthly Active Instances Milestone According to Telemetry'),'en'),

-- DSPy (733-738) — BIG Rising Star ⭐ (0 → 6, Prompt Engineering category activation)
('0195f300-d733-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DSPy 3.0 Release Introduces Auto-Compile for Multi-Model Pipelines with Cost Tracking','https://example.com/new-733', '2026-04-16T11:00:00+09:00', 'seed-new-733-' || md5('DSPy 3.0 Release Introduces Auto-Compile for Multi-Model Pipelines with Cost Tracking'),'en'),
('0195f300-d734-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DSPy Optimizers Hit MATH-500 State of the Art Without Any Manual Prompt Tuning',     'https://example.com/new-734', '2026-04-16T16:00:00+09:00', 'seed-new-734-' || md5('DSPy Optimizers Hit MATH-500 State of the Art Without Any Manual Prompt Tuning'),     'en'),
('0195f300-d735-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'DSPy Ecosystem Paper Shows 40 Percent Cost Reduction vs Hand-Tuned Production Prompts','https://example.com/new-735', '2026-04-17T14:00:00+09:00', 'seed-new-735-' || md5('DSPy Ecosystem Paper Shows 40 Percent Cost Reduction vs Hand-Tuned Production Prompts'),'en'),
('0195f300-d736-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'Stanford NLP Lab Releases DSPy Case Studies for Enterprise Rollouts Across Fortune 100','https://example.com/new-736', '2026-04-17T18:00:00+09:00', 'seed-new-736-' || md5('Stanford NLP Lab Releases DSPy Case Studies for Enterprise Rollouts Across Fortune 100'),'en'),
('0195f300-d737-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'DSPy LLM-as-Judge Compiler Discovers Novel Evaluation Prompts Beating Human Baselines','https://example.com/new-737', '2026-04-18T11:00:00+09:00', 'seed-new-737-' || md5('DSPy LLM-as-Judge Compiler Discovers Novel Evaluation Prompts Beating Human Baselines'),'en'),
('0195f300-d738-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'DSPy Tutorial Series by Stanford NLP Lab Reaches 200K Views on YouTube Channel',     'https://example.com/new-738', '2026-04-18T20:00:00+09:00', 'seed-new-738-' || md5('DSPy Tutorial Series by Stanford NLP Lab Reaches 200K Views on YouTube Channel'),     'en'),

-- Serving remainder: vLLM (739), TensorRT-LLM (740)
('0195f300-d739-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'vLLM v0.11 Experimental FP4 Quantization Cuts Memory by Half on H200 Clusters',      'https://example.com/new-739', '2026-04-17T09:00:00+09:00', 'seed-new-739-' || md5('vLLM v0.11 Experimental FP4 Quantization Cuts Memory by Half on H200 Clusters'),      'en'),
('0195f300-d740-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'NVIDIA TensorRT-LLM Adds Native MCP Tool Calling Protocol for Agentic Inference',    'https://example.com/new-740', '2026-04-18T14:00:00+09:00', 'seed-new-740-' || md5('NVIDIA TensorRT-LLM Adds Native MCP Tool Calling Protocol for Agentic Inference'),    'en'),

-- Agent (741-745)
('0195f300-d741-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'LangChain v0.5.2 Hotfix Resolves Memory Leak in Streaming Callbacks Under High Load', 'https://example.com/new-741', '2026-04-16T18:00:00+09:00', 'seed-new-741-' || md5('LangChain v0.5.2 Hotfix Resolves Memory Leak in Streaming Callbacks Under High Load'), 'en'),
('0195f300-d742-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'LangChain Deprecates Agents API in Favor of LangGraph Migration Path by End of Year',  'https://example.com/new-742', '2026-04-17T11:00:00+09:00', 'seed-new-742-' || md5('LangChain Deprecates Agents API in Favor of LangGraph Migration Path by End of Year'),  'en'),
('0195f300-d743-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'LangGraph Cloud Adds Region Selection for GDPR-Compliant EU Deployments on Demand',   'https://example.com/new-743', '2026-04-17T16:00:00+09:00', 'seed-new-743-' || md5('LangGraph Cloud Adds Region Selection for GDPR-Compliant EU Deployments on Demand'),   'en'),
('0195f300-d744-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'LangGraph Examples Repo Hits 10K GitHub Stars Milestone with Production Use Cases',   'https://example.com/new-744', '2026-04-18T09:00:00+09:00', 'seed-new-744-' || md5('LangGraph Examples Repo Hits 10K GitHub Stars Milestone with Production Use Cases'),   'en'),
('0195f300-d745-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'CrewAI Enterprise Pilot Program Onboards First 50 Fortune 500 Teams This Quarter',    'https://example.com/new-745', '2026-04-18T18:00:00+09:00', 'seed-new-745-' || md5('CrewAI Enterprise Pilot Program Onboards First 50 Fortune 500 Teams This Quarter'),    'en'),

-- Fine-Tuning (746-749)
('0195f300-d746-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Unsloth Releases Gemma 3 Fine-Tuning Notebook with Free Colab GPU Support Built In', 'https://example.com/new-746', '2026-04-16T20:00:00+09:00', 'seed-new-746-' || md5('Unsloth Releases Gemma 3 Fine-Tuning Notebook with Free Colab GPU Support Built In'), 'en'),
('0195f300-d747-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Unsloth Reasoning Distillation Tool Turns GPT-4 Into Llama-3 Teacher for Local Models','https://example.com/new-747', '2026-04-17T14:00:00+09:00', 'seed-new-747-' || md5('Unsloth Reasoning Distillation Tool Turns GPT-4 Into Llama-3 Teacher for Local Models'),'en'),
('0195f300-d748-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'LLaMA-Factory v1.0 Ships with Unified UI for Model Zoo Fine-Tuning Across 50+ Models', 'https://example.com/new-748', '2026-04-18T11:00:00+09:00', 'seed-new-748-' || md5('LLaMA-Factory v1.0 Ships with Unified UI for Model Zoo Fine-Tuning Across 50+ Models'), 'en'),
('0195f300-d749-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Axolotl Adds DeepSeek-R1 Fine-Tuning Recipe Contributed by Open Source Community',    'https://example.com/new-749', '2026-04-18T22:00:00+09:00', 'seed-new-749-' || md5('Axolotl Adds DeepSeek-R1 Fine-Tuning Recipe Contributed by Open Source Community'),    'en'),

-- RAG (750-752)
('0195f300-d750-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'RAGFlow Enterprise Dashboard Adds Document Lineage Tracking and Granular Access Control','https://example.com/new-750', '2026-04-16T22:00:00+09:00', 'seed-new-750-' || md5('RAGFlow Enterprise Dashboard Adds Document Lineage Tracking and Granular Access Control'),'en'),
('0195f300-d751-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Haystack 2.5 Introduces Declarative Pipeline Composer with YAML Syntax and Hot Reload','https://example.com/new-751', '2026-04-17T18:00:00+09:00', 'seed-new-751-' || md5('Haystack 2.5 Introduces Declarative Pipeline Composer with YAML Syntax and Hot Reload'),'en'),
('0195f300-d752-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'RAGAS v0.3 Adds Multimodal Evaluation Metrics for Vision-Language RAG Systems',       'https://example.com/new-752', '2026-04-18T11:00:00+09:00', 'seed-new-752-' || md5('RAGAS v0.3 Adds Multimodal Evaluation Metrics for Vision-Language RAG Systems'),       'en'),

-- Data/Storage (753-754)
('0195f300-d753-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'LlamaIndex Query Engine Now Supports Property Graph Traversal at Billion-Node Scale', 'https://example.com/new-753', '2026-04-17T11:00:00+09:00', 'seed-new-753-' || md5('LlamaIndex Query Engine Now Supports Property Graph Traversal at Billion-Node Scale'), 'en'),
('0195f300-d754-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'ChromaDB Cloud Announces GA with Dedicated Tenancy and 99.9 Percent SLA Guarantees',  'https://example.com/new-754', '2026-04-18T16:00:00+09:00', 'seed-new-754-' || md5('ChromaDB Cloud Announces GA with Dedicated Tenancy and 99.9 Percent SLA Guarantees'),  'en'),

-- LLMOps (755)
('0195f300-d755-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'MLflow 3.1 Ships LLM Cost Attribution Dashboard for Multi-Team Organizations at Scale','https://example.com/new-755', '2026-04-18T20:00:00+09:00', 'seed-new-755-' || md5('MLflow 3.1 Ships LLM Cost Attribution Dashboard for Multi-Team Organizations at Scale'),'en'),

-- =================== CASE_STUDIES (seq 756-767) ===================
-- Netomi × OpenAI CS (756-758)
('0195f300-d756-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Netomi Expands GPT-5.4 Support to 40 Fortune 500 Brands After 6-Month Rollout',       'https://example.com/new-756', '2026-04-16T14:00:00+09:00', 'seed-new-756-' || md5('Netomi Expands GPT-5.4 Support to 40 Fortune 500 Brands After 6-Month Rollout'),       'en'),
('0195f300-d757-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'OpenAI Publishes Netomi ROI Study: 67 Percent Ticket Deflection in First Quarter',   'https://example.com/new-757', '2026-04-17T09:00:00+09:00', 'seed-new-757-' || md5('OpenAI Publishes Netomi ROI Study: 67 Percent Ticket Deflection in First Quarter'),   'en'),
('0195f300-d758-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'Netomi HIPAA Compliance Path Opens GPT-5.4 Support for Healthcare Payer Clients',    'https://example.com/new-758', '2026-04-18T14:00:00+09:00', 'seed-new-758-' || md5('Netomi HIPAA Compliance Path Opens GPT-5.4 Support for Healthcare Payer Clients'),    'en'),

-- AutoBNN × Google CS (759-761)
('0195f300-d759-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Google AutoBNN Deployed in Kenya for Regional Crop Yield Forecasting Pilot Program', 'https://example.com/new-759', '2026-04-16T16:00:00+09:00', 'seed-new-759-' || md5('Google AutoBNN Deployed in Kenya for Regional Crop Yield Forecasting Pilot Program'), 'en'),
('0195f300-d760-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000009', 'AutoBNN Wildfire Spread Prediction Reaches Production in California State Services',  'https://example.com/new-760', '2026-04-17T11:00:00+09:00', 'seed-new-760-' || md5('AutoBNN Wildfire Spread Prediction Reaches Production in California State Services'),  'en'),
('0195f300-d761-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'AutoBNN Traffic Flow Model Reduces Congestion 18 Percent in Seoul Commuter Corridors','https://example.com/new-761', '2026-04-18T16:00:00+09:00', 'seed-new-761-' || md5('AutoBNN Traffic Flow Model Reduces Congestion 18 Percent in Seoul Commuter Corridors'),'en'),

-- MedPaLM × Google CS (762-764)
('0195f300-d762-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000009', 'MedPaLM Expands to 15 Asian Hospitals Following Successful Japan Pilot Deployment',   'https://example.com/new-762', '2026-04-16T20:00:00+09:00', 'seed-new-762-' || md5('MedPaLM Expands to 15 Asian Hospitals Following Successful Japan Pilot Deployment'),   'en'),
('0195f300-d763-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'MedPaLM Oncology Specialization Outperforms Generalist on Breast Cancer Screening',   'https://example.com/new-763', '2026-04-17T20:00:00+09:00', 'seed-new-763-' || md5('MedPaLM Oncology Specialization Outperforms Generalist on Breast Cancer Screening'),   'en'),
('0195f300-d764-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000009', 'MedPaLM Radiology Partnership with Siemens Healthineers Announced at RSNA Symposium',  'https://example.com/new-764', '2026-04-18T09:00:00+09:00', 'seed-new-764-' || md5('MedPaLM Radiology Partnership with Siemens Healthineers Announced at RSNA Symposium'),  'en'),

-- Copilot Workspace × Microsoft CS (765-767)
('0195f300-d765-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Copilot Workspace Enterprise Pilot Launches with First 100 Fortune 500 Engineering Teams','https://example.com/new-765', '2026-04-16T09:00:00+09:00', 'seed-new-765-' || md5('Copilot Workspace Enterprise Pilot Launches with First 100 Fortune 500 Engineering Teams'),'en'),
('0195f300-d766-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'GitHub Publishes Copilot Workspace Productivity Data: 55 Percent Faster PR Turnaround', 'https://example.com/new-766', '2026-04-17T14:00:00+09:00', 'seed-new-766-' || md5('GitHub Publishes Copilot Workspace Productivity Data: 55 Percent Faster PR Turnaround'), 'en'),
('0195f300-d767-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Copilot Workspace Passes Independent Security Audit for SOC 2 Type II Compliance',    'https://example.com/new-767', '2026-04-18T11:00:00+09:00', 'seed-new-767-' || md5('Copilot Workspace Passes Independent Security Audit for SOC 2 Type II Compliance'),    'en'),

-- =================== PAPER_BENCHMARK (seq 768-779) ===================
-- MMLU-Pro (768-771)
('0195f300-d768-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'MMLU-Pro April Leaderboard Update: DeepSeek-R2 Preview Takes First Place from GPT-5.4','https://example.com/new-768', '2026-04-16T11:00:00+09:00', 'seed-new-768-' || md5('MMLU-Pro April Leaderboard Update: DeepSeek-R2 Preview Takes First Place from GPT-5.4'),'en'),
('0195f300-d769-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'MMLU-Pro Evaluation Methodology Paper Accepted to NeurIPS 2026 for Best Paper Track',  'https://example.com/new-769', '2026-04-17T14:00:00+09:00', 'seed-new-769-' || md5('MMLU-Pro Evaluation Methodology Paper Accepted to NeurIPS 2026 for Best Paper Track'),  'en'),
('0195f300-d770-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'MMLU-Pro Reasoning Subset Released to Isolate Pure Logic from Knowledge Retrieval',   'https://example.com/new-770', '2026-04-18T11:00:00+09:00', 'seed-new-770-' || md5('MMLU-Pro Reasoning Subset Released to Isolate Pure Logic from Knowledge Retrieval'),   'en'),
('0195f300-d771-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'MMLU-Pro Multilingual Expansion Covers 50 Languages for Cross-Cultural Evaluation',   'https://example.com/new-771', '2026-04-18T18:00:00+09:00', 'seed-new-771-' || md5('MMLU-Pro Multilingual Expansion Covers 50 Languages for Cross-Cultural Evaluation'),   'en'),

-- SWE-bench (772-775)
('0195f300-d772-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'SWE-bench Plus Released with 2500 New Real-World Pull Requests from 40 Top Repos',    'https://example.com/new-772', '2026-04-16T14:00:00+09:00', 'seed-new-772-' || md5('SWE-bench Plus Released with 2500 New Real-World Pull Requests from 40 Top Repos'),    'en'),
('0195f300-d773-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'SWE-bench Industry Baseline: Claude 3.7 Leads at 62 Percent, Grok Code Mode at 56',   'https://example.com/new-773', '2026-04-17T11:00:00+09:00', 'seed-new-773-' || md5('SWE-bench Industry Baseline: Claude 3.7 Leads at 62 Percent, Grok Code Mode at 56'),   'en'),
('0195f300-d774-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'SWE-bench Multi-File Bug Fix Subtask Reveals Gap Between Top and Mid-Tier Models',    'https://example.com/new-774', '2026-04-17T18:00:00+09:00', 'seed-new-774-' || md5('SWE-bench Multi-File Bug Fix Subtask Reveals Gap Between Top and Mid-Tier Models'),    'en'),
('0195f300-d775-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'SWE-bench Python vs Java Comparison Shows Code Language Matters Less Than Expected',  'https://example.com/new-775', '2026-04-18T14:00:00+09:00', 'seed-new-775-' || md5('SWE-bench Python vs Java Comparison Shows Code Language Matters Less Than Expected'),  'en'),

-- GPQA Diamond (776-779)
('0195f300-d776-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'GPQA Diamond Chemistry Subset Added for Fine-Grained Scientific Reasoning Evaluation', 'https://example.com/new-776', '2026-04-16T18:00:00+09:00', 'seed-new-776-' || md5('GPQA Diamond Chemistry Subset Added for Fine-Grained Scientific Reasoning Evaluation'), 'en'),
('0195f300-d777-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'GPQA Diamond Human Baseline Updated with 200 New PhD Annotators from Top Universities','https://example.com/new-777', '2026-04-17T16:00:00+09:00', 'seed-new-777-' || md5('GPQA Diamond Human Baseline Updated with 200 New PhD Annotators from Top Universities'),'en'),
('0195f300-d778-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'GPQA Diamond Shows DeepSeek-R2 Matches Graduate Student Accuracy on First Attempt',   'https://example.com/new-778', '2026-04-18T09:00:00+09:00', 'seed-new-778-' || md5('GPQA Diamond Shows DeepSeek-R2 Matches Graduate Student Accuracy on First Attempt'),   'en'),
('0195f300-d779-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'GPQA Diamond Physics Problems Reveal Reasoning Model Weaknesses on Spatial Tasks',    'https://example.com/new-779', '2026-04-18T20:00:00+09:00', 'seed-new-779-' || md5('GPQA Diamond Physics Problems Reveal Reasoning Model Weaknesses on Spatial Tasks'),    'en'),

-- =================== TOOLS (seq 780-787) ===================
-- Cursor (780-782)
('0195f300-d780-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Cursor 1.5 Release Adds Multi-Cursor AI Agents for Parallel Code Edits Across Files',  'https://example.com/new-780', '2026-04-16T09:00:00+09:00', 'seed-new-780-' || md5('Cursor 1.5 Release Adds Multi-Cursor AI Agents for Parallel Code Edits Across Files'),  'en'),
('0195f300-d781-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Cursor Team Plan Launches with Shared Contexts and Usage Analytics for Organizations', 'https://example.com/new-781', '2026-04-17T14:00:00+09:00', 'seed-new-781-' || md5('Cursor Team Plan Launches with Shared Contexts and Usage Analytics for Organizations'), 'en'),
('0195f300-d782-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Cursor Composer Mode Update Handles Multi-Repo Refactors with Dependency Awareness',  'https://example.com/new-782', '2026-04-18T11:00:00+09:00', 'seed-new-782-' || md5('Cursor Composer Mode Update Handles Multi-Repo Refactors with Dependency Awareness'),  'en'),

-- GitHub Copilot (783-784)
('0195f300-d783-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'GitHub Copilot Workspace Beta Opens to All Paid Subscribers After Waitlist Period',   'https://example.com/new-783', '2026-04-17T09:00:00+09:00', 'seed-new-783-' || md5('GitHub Copilot Workspace Beta Opens to All Paid Subscribers After Waitlist Period'),   'en'),
('0195f300-d784-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'GitHub Copilot Chat UI Redesign Brings Persistent Conversation Threads and Pinning',  'https://example.com/new-784', '2026-04-18T16:00:00+09:00', 'seed-new-784-' || md5('GitHub Copilot Chat UI Redesign Brings Persistent Conversation Threads and Pinning'),  'en'),

-- Claude Code (785-786)
('0195f300-d785-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude Code Adds Auto-Commit Feature with AI-Generated Messages for Solo Developers',  'https://example.com/new-785', '2026-04-17T18:00:00+09:00', 'seed-new-785-' || md5('Claude Code Adds Auto-Commit Feature with AI-Generated Messages for Solo Developers'),  'en'),
('0195f300-d786-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude Code Plugin System Opens to Third-Party Developers via New MCP Extension Spec', 'https://example.com/new-786', '2026-04-18T20:00:00+09:00', 'seed-new-786-' || md5('Claude Code Plugin System Opens to Third-Party Developers via New MCP Extension Spec'), 'en'),

-- Docker AI (787)
('0195f300-d787-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Docker AI Compose Extension Generates Multi-Service Stack from Natural Language Prompt','https://example.com/new-787', '2026-04-18T14:00:00+09:00', 'seed-new-787-' || md5('Docker AI Compose Extension Generates Multi-Service Stack from Natural Language Prompt'),'en'),

-- =================== SHARED_RESOURCES (seq 788-794) ===================
-- HuggingFace (788-790)
('0195f300-d788-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Hugging Face Dataset 2.0 Spec Enables Streaming Multi-Modal Datasets from S3 Buckets',  'https://example.com/new-788', '2026-04-16T20:00:00+09:00', 'seed-new-788-' || md5('Hugging Face Dataset 2.0 Spec Enables Streaming Multi-Modal Datasets from S3 Buckets'),  'en'),
('0195f300-d789-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Hugging Face Inference Endpoints v2 Launches with Auto-Scaling and Cold Start Cutoff', 'https://example.com/new-789', '2026-04-17T11:00:00+09:00', 'seed-new-789-' || md5('Hugging Face Inference Endpoints v2 Launches with Auto-Scaling and Cold Start Cutoff'), 'en'),
('0195f300-d790-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Hugging Face Model Arena Crowdsources Head-to-Head Comparisons with Elo Rating System','https://example.com/new-790', '2026-04-18T14:00:00+09:00', 'seed-new-790-' || md5('Hugging Face Model Arena Crowdsources Head-to-Head Comparisons with Elo Rating System'),'en'),

-- Papers with Code (791-792)
('0195f300-d791-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'Papers with Code 2026 Trends Report Highlights Reasoning Models and Agentic Benchmarks','https://example.com/new-791', '2026-04-17T16:00:00+09:00', 'seed-new-791-' || md5('Papers with Code 2026 Trends Report Highlights Reasoning Models and Agentic Benchmarks'),'en'),
('0195f300-d792-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'Papers with Code Introduces Reproducibility Badge Program for Community Verification',  'https://example.com/new-792', '2026-04-18T18:00:00+09:00', 'seed-new-792-' || md5('Papers with Code Introduces Reproducibility Badge Program for Community Verification'),  'en'),

-- Awesome LLM (793-794)
('0195f300-d793-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000006', 'Awesome LLM Weekly Roundup: 50 New Tools Added This Week Across Agent and RAG Domains','https://example.com/new-793', '2026-04-16T22:00:00+09:00', 'seed-new-793-' || md5('Awesome LLM Weekly Roundup: 50 New Tools Added This Week Across Agent and RAG Domains'),'en'),
('0195f300-d794-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Awesome LLM Curator Guidelines Updated to Prioritize Production-Ready Over Hobby Repos','https://example.com/new-794', '2026-04-18T09:00:00+09:00', 'seed-new-794-' || md5('Awesome LLM Curator Guidelines Updated to Prioritize Production-Ready Over Hobby Repos'),'en'),

-- =================== REGULATIONS (seq 795-800) ===================
-- EU AI Act (795-798)
('0195f300-d795-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'EU AI Act Transparency Report Deadline Looms: First Filings Due May 2026 for GPAI Providers','https://example.com/new-795', '2026-04-16T11:00:00+09:00', 'seed-new-795-' || md5('EU AI Act Transparency Report Deadline Looms: First Filings Due May 2026 for GPAI Providers'),'en'),
('0195f300-d796-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'EU AI Act Risk Tier Classification Guide Published by European Commission for Enterprises','https://example.com/new-796', '2026-04-17T09:00:00+09:00', 'seed-new-796-' || md5('EU AI Act Risk Tier Classification Guide Published by European Commission for Enterprises'),'en'),
('0195f300-d797-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'EU Takes First Enforcement Action Under AI Act Against Unnamed Biometric Vendor',     'https://example.com/new-797', '2026-04-18T11:00:00+09:00', 'seed-new-797-' || md5('EU Takes First Enforcement Action Under AI Act Against Unnamed Biometric Vendor'),     'en'),
('0195f300-d798-7000-8000-000000000001', '0195f300-0001-7000-a000-00000000000a', 'EU AI Act GPAI Obligations Clarified: Open Source Models Get Partial Exemption Path',  'https://example.com/new-798', '2026-04-18T16:00:00+09:00', 'seed-new-798-' || md5('EU AI Act GPAI Obligations Clarified: Open Source Models Get Partial Exemption Path'),  'en'),

-- NIST AI RMF (799-800)
('0195f300-d799-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'NIST AI RMF Generative AI Profile Published as Sector-Specific Addendum for Deployers', 'https://example.com/new-799', '2026-04-17T14:00:00+09:00', 'seed-new-799-' || md5('NIST AI RMF Generative AI Profile Published as Sector-Specific Addendum for Deployers'), 'en'),
('0195f300-d800-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'NIST Releases AI RMF Healthcare Sector Guide with Patient Privacy Controls Framework',  'https://example.com/new-800', '2026-04-18T20:00:00+09:00', 'seed-new-800-' || md5('NIST Releases AI RMF Healthcare Sector Guide with Patient Privacy Controls Framework'),  'en')

ON CONFLICT (id) DO NOTHING;

COMMIT;

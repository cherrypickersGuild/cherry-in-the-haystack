-- ============================================================
-- Stage 4 Extra — 100 agent_json_raw UPDATE (PENDING→processed)
-- seq 701 ~ 800 / article_raw ID: 0195f300-d{seq:03d}-7000-8000-000000000001
-- user_id: SYSTEM_USER_ID = 00000000-0000-0000-0000-000000000000
-- agent_json_raw: v0.3 format (representative_entity nested, side_category_code)
-- ai_status: PENDING 유지 (parse-agent-json API 호출 후 SUCCESS 전환)
--
-- side_category_code rules:
--   CASE_STUDIES (seq 756-767):
--     - APPLIED_RESEARCH (2건): seq 763, 766 (research findings / productivity reports)
--     - CASE_STUDY (10건): deployment/customer stories
--   다른 page = NULL
--
-- Prerequisites:
--   stage-1-extra-100-apr16-18.sql 적용
--   + ingest-bulk API (user_article_state 생성)
--   + pregen-ai-state API (PENDING ai_state 생성)
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

    -- =================== MODEL_UPDATES ===================
    -- Grok (701-707) — entity 004 — RISING STAR ⭐ (0→7)
    (701, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 5, 'Grok-3.5 launches with a 2M token context window and native real-time search, positioning xAI as a serious enterprise contender.'),
    (702, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 4, 'xAI opens a Grok-3 Enterprise tier with SLA guarantees and configurable data residency options for regulated buyers.'),
    (703, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 4, 'Grok Code Mode matches Claude 3.7 on HumanEval while priced 35 percent lower, shaking up the coding model market.'),
    (704, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 4, 'Grok-3 image understanding finally ships after a six-month waitlist, closing the multimodal gap vs rivals.'),
    (705, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 3, 'xAI announces a Grok Mobile SDK for iOS and Android, enabling on-app integration for consumer developers.'),
    (706, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 4, 'Grok-3 function calling update adds parallel tool execution and streaming responses, closing the gap with GPT and Claude.'),
    (707, '0195f300-1001-7000-b000-000000000004', 'MODEL_UPDATES', 4, 'Grok API pricing undercuts GPT-5.4 by 40 percent in a new volume discount tier, intensifying price competition.'),

    -- DeepSeek (708-713) — entity 006 — Rising (2→6)
    (708, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 5, 'DeepSeek-R2 preview drops with a hybrid reasoning architecture and MoE scaling, extending the R-series lead on reasoning.'),
    (709, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 3, 'DeepSeek-R1 distilled variants from 1.5B to 70B land on Hugging Face, broadening deployability for budget setups.'),
    (710, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 5, 'DeepSeek math specialist model hits 98.7 percent on MATH-500, setting a new bar for domain-tuned reasoning models.'),
    (711, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 4, 'DeepSeek Coder 3.0 outperforms GPT-4 Turbo on LiveCodeBench across languages, a meaningful win for open-weight coding.'),
    (712, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 3, 'DeepSeek-R1 API response times improve 3x after infrastructure upgrade, addressing a major production complaint.'),
    (713, '0195f300-1001-7000-b000-000000000006', 'MODEL_UPDATES', 4, 'DeepSeek open sources its training data pipeline for community reproduction, doubling down on openness as strategy.'),

    -- Mistral (714-718) — entity 007 — Rising (2→5)
    (714, '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', 4, 'Mistral Small 3.1 adds agentic tool use and a 128K context window, strengthening its mid-tier production offering.'),
    (715, '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', 4, 'Mistral Large 3 is teased at the Paris AI Summit with a December 2026 launch window, setting up the next European flagship.'),
    (716, '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', 4, 'Mistral Codestral 2 challenges DeepSeek Coder on a permissive commercial license, appealing to enterprise deployers.'),
    (717, '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', 5, 'Mistral secures a 500 million euro Series C for EU sovereign AI infrastructure, cementing its regional champion position.'),
    (718, '0195f300-1001-7000-b000-000000000007', 'MODEL_UPDATES', 3, 'Mistral Embed v2 beats OpenAI on 20 European language benchmarks, extending its multilingual advantage.'),

    -- GPT (719-721) — entity 001 — Declining (12→3)
    (719, '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', 3, 'GPT-5.4 structured output mode adds recursive JSON schema support, improving complex nested data extraction.'),
    (720, '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', 4, 'OpenAI ships GPT-5.4 Batch API pricing with a 50 percent discount for async workloads, broadening cost-sensitive use.'),
    (721, '0195f300-1001-7000-b000-000000000001', 'MODEL_UPDATES', 3, 'GPT-5.4 Voice Mode is now available in the EU after GDPR compliance review, unlocking a large blocked market.'),

    -- Claude (722-723) — entity 002 — Sharp Decline (21→2)
    (722, '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', 3, 'Claude 3.7 Sonnet Artifacts adds collaborative canvas editing for teams, extending the workspace-style UX.'),
    (723, '0195f300-1001-7000-b000-000000000002', 'MODEL_UPDATES', 4, 'Anthropic extends Claude 3.7 prompt cache window to 1M tokens for enterprise tier, cutting repeated-context costs.'),

    -- Gemini (724) — entity 003 — Sharp Decline (12→1)
    (724, '0195f300-1001-7000-b000-000000000003', 'MODEL_UPDATES', 4, 'Gemini 2.0 Flash adds a native OpenAI API compatibility layer, making migration painless for existing stacks.'),

    -- LLaMA (725) — entity 005 — Decline (9→1)
    (725, '0195f300-1001-7000-b000-000000000005', 'MODEL_UPDATES', 3, 'LLaMA 4 Instruct gets 128K context via a community YaRN RoPE scaling patch, easing long-context fine-tuning.'),

    -- =================== FRAMEWORKS ===================
    -- Ollama (726-732) — entity 018 — BIG Rising Star ⭐ (0→7, Serving)
    (726, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 5, 'Ollama v0.6 ships concurrent model loading for multi-agent workflows on a single machine, a long-requested feature.'),
    (727, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 5, 'Ollama Enterprise tier launches with RBAC and audit logs, signaling a serious push into regulated industry deployments.'),
    (728, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 4, 'Ollama Cloud preview offers managed local model hosting with edge deployment, bridging local-first and cloud hybrid use.'),
    (729, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 3, 'Ollama model registry integrates directly with Hugging Face Spaces for one-click model pulls across 100K+ checkpoints.'),
    (730, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 3, 'Ollama adds native Windows ARM64 installer with GPU auto-detection, expanding reach to Copilot+ PC hardware.'),
    (731, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 4, 'Ollama tool calling performance improves 2.8x in the latest benchmark vs the v0.5 baseline, closing in on vLLM throughput.'),
    (732, '0195f300-1001-7000-b000-000000000018', 'FRAMEWORKS', 4, 'Ollama community hits 500K monthly active instances per telemetry, confirming runaway adoption for local-first workflows.'),

    -- DSPy (733-738) — entity 014 — BIG Rising Star ⭐ (0→6, Prompt Engineering)
    (733, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 5, 'DSPy 3.0 introduces auto-compile for multi-model pipelines with cost tracking, reframing prompt engineering as optimization.'),
    (734, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 5, 'DSPy optimizers hit MATH-500 state of the art without any manual prompt tuning, a headline result for the compile-prompt paradigm.'),
    (735, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 4, 'DSPy ecosystem paper shows 40 percent cost reduction vs hand-tuned production prompts, providing hard ROI numbers for adopters.'),
    (736, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 4, 'Stanford NLP Lab releases DSPy case studies for enterprise rollouts across Fortune 100, legitimizing the framework for risk-averse buyers.'),
    (737, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 4, 'DSPy LLM-as-judge compiler discovers novel evaluation prompts that beat human baselines, opening a research direction.'),
    (738, '0195f300-1001-7000-b000-000000000014', 'FRAMEWORKS', 3, 'DSPy tutorial series by Stanford NLP Lab reaches 200K views on YouTube, reflecting rapid mindshare gain.'),

    -- Serving remainder: vLLM (739) entity 017, TensorRT-LLM (740) entity 065
    (739, '0195f300-1001-7000-b000-000000000017', 'FRAMEWORKS', 3, 'vLLM v0.11 experimental FP4 quantization cuts memory by half on H200 clusters, extending throughput leadership.'),
    (740, '0195f300-1001-7000-b000-000000000065', 'FRAMEWORKS', 4, 'NVIDIA TensorRT-LLM adds native MCP tool calling protocol for agentic inference, bringing agent workflows to optimized runtime.'),

    -- Agent (741-745): LangChain 010, LangGraph 011, CrewAI 012
    (741, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 3, 'LangChain v0.5.2 hotfix resolves a memory leak in streaming callbacks under high load, unblocking production deployments.'),
    (742, '0195f300-1001-7000-b000-000000000010', 'FRAMEWORKS', 4, 'LangChain deprecates Agents API in favor of a LangGraph migration path by end of year, consolidating the agent story.'),
    (743, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 3, 'LangGraph Cloud adds region selection for GDPR-compliant EU deployments, closing a key enterprise compliance gap.'),
    (744, '0195f300-1001-7000-b000-000000000011', 'FRAMEWORKS', 3, 'LangGraph examples repo hits 10K GitHub stars, confirming it as the canonical reference for agent graph patterns.'),
    (745, '0195f300-1001-7000-b000-000000000012', 'FRAMEWORKS', 4, 'CrewAI Enterprise pilot program onboards the first 50 Fortune 500 teams this quarter, validating the monetization model.'),

    -- Fine-Tuning (746-749): Unsloth 015, LLaMA-Factory 016, Axolotl 063
    (746, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 3, 'Unsloth releases a Gemma 3 fine-tuning notebook with free Colab GPU support, lowering the barrier to first-time tuners.'),
    (747, '0195f300-1001-7000-b000-000000000015', 'FRAMEWORKS', 4, 'Unsloth reasoning distillation tool turns GPT-4 into a Llama-3 teacher for local models, accelerating the open reasoning pipeline.'),
    (748, '0195f300-1001-7000-b000-000000000016', 'FRAMEWORKS', 4, 'LLaMA-Factory v1.0 ships a unified UI for fine-tuning across 50+ model zoo entries, maturing into a stable platform.'),
    (749, '0195f300-1001-7000-b000-000000000063', 'FRAMEWORKS', 3, 'Axolotl adds a DeepSeek-R1 fine-tuning recipe contributed by the open source community, extending reasoning tuning reach.'),

    -- RAG (750-752): RAGFlow 01c, Haystack 01d, RAGAS 01f
    (750, '0195f300-1001-7000-b000-00000000001c', 'FRAMEWORKS', 4, 'RAGFlow enterprise dashboard adds document lineage tracking and granular access control for regulated RAG deployments.'),
    (751, '0195f300-1001-7000-b000-00000000001d', 'FRAMEWORKS', 3, 'Haystack 2.5 introduces a declarative pipeline composer with YAML syntax and hot reload, improving iteration speed.'),
    (752, '0195f300-1001-7000-b000-00000000001f', 'FRAMEWORKS', 4, 'RAGAS v0.3 adds multimodal evaluation metrics for vision-language RAG systems, filling a glaring gap in eval tooling.'),

    -- Data/Storage (753-754): LlamaIndex 019, ChromaDB 01a
    (753, '0195f300-1001-7000-b000-000000000019', 'FRAMEWORKS', 4, 'LlamaIndex query engine now supports property graph traversal at billion-node scale, unlocking enterprise knowledge graph RAG.'),
    (754, '0195f300-1001-7000-b000-00000000001a', 'FRAMEWORKS', 4, 'ChromaDB Cloud announces GA with dedicated tenancy and 99.9 percent SLA, graduating from community tool to enterprise option.'),

    -- LLMOps (755): MLflow 01e
    (755, '0195f300-1001-7000-b000-00000000001e', 'FRAMEWORKS', 4, 'MLflow 3.1 ships an LLM cost attribution dashboard for multi-team organizations, addressing a top ask from finance stakeholders.'),

    -- =================== CASE_STUDIES ===================
    -- Netomi × OpenAI CS (756-758) — entity 040
    (756, '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', 4, 'Netomi expands GPT-5.4 support to 40 Fortune 500 brands after a six-month rollout, validating conversational AI at scale.'),
    (757, '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', 4, 'OpenAI publishes the Netomi ROI study showing 67 percent ticket deflection in Q1, a benchmark reference for support AI.'),
    (758, '0195f300-1001-7000-b000-000000000040', 'CASE_STUDIES', 3, 'Netomi HIPAA compliance path opens GPT-5.4 support for healthcare payer clients, unlocking a regulated vertical.'),

    -- AutoBNN × Google CS (759-761) — entity 041
    (759, '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', 4, 'Google AutoBNN deploys in Kenya for regional crop yield forecasting, a flagship development-world AI pilot.'),
    (760, '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', 5, 'AutoBNN wildfire spread prediction reaches production in California state services, a high-impact public sector win.'),
    (761, '0195f300-1001-7000-b000-000000000041', 'CASE_STUDIES', 3, 'AutoBNN traffic flow model reduces congestion 18 percent in Seoul commuter corridors, a measurable urban-AI outcome.'),

    -- MedPaLM × Google CS (762-764) — entity 042
    (762, '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', 4, 'MedPaLM expands to 15 Asian hospitals following the successful Japan pilot, marking the first regional scale deployment.'),
    (763, '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', 4, 'MedPaLM oncology specialization outperforms the generalist on breast cancer screening, a notable domain adaptation result.'),
    (764, '0195f300-1001-7000-b000-000000000042', 'CASE_STUDIES', 4, 'MedPaLM radiology partnership with Siemens Healthineers is announced at RSNA, signaling Big-OEM integration strategy.'),

    -- Copilot Workspace × Microsoft CS (765-767) — entity 043
    (765, '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', 5, 'Copilot Workspace enterprise pilot launches with the first 100 Fortune 500 engineering teams, a major enterprise milestone.'),
    (766, '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', 4, 'GitHub publishes Copilot Workspace productivity data: 55 percent faster PR turnaround, a headline metric for AI dev.'),
    (767, '0195f300-1001-7000-b000-000000000043', 'CASE_STUDIES', 3, 'Copilot Workspace passes independent SOC 2 Type II audit, removing a common enterprise procurement blocker.'),

    -- =================== PAPER_BENCHMARK ===================
    -- MMLU-Pro (768-771) — entity 050 — NLP
    (768, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 5, 'MMLU-Pro April leaderboard update: DeepSeek-R2 preview takes first place from GPT-5.4, a symbolic shift in the reasoning race.'),
    (769, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 4, 'MMLU-Pro evaluation methodology paper is accepted to NeurIPS 2026 Best Paper track, cementing benchmark legitimacy.'),
    (770, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro reasoning subset isolates pure logic from knowledge retrieval, enabling cleaner capability attribution.'),
    (771, '0195f300-1001-7000-b000-000000000050', 'PAPER_BENCHMARK', 3, 'MMLU-Pro multilingual expansion covers 50 languages for cross-cultural evaluation, extending non-English coverage.'),

    -- SWE-bench (772-775) — entity 051 — Coding
    (772, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 5, 'SWE-bench Plus releases with 2500 new real-world pull requests from 40 top repos, countering leaderboard saturation.'),
    (773, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 4, 'SWE-bench industry baseline: Claude 3.7 leads at 62 percent, Grok Code Mode at 56, reshaping the coding model ranking.'),
    (774, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 4, 'SWE-bench multi-file bug fix subtask reveals a performance gap between top and mid-tier models, exposing a hidden weakness.'),
    (775, '0195f300-1001-7000-b000-000000000051', 'PAPER_BENCHMARK', 3, 'SWE-bench Python vs Java comparison shows code language matters less than expected for modern frontier models.'),

    -- GPQA Diamond (776-779) — entity 052 — NLP
    (776, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 4, 'GPQA Diamond chemistry subset is added for fine-grained scientific reasoning evaluation, filling a long-standing gap.'),
    (777, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 3, 'GPQA Diamond human baseline is updated with 200 new PhD annotators from top universities, refreshing the comparison anchor.'),
    (778, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 5, 'GPQA Diamond shows DeepSeek-R2 matches graduate student accuracy on first attempt, a frontier result for open-weight models.'),
    (779, '0195f300-1001-7000-b000-000000000052', 'PAPER_BENCHMARK', 4, 'GPQA Diamond physics problems reveal reasoning model weaknesses on spatial tasks, identifying a concrete failure mode.'),

    -- =================== TOOLS ===================
    -- Cursor (780-782) — entity 020 — IDE & Plugin
    (780, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 5, 'Cursor 1.5 adds multi-cursor AI agents for parallel code edits across files, a significant leap in AI-native IDE UX.'),
    (781, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 4, 'Cursor Team plan launches with shared contexts and usage analytics for organizations, unlocking SMB-to-enterprise upsell.'),
    (782, '0195f300-1001-7000-b000-000000000020', 'TOOLS', 4, 'Cursor Composer mode handles multi-repo refactors with dependency awareness, addressing a frequent power-user request.'),

    -- GitHub Copilot (783-784) — entity 021
    (783, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 4, 'GitHub Copilot Workspace beta opens to all paid subscribers after the waitlist period, broadening accessibility.'),
    (784, '0195f300-1001-7000-b000-000000000021', 'TOOLS', 3, 'GitHub Copilot Chat UI redesign brings persistent conversation threads and pinning, improving long-session workflows.'),

    -- Claude Code (785-786) — entity 022
    (785, '0195f300-1001-7000-b000-000000000022', 'TOOLS', 4, 'Claude Code adds auto-commit feature with AI-generated messages, targeting solo developers who want low-friction git.'),
    (786, '0195f300-1001-7000-b000-000000000022', 'TOOLS', 5, 'Claude Code plugin system opens to third-party developers via a new MCP extension spec, catalyzing the ecosystem.'),

    -- Docker AI (787) — entity 023 — Infra
    (787, '0195f300-1001-7000-b000-000000000023', 'TOOLS', 4, 'Docker AI Compose extension generates multi-service stacks from natural language prompts, lowering ops onboarding friction.'),

    -- =================== SHARED_RESOURCES ===================
    -- HuggingFace (788-790) — entity 030 — Hub
    (788, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 4, 'Hugging Face Dataset 2.0 spec enables streaming multi-modal datasets from S3 buckets, removing a scaling bottleneck.'),
    (789, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 4, 'Hugging Face Inference Endpoints v2 launches with auto-scaling and sub-second cold start, narrowing the gap to cloud rivals.'),
    (790, '0195f300-1001-7000-b000-000000000030', 'SHARED_RESOURCES', 4, 'Hugging Face Model Arena crowdsources head-to-head comparisons with an Elo rating system, complementing static benchmarks.'),

    -- Papers with Code (791-792) — entity 031 — Hub
    (791, '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', 4, 'Papers with Code 2026 trends report highlights reasoning models and agentic benchmarks as the dominant research threads.'),
    (792, '0195f300-1001-7000-b000-000000000031', 'SHARED_RESOURCES', 3, 'Papers with Code introduces a reproducibility badge program for community verification, strengthening publication trust.'),

    -- Awesome LLM (793-794) — entity 032 — Tutorial
    (793, '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', 3, 'Awesome LLM weekly roundup adds 50 new tools across agent and RAG domains, reflecting continued ecosystem sprawl.'),
    (794, '0195f300-1001-7000-b000-000000000032', 'SHARED_RESOURCES', 3, 'Awesome LLM curator guidelines are updated to prioritize production-ready over hobby repos, raising the quality bar.'),

    -- =================== REGULATIONS ===================
    -- EU AI Act (795-798) — entity 060 — International
    (795, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 5, 'EU AI Act transparency report deadline looms: first filings due May 2026 for GPAI providers, forcing compliance action now.'),
    (796, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 4, 'EU AI Act risk tier classification guide is published by the European Commission for enterprises, clarifying deployer obligations.'),
    (797, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 5, 'EU takes first enforcement action under the AI Act against an unnamed biometric vendor, setting a precedent for others.'),
    (798, '0195f300-1001-7000-b000-000000000060', 'REGULATIONS', 4, 'EU AI Act GPAI obligations are clarified: open-source models get a partial exemption path, easing community-model fears.'),

    -- NIST AI RMF (799-800) — entity 061 — International
    (799, '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', 4, 'NIST AI RMF Generative AI Profile is published as a sector-specific addendum for deployers, filling a gap in US guidance.'),
    (800, '0195f300-1001-7000-b000-000000000061', 'REGULATIONS', 3, 'NIST releases an AI RMF healthcare sector guide with a patient privacy controls framework, helping health deployers align.')
    ) AS t(seq, entity_id, page, score, summary)
) LOOP
    i := i + 1;

    -- article_raw id (d prefix for seq 701-800)
    v_art_id := format('0195f300-d%s-7000-8000-000000000001', lpad(rec.seq::text, 3, '0'))::UUID;

    -- published_at from article_raw
    SELECT published_at INTO v_pub_at
    FROM content.article_raw
    WHERE id = v_art_id;

    IF v_pub_at IS NULL THEN
        RAISE NOTICE 'Skipping seq %: article_raw not found (run stage-1-extra-100-apr16-18.sql first)', rec.seq;
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
                    -- APPLIED_RESEARCH: research findings / productivity reports
                    WHEN rec.seq IN (763, 766)
                      THEN 'APPLIED_RESEARCH'
                    -- CASE_STUDY: deployment/customer stories
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

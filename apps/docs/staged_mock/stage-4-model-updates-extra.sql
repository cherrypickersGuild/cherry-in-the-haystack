-- ============================================================
-- Stage 4 Extra — MODEL_UPDATES 50개 agent_json_raw UPDATE
-- Prerequisites: stage-1-model-updates-extra.sql applied
--                + ingest-bulk + pregen-ai-state API 실행 후
-- seq 101 ~ 150
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
BEGIN

FOR rec IN (
    SELECT * FROM (VALUES
    -- (seq, entity_id, cat_id, cat_name, entity_name, score, summary, why_matters)
    -- OpenAI Family
    (101, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          4, 'GPT-5.4 receives system prompt injection mitigations improving safety.', 'Critical security improvement for production deployments.'),
    (102, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          3, 'GPT-5.4 Vision API adds improved OCR and diagram understanding.', 'Expands use cases for document and visual analysis pipelines.'),
    (103, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          5, 'OpenAI launches o3 with breakthrough reasoning capabilities.', 'New SOTA reasoning model changes the competitive landscape.'),
    (104, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          3, 'GPT-5.4 function calling latency reduced by 40% in new benchmarks.', 'Faster tool use enables more responsive agentic applications.'),
    -- Anthropic Family
    (105, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 4, 'Claude 3.7 Haiku offers 3x faster inference at lower cost.', 'New cost-efficient tier expands Claude adoption for high-volume tasks.'),
    (106, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 4, 'Claude 3.7 Sonnet improves parallel tool use for complex agents.', 'Key upgrade for multi-step agentic workflows.'),
    (107, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 5, 'Anthropic releases Constitutional AI v2 with improved value alignment.', 'Sets new standard for AI safety in production deployments.'),
    (108, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 3, 'Claude 3.7 Opus early access opens to select enterprise customers.', 'Most capable Claude model available for advanced use cases.'),
    -- Google Family
    (109, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  4, 'Gemini 2.0 Pro now supports 2M token context window.', 'Enables processing entire codebases or large document sets.'),
    (110, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  4, 'Google releases Gemma 3 with improved instruction following.', 'Strong open-weight option for self-hosted deployments.'),
    (111, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  4, 'Gemini 2.0 Flash Thinking Mode reaches general availability.', 'Structured reasoning now production-ready for complex queries.'),
    (112, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  5, 'AlphaCode 3 achieves gold medal performance on competitive programming.', 'Breakthrough in AI coding capability with direct competition implications.'),
    -- xAI Family
    (113, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             4, 'Grok-3 API opens publicly with competitive pricing.', 'New option for developers seeking alternatives to OpenAI and Anthropic.'),
    (114, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             3, 'Grok-3 outperforms GPT-5.4 on HumanEval++ coding benchmark.', 'Raises competitive bar for coding-focused model selection.'),
    (115, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             3, 'xAI Aurora multimodal model shows strong video understanding.', 'Expands xAI capability beyond text to video analysis.'),
    -- Meta Family
    (116, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           4, 'LLaMA 4 Scout optimized for edge deployment with 8B parameters.', 'Opens door for on-device AI applications with strong performance.'),
    (117, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           5, 'LLaMA 4 Maverick 400B matches GPT-5.4 on most benchmarks.', 'Strongest open-weight model available, changes enterprise AI calculus.'),
    (118, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           3, 'Meta details RLHF training methodology for LLaMA 4.', 'Useful technical reference for teams training custom models.'),
    -- DeepSeek Family
    (119, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    4, 'DeepSeek-V3 update reduces inference latency by 35%.', 'Practical improvement for latency-sensitive production use cases.'),
    (120, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    5, 'DeepSeek Prover V2 achieves 88% on competition mathematics.', 'State-of-the-art mathematical reasoning from open-weight model.'),
    (121, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    3, 'DeepSeek-R2 architecture details surface in community analysis.', 'Signals continued rapid iteration from DeepSeek team.'),
    (122, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    4, 'DeepSeek releases MoE training code enabling community reproduction.', 'Advances open research on efficient large model training.'),
    -- Mistral Family
    (123, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 4, 'Mistral Small 3.1 achieves strong performance at 22B parameters.', 'Efficient model for teams with limited compute budgets.'),
    (124, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 3, 'Mistral Large 2 leads multilingual evals for EU languages.', 'Key differentiator for European enterprise deployments.'),
    (125, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 4, 'Codestral 2.0 achieves top-3 on SWE-bench code generation.', 'Strong specialized code model for engineering teams.'),
    -- =================== 지난 주 ===================
    -- OpenAI
    (126, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          4, 'GPT-5.4 fine-tuning API now generally available.', 'Enables domain adaptation without prompt engineering overhead.'),
    (127, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          3, 'OpenAI open-sources its Evals framework for model testing.', 'Community can now contribute evaluation benchmarks.'),
    (128, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          3, 'GPT-5.4 streaming latency drops 25% in latest update.', 'Improves user experience for real-time applications.'),
    (129, '0195f300-1001-7000-b000-000000000001', '0195f300-2001-7000-a000-000000000001', 'OpenAI Family', 'GPT-5.4',          4, 'OpenAI publishes GPT-5.4 comprehensive safety evaluation card.', 'Important transparency document for enterprise procurement decisions.'),
    -- Anthropic
    (130, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 4, 'Claude 3.7 prompt caching reduces costs up to 90% for repeated context.', 'Major cost reduction for RAG and long-context applications.'),
    (131, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 5, 'Anthropic Model Spec v2 expands guidelines for agentic behavior.', 'Critical reading for teams deploying autonomous AI agents.'),
    (132, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 3, 'Claude 3.7 Batch API now processes 50% more requests per minute.', 'Practical throughput improvement for bulk processing pipelines.'),
    (133, '0195f300-1001-7000-b000-000000000002', '0195f300-2001-7000-a000-000000000002', 'Anthropic Family', 'Claude 3.7 Sonnet', 3, 'Claude 3.7 Sonnet tops multilingual reasoning benchmarks.', 'Strongest multilingual option for global deployments.'),
    -- Google
    (134, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  3, 'Gemini 2.0 Flash adds native audio understanding capabilities.', 'Enables voice and audio analysis without external transcription.'),
    (135, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  3, 'Google PaLM 3 research preview shows improved factuality.', 'Addresses key limitation in current generation models.'),
    (136, '0195f300-1001-7000-b000-000000000003', '0195f300-2001-7000-a000-000000000003', 'Google Family', 'Gemini 2.0 Flash',  3, 'Gemini 2.0 Code Assist adds multi-file project understanding.', 'Stronger IDE integration for large codebase navigation.'),
    -- xAI
    (137, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             4, 'Grok-3 integrates real-time web search with citations.', 'Reduces hallucination for current-events queries.'),
    (138, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             3, 'xAI expands Colossus supercomputer to 200K H100 GPUs.', 'Signals aggressive scaling strategy for future model development.'),
    (139, '0195f300-1001-7000-b000-000000000004', '0195f300-2001-7000-a000-000000000004', 'xAI Family', 'Grok-3',             3, 'Grok-3 image generation feature launches in beta.', 'Extends xAI into multimodal generation market.'),
    -- Meta
    (140, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           3, 'Comprehensive LLaMA 4 quantization guide achieves 2-bit inference.', 'Enables running LLaMA 4 on consumer hardware.'),
    (141, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           4, 'Meta FAIR publishes long-context LLaMA 4 training techniques.', 'Useful reference for teams building long-context applications.'),
    (142, '0195f300-1001-7000-b000-000000000005', '0195f300-2001-7000-a000-000000000005', 'Meta Family', 'LLaMA 4',           3, 'LLaMA 4 vs Gemma 3 comprehensive open-model comparison.', 'Helps teams choose the right open-weight model for their use case.'),
    -- DeepSeek
    (143, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    4, 'DeepSeek-R1 distillation to 7B model maintains 90% performance.', 'Practical technique for deploying reasoning models on limited hardware.'),
    (144, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    3, 'DeepSeek V3 API rate limits increased 5x for enterprise users.', 'Removes key barrier for production DeepSeek deployments.'),
    (145, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    4, 'DeepSeek-R1 beats o3 on 7 of 10 reasoning benchmarks.', 'Open-weight model achieves parity with closed frontier models.'),
    (146, '0195f300-1001-7000-b000-000000000006', '0195f300-2001-7000-a000-000000000006', 'DeepSeek Family', 'DeepSeek-R1',    5, 'DeepSeek MoE architecture enables 3x more parameters at same cost.', 'Fundamental architectural innovation with broad industry implications.'),
    -- Mistral
    (147, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 3, 'Mistral Large 2 tool calling reliability improves to 94%.', 'Addresses key pain point for agentic application developers.'),
    (148, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 3, 'Mistral NeMo 12B fine-tuning achieves domain expert performance.', 'Cost-effective path to specialized model capabilities.'),
    (149, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 4, 'Le Chat consumer app reaches 1M users in first week.', 'Validates Mistral consumer strategy and brand recognition.'),
    (150, '0195f300-1001-7000-b000-000000000007', '0195f300-2001-7000-a000-000000000007', 'Mistral Family', 'Mistral Large 2', 4, 'Mistral Large 2 tops coding benchmarks among European models.', 'Reinforces Mistral position as premier EU AI provider.')

    ) AS t(seq, entity_id, cat_id, cat_name, entity_name, score, summary, why_matters)
)
LOOP
    i := i + 1;
    v_art_id := ('0195f300-a' || lpad(rec.seq::TEXT, 3, '0') || '-7000-8000-000000000001')::UUID;

    SELECT published_at INTO v_pub_at FROM content.article_raw WHERE id = v_art_id;

    SELECT uas.id INTO v_uas_id
    FROM content.user_article_state uas
    WHERE uas.article_raw_id = v_art_id
      AND uas.user_id = v_user_id
      AND uas.revoked_at IS NULL
    LIMIT 1;

    SELECT aai.id INTO v_aai_id
    FROM content.user_article_ai_state aai
    WHERE aai.user_article_state_id = v_uas_id
      AND aai.ai_status = 'PENDING'
    LIMIT 1;

    UPDATE content.user_article_ai_state
    SET
        agent_json_raw = jsonb_build_object(
            'idempotency_key', 'uas:' || lower(v_uas_id::TEXT),
            'version', '0.3',
            'representative_entity', jsonb_build_object(
                'id', rec.entity_id, 'page', 'MODEL_UPDATES',
                'category_id', rec.cat_id, 'category_name', rec.cat_name,
                'name', rec.entity_name
            ),
            'ai_summary', rec.summary,
            'ai_score', rec.score,
            'ai_classification_json', jsonb_build_object(
                'final_path', jsonb_build_object('page', 'MODEL_UPDATES', 'category_name', rec.cat_name, 'entity_name', rec.entity_name),
                'candidates', jsonb_build_array(jsonb_build_object('page', 'MODEL_UPDATES', 'category_name', rec.cat_name, 'entity_name', rec.entity_name, 'confidence', round(0.80 + rec.score * 0.03, 2))),
                'decision_reason', 'title and source strongly match tracked entity'
            ),
            'side_category_code', NULL,
            'ai_tags_json', jsonb_build_array(
                jsonb_build_object('kind', 'TAG', 'value', lower(rec.entity_name)),
                jsonb_build_object('kind', 'TAG', 'value', lower(rec.cat_name)),
                jsonb_build_object('kind', 'KEYWORD', 'value', 'model_updates', 'frequency', 3 + rec.score, 'confidence', round(0.6 + rec.score * 0.08, 2))
            ),
            'ai_snippets_json', jsonb_build_object(
                'why_it_matters', rec.why_matters,
                'key_points', jsonb_build_array('Key update for ' || rec.entity_name, rec.cat_name || ' category development'),
                'risk_notes', jsonb_build_array('Verify claims with independent benchmarks')
            ),
            'ai_evidence_json', jsonb_build_object(
                'evidence_items', jsonb_build_array(jsonb_build_object(
                    'kind', 'quote', 'text', left(rec.summary, 80),
                    'url', 'https://example.com/article-' || rec.seq,
                    'source_name', 'Seed Source', 'published_at', v_pub_at
                ))
            ),
            'ai_structured_extraction_json', jsonb_build_object(
                'source', jsonb_build_object('name', 'Seed Source', 'type', 'RSS'),
                'review', jsonb_build_object('type', 'Announcement', 'reviewer', NULL, 'comment', NULL)
            )
        ),
        ai_model_name    = 'claude-sonnet-4-6',
        ai_processed_at  = v_pub_at + INTERVAL '2 hours'
    WHERE id = v_aai_id;

END LOOP;

RAISE NOTICE 'Stage 4 Extra: Updated % MODEL_UPDATES ai_state rows.', i;
END $$;

COMMIT;

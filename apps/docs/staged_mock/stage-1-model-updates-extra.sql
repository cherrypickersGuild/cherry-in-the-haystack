-- ============================================================
-- Stage 1 Extra — MODEL_UPDATES 50개 추가 (주간 통계용)
-- 이번 주 (2026-04-02 ~ 2026-04-08): 25개
-- 지난 주 (2026-03-26 ~ 2026-04-01): 25개
-- seq 101 ~ 150
-- Prerequisites: stage-0-foundation.sql, stage-1-article-raw.sql
-- ============================================================

BEGIN;

INSERT INTO content.article_raw (id, source_id, title, url, published_at, representative_key, language)
VALUES
-- =================== 이번 주: Apr 2~8 (25개) ===================
-- OpenAI (4)
('0195f300-a101-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'GPT-5.4 System Prompt Injection Mitigations',        'https://example.com/article-101', '2026-04-08T09:00:00+09:00', 'seed-101-' || md5('GPT-5.4 System Prompt Injection Mitigations'),        'en'),
('0195f300-a102-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'GPT-5.4 Vision API Improvements',                    'https://example.com/article-102', '2026-04-07T09:00:00+09:00', 'seed-102-' || md5('GPT-5.4 Vision API Improvements'),                    'en'),
('0195f300-a103-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'OpenAI Launches o3 Reasoning Model',                  'https://example.com/article-103', '2026-04-06T09:00:00+09:00', 'seed-103-' || md5('OpenAI Launches o3 Reasoning Model'),                  'en'),
('0195f300-a104-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'GPT-5.4 Function Calling Latency Benchmarks',         'https://example.com/article-104', '2026-04-05T09:00:00+09:00', 'seed-104-' || md5('GPT-5.4 Function Calling Latency Benchmarks'),         'en'),
-- Anthropic (4)
('0195f300-a105-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude 3.7 Haiku Released',                           'https://example.com/article-105', '2026-04-08T09:00:00+09:00', 'seed-105-' || md5('Claude 3.7 Haiku Released'),                           'en'),
('0195f300-a106-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude 3.7 Sonnet Tool Use Improvements',             'https://example.com/article-106', '2026-04-07T09:00:00+09:00', 'seed-106-' || md5('Claude 3.7 Sonnet Tool Use Improvements'),             'en'),
('0195f300-a107-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Anthropic Releases Constitutional AI v2',             'https://example.com/article-107', '2026-04-05T09:00:00+09:00', 'seed-107-' || md5('Anthropic Releases Constitutional AI v2'),             'en'),
('0195f300-a108-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Claude 3.7 Opus Early Access Program',                'https://example.com/article-108', '2026-04-04T09:00:00+09:00', 'seed-108-' || md5('Claude 3.7 Opus Early Access Program'),                'en'),
-- Google (4)
('0195f300-a109-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Gemini 2.0 Pro Context Window Expansion',             'https://example.com/article-109', '2026-04-08T09:00:00+09:00', 'seed-109-' || md5('Gemini 2.0 Pro Context Window Expansion'),             'en'),
('0195f300-a110-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Google Releases Gemma 3 Open Weights',                'https://example.com/article-110', '2026-04-06T09:00:00+09:00', 'seed-110-' || md5('Google Releases Gemma 3 Open Weights'),                'en'),
('0195f300-a111-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Gemini 2.0 Flash Thinking Mode GA',                   'https://example.com/article-111', '2026-04-04T09:00:00+09:00', 'seed-111-' || md5('Gemini 2.0 Flash Thinking Mode GA'),                   'en'),
('0195f300-a112-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000009', 'Google DeepMind AlphaCode 3 Benchmark',               'https://example.com/article-112', '2026-04-03T09:00:00+09:00', 'seed-112-' || md5('Google DeepMind AlphaCode 3 Benchmark'),               'en'),
-- xAI (3)
('0195f300-a113-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Grok-3 API Public Launch',                            'https://example.com/article-113', '2026-04-07T09:00:00+09:00', 'seed-113-' || md5('Grok-3 API Public Launch'),                            'en'),
('0195f300-a114-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Grok-3 vs GPT-5.4: Coding Benchmark',                 'https://example.com/article-114', '2026-04-05T09:00:00+09:00', 'seed-114-' || md5('Grok-3 vs GPT-5.4: Coding Benchmark'),                 'en'),
('0195f300-a115-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'xAI Aurora Multimodal Model Preview',                 'https://example.com/article-115', '2026-04-03T09:00:00+09:00', 'seed-115-' || md5('xAI Aurora Multimodal Model Preview'),                 'en'),
-- Meta (3)
('0195f300-a116-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'LLaMA 4 Scout: Efficient Edge Model',                 'https://example.com/article-116', '2026-04-08T09:00:00+09:00', 'seed-116-' || md5('LLaMA 4 Scout: Efficient Edge Model'),                 'en'),
('0195f300-a117-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'LLaMA 4 Maverick 400B Released',                      'https://example.com/article-117', '2026-04-06T09:00:00+09:00', 'seed-117-' || md5('LLaMA 4 Maverick 400B Released'),                      'en'),
('0195f300-a118-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'Meta Releases LLaMA 4 RLHF Details',                  'https://example.com/article-118', '2026-04-04T09:00:00+09:00', 'seed-118-' || md5('Meta Releases LLaMA 4 RLHF Details'),                  'en'),
-- DeepSeek (4)
('0195f300-a119-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek-V3 Update: Faster Inference',                'https://example.com/article-119', '2026-04-07T09:00:00+09:00', 'seed-119-' || md5('DeepSeek-V3 Update: Faster Inference'),                'en'),
('0195f300-a120-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek Prover V2 Math Benchmark',                   'https://example.com/article-120', '2026-04-06T09:00:00+09:00', 'seed-120-' || md5('DeepSeek Prover V2 Math Benchmark'),                   'en'),
('0195f300-a121-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'DeepSeek-R2 Architecture Leaked',                     'https://example.com/article-121', '2026-04-04T09:00:00+09:00', 'seed-121-' || md5('DeepSeek-R2 Architecture Leaked'),                     'en'),
('0195f300-a122-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek Open-Sources MoE Training Code',             'https://example.com/article-122', '2026-04-02T09:00:00+09:00', 'seed-122-' || md5('DeepSeek Open-Sources MoE Training Code'),             'en'),
-- Mistral (3)
('0195f300-a123-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral Small 3.1 Released',                          'https://example.com/article-123', '2026-04-07T09:00:00+09:00', 'seed-123-' || md5('Mistral Small 3.1 Released'),                          'en'),
('0195f300-a124-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral Large 2 Multilingual Eval',                   'https://example.com/article-124', '2026-04-05T09:00:00+09:00', 'seed-124-' || md5('Mistral Large 2 Multilingual Eval'),                   'en'),
('0195f300-a125-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Codestral 2.0: Code Generation Model',                'https://example.com/article-125', '2026-04-03T09:00:00+09:00', 'seed-125-' || md5('Codestral 2.0: Code Generation Model'),                'en'),

-- =================== 지난 주: Mar 26~Apr 1 (25개) ===================
-- OpenAI (4)
('0195f300-a126-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'GPT-5.4 Fine-Tuning API Generally Available',         'https://example.com/article-126', '2026-04-01T09:00:00+09:00', 'seed-126-' || md5('GPT-5.4 Fine-Tuning API Generally Available'),         'en'),
('0195f300-a127-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'OpenAI Evals Framework Open-Sourced',                 'https://example.com/article-127', '2026-03-30T09:00:00+09:00', 'seed-127-' || md5('OpenAI Evals Framework Open-Sourced'),                 'en'),
('0195f300-a128-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'GPT-5.4 Streaming Performance Improvements',          'https://example.com/article-128', '2026-03-28T09:00:00+09:00', 'seed-128-' || md5('GPT-5.4 Streaming Performance Improvements'),          'en'),
('0195f300-a129-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000001', 'OpenAI Announces GPT-5.4 Safety Card',                'https://example.com/article-129', '2026-03-26T09:00:00+09:00', 'seed-129-' || md5('OpenAI Announces GPT-5.4 Safety Card'),                'en'),
-- Anthropic (4)
('0195f300-a130-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude 3.7 Prompt Caching Beta',                      'https://example.com/article-130', '2026-04-01T09:00:00+09:00', 'seed-130-' || md5('Claude 3.7 Prompt Caching Beta'),                      'en'),
('0195f300-a131-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Anthropic Model Spec v2 Published',                   'https://example.com/article-131', '2026-03-29T09:00:00+09:00', 'seed-131-' || md5('Anthropic Model Spec v2 Published'),                   'en'),
('0195f300-a132-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000002', 'Claude 3.7 Batch API Improvements',                   'https://example.com/article-132', '2026-03-27T09:00:00+09:00', 'seed-132-' || md5('Claude 3.7 Batch API Improvements'),                   'en'),
('0195f300-a133-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Claude 3.7 Sonnet Multilingual Benchmarks',           'https://example.com/article-133', '2026-03-26T09:00:00+09:00', 'seed-133-' || md5('Claude 3.7 Sonnet Multilingual Benchmarks'),           'en'),
-- Google (3)
('0195f300-a134-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Gemini 2.0 Flash Audio Understanding',                'https://example.com/article-134', '2026-03-31T09:00:00+09:00', 'seed-134-' || md5('Gemini 2.0 Flash Audio Understanding'),                'en'),
('0195f300-a135-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Google PaLM 3 Research Preview',                      'https://example.com/article-135', '2026-03-28T09:00:00+09:00', 'seed-135-' || md5('Google PaLM 3 Research Preview'),                      'en'),
('0195f300-a136-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000003', 'Gemini 2.0 Code Assist Improvements',                 'https://example.com/article-136', '2026-03-26T09:00:00+09:00', 'seed-136-' || md5('Gemini 2.0 Code Assist Improvements'),                 'en'),
-- xAI (3)
('0195f300-a137-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'Grok-3 Real-Time Web Search Integration',             'https://example.com/article-137', '2026-03-31T09:00:00+09:00', 'seed-137-' || md5('Grok-3 Real-Time Web Search Integration'),             'en'),
('0195f300-a138-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000007', 'xAI Colossus Supercomputer Expansion',                'https://example.com/article-138', '2026-03-28T09:00:00+09:00', 'seed-138-' || md5('xAI Colossus Supercomputer Expansion'),                'en'),
('0195f300-a139-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Grok-3 Image Generation Feature',                     'https://example.com/article-139', '2026-03-26T09:00:00+09:00', 'seed-139-' || md5('Grok-3 Image Generation Feature'),                     'en'),
-- Meta (3)
('0195f300-a140-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'LLaMA 4 Quantization Guide',                          'https://example.com/article-140', '2026-03-31T09:00:00+09:00', 'seed-140-' || md5('LLaMA 4 Quantization Guide'),                          'en'),
('0195f300-a141-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000008', 'Meta FAIR Research: Long Context LLM',                'https://example.com/article-141', '2026-03-29T09:00:00+09:00', 'seed-141-' || md5('Meta FAIR Research: Long Context LLM'),                'en'),
('0195f300-a142-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'LLaMA 4 vs Gemma 3: Open Model Showdown',             'https://example.com/article-142', '2026-03-27T09:00:00+09:00', 'seed-142-' || md5('LLaMA 4 vs Gemma 3: Open Model Showdown'),             'en'),
-- DeepSeek (4)
('0195f300-a143-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek-R1 Distillation Techniques',                 'https://example.com/article-143', '2026-03-31T09:00:00+09:00', 'seed-143-' || md5('DeepSeek-R1 Distillation Techniques'),                 'en'),
('0195f300-a144-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek V3 API Rate Limit Increase',                 'https://example.com/article-144', '2026-03-29T09:00:00+09:00', 'seed-144-' || md5('DeepSeek V3 API Rate Limit Increase'),                 'en'),
('0195f300-a145-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'DeepSeek-R1 vs o3 Reasoning Comparison',              'https://example.com/article-145', '2026-03-27T09:00:00+09:00', 'seed-145-' || md5('DeepSeek-R1 vs o3 Reasoning Comparison'),              'en'),
('0195f300-a146-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000004', 'DeepSeek MoE Architecture Deep Dive',                 'https://example.com/article-146', '2026-03-26T09:00:00+09:00', 'seed-146-' || md5('DeepSeek MoE Architecture Deep Dive'),                 'en'),
-- Mistral (4)
('0195f300-a147-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral Large 2 Tool Calling Update',                 'https://example.com/article-147', '2026-03-31T09:00:00+09:00', 'seed-147-' || md5('Mistral Large 2 Tool Calling Update'),                 'en'),
('0195f300-a148-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral NeMo 12B Fine-Tuning Results',                'https://example.com/article-148', '2026-03-29T09:00:00+09:00', 'seed-148-' || md5('Mistral NeMo 12B Fine-Tuning Results'),                'en'),
('0195f300-a149-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Le Chat: Mistral Consumer App Launch',                'https://example.com/article-149', '2026-03-27T09:00:00+09:00', 'seed-149-' || md5('Le Chat: Mistral Consumer App Launch'),                'en'),
('0195f300-a150-7000-8000-000000000001', '0195f300-0001-7000-a000-000000000005', 'Mistral Large 2 Coding Benchmark Results',            'https://example.com/article-150', '2026-03-26T09:00:00+09:00', 'seed-150-' || md5('Mistral Large 2 Coding Benchmark Results'),            'en');

COMMIT;

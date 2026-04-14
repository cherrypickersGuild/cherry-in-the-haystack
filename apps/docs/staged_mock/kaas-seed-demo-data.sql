-- ============================================
-- Cherry KaaS 데모 시딩 데이터
-- 퍼블리싱 화면과 동일한 목 데이터를 DB에 삽입
-- 실행 전 kaas-tables-v2-schema.sql이 먼저 실행되어 있어야 함
-- ============================================

-- ============================================
-- 0. 카탈로그 개념 9개 + Evidence (지식 상품)
-- summary: 카탈로그 미리보기용 짧은 요약
-- content_md: 구매 후 에이전트에게 전달하는 실제 지식 본문
-- ============================================

INSERT INTO kaas.concept (id, title, category, summary, content_md, quality_score, source_count, updated_at, related_concepts)
VALUES
('rag', 'Retrieval-Augmented Generation', 'Basics',
 '인퍼런스 시점에 외부 지식을 동적으로 주입하여 LLM 응답의 정확도를 높이는 기법. 벡터 DB 기반 검색과 생성 모델을 결합하여 hallucination을 줄이고 최신 정보를 반영한다.',
 E'# Retrieval-Augmented Generation (RAG)\n\n## 개요\nRAG는 LLM이 응답을 생성하기 전에 외부 지식 소스에서 관련 문서를 검색(retrieve)하여 컨텍스트로 주입하는 기법입니다.\n\n## 핵심 구성요소\n1. **Retriever**: 질문과 관련된 문서를 벡터 DB에서 검색\n2. **Generator**: 검색된 문서를 컨텍스트로 받아 답변 생성\n3. **Vector Store**: 문서 임베딩을 저장하고 ANN 검색 수행\n\n## 구현 패턴\n- Naive RAG: 단순 검색 → 생성 (정확도 ~60%)\n- Advanced RAG: Hybrid search + Reranking (정확도 85%+)\n- Contextual RAG: 청크에 context prefix 추가 (실패율 67% 감소)\n\n## 코드 예시\n```python\nfrom langchain.chains import RetrievalQA\nqa_chain = RetrievalQA.from_chain_type(\n    llm=ChatOpenAI(model=\"gpt-4\"),\n    retriever=vectorstore.as_retriever(search_kwargs={\"k\": 5}),\n    chain_type=\"stuff\"\n)\nresult = qa_chain.run(\"What is RAG?\")\n```\n\n## 주요 메트릭\n- Precision@k: 검색된 k개 문서 중 관련 문서 비율\n- Recall@k: 전체 관련 문서 중 검색된 비율\n- MRR: 첫 번째 관련 문서의 순위 역수',
 4.8, 12, '2026-04-11', '["Embeddings", "Vector Databases", "Hybrid Search"]'::jsonb),

('chain-of-thought', 'Chain-of-Thought Prompting', 'Advanced',
 'LLM이 최종 답변 전에 중간 추론 단계를 명시적으로 생성하도록 유도하는 프롬프팅 기법. 수학, 논리, 다단계 추론 문제에서 성능을 크게 향상시킨다.',
 E'# Chain-of-Thought (CoT) Prompting\n\n## 개요\nCoT는 LLM이 최종 답변 전에 중간 추론 단계를 명시적으로 생성하도록 유도하는 프롬프팅 기법입니다.\n\n## 주요 변형\n1. **Few-shot CoT**: 예시와 함께 추론 과정을 보여줌\n2. **Zero-shot CoT**: \"Let''s think step by step\" 한 줄 추가\n3. **Self-Consistency**: 여러 추론 경로 중 다수결\n4. **Tree-of-Thought**: 트리 구조로 추론 분기 탐색\n\n## 효과\n- GSM8K 벤치마크: 기존 대비 +20% 정확도 (Wei et al. 2022)\n- Zero-shot CoT만으로도 대폭 향상 (Kojima et al.)\n\n## 프롬프트 예시\n```\nQ: Roger has 5 tennis balls. He buys 2 more cans of 3. How many does he have?\n\nA: Let''s think step by step.\n1. Roger starts with 5 balls.\n2. He buys 2 cans × 3 balls = 6 balls.\n3. Total: 5 + 6 = 11 balls.\nThe answer is 11.\n```',
 4.5, 8, '2026-04-08', '["Prompting Techniques", "Self-Consistency", "Tree-of-Thought"]'::jsonb),

('embeddings', 'Embeddings & Vector Databases', 'Basics',
 '텍스트를 고차원 밀집 벡터로 변환하여 의미적 유사도를 계산하는 기술. 벡터 DB는 이 임베딩을 저장하고 ANN 검색으로 빠르게 유사 문서를 찾는다.',
 E'# Embeddings & Vector Databases\n\n## 임베딩이란\n텍스트를 고차원 밀집 벡터(dense vector)로 변환하여 의미적 유사도를 수치화하는 기술입니다.\n\n## 주요 모델\n- **text-embedding-3-large** (OpenAI): 3072 차원, Matryoshka 표현\n- **BGE-M3** (BAAI): 다국어, sparse+dense 하이브리드\n- **Cohere embed-v3**: 다국어, 검색 최적화\n\n## 벡터 DB 비교\n| DB | 인덱스 | 특징 |\n|---|---|---|\n| Pinecone | 자체 | 완전 관리형 |\n| Weaviate | HNSW | 하이브리드 검색 |\n| Qdrant | HNSW | Rust 기반 고성능 |\n| Milvus | IVF+PQ | 대규모 데이터 |\n\n## 핵심 개념\n- **ANN (Approximate Nearest Neighbor)**: 정확도를 약간 희생하고 속도 극대화\n- **HNSW**: recall-latency 트레이드오프 가장 범용적\n- **코사인 유사도**: 벡터 간 각도로 유사성 측정',
 4.2, 15, '2026-04-12', '["RAG", "Semantic Search", "Dimensionality Reduction"]'::jsonb),

('fine-tuning', 'Fine-tuning & PEFT', 'Basics',
 '사전 학습된 LLM을 특정 도메인/태스크에 맞게 추가 학습하는 기법. LoRA, QLoRA 등 파라미터 효율적 방법으로 GPU 비용을 대폭 줄인다.',
 E'# Fine-tuning & PEFT\n\n## 개요\nPre-trained LLM을 특정 도메인이나 태스크에 맞게 추가 학습하는 기법입니다.\n\n## PEFT 방법론\n1. **LoRA**: Low-Rank Adaptation. 파라미터 0.1%만 학습, full fine-tuning 동등 성능\n2. **QLoRA**: 4-bit 양자화 + LoRA. 단일 GPU에서 65B 모델 학습 가능\n3. **Prefix Tuning**: 입력 앞에 학습 가능한 prefix 추가\n4. **Adapter**: 각 레이어에 작은 어댑터 모듈 삽입\n\n## 언제 Fine-tuning을 해야 하나\n- 특정 도메인 용어/스타일이 필요할 때\n- 프롬프팅만으로 충분한 성능이 안 나올 때\n- 일관된 출력 형식이 필요할 때\n\n## 코드 예시 (LoRA with PEFT)\n```python\nfrom peft import LoraConfig, get_peft_model\nconfig = LoraConfig(r=16, lora_alpha=32, target_modules=[\"q_proj\", \"v_proj\"])\nmodel = get_peft_model(base_model, config)\n```',
 4.6, 10, '2026-03-28', '["LoRA", "QLoRA", "Instruction Tuning"]'::jsonb),

('multi-agent', 'Multi-Agent Systems', 'Advanced',
 '여러 AI 에이전트가 역할을 분담하고 협력하여 복잡한 태스크를 수행하는 아키텍처.',
 E'# Multi-Agent Systems\n\n## 개요\n여러 AI 에이전트가 각자 역할을 맡고 협력하여 복잡한 태스크를 수행하는 아키텍처입니다.\n\n## 주요 프레임워크\n1. **AutoGen** (Microsoft): 대화 기반, 코드 생성에 강점\n2. **CrewAI**: 역할 기반 오케스트레이션, 자연어 워크플로우\n3. **LangGraph**: 상태 머신 기반, 복잡한 분기 처리\n\n## 설계 패턴\n- **Supervisor**: 중앙 에이전트가 하위 에이전트에게 태스크 분배\n- **Peer-to-peer**: 에이전트 간 직접 대화\n- **Hierarchical**: 다단계 위임 구조\n\n## 고려사항\n- 에이전트 간 통신 프로토콜 (A2A, MCP)\n- 메모리 공유 vs 격리\n- 실패 처리 및 재시도',
 4.3, 7, '2026-04-10', '["Agent Architectures", "CrewAI", "LangGraph"]'::jsonb),

('evaluation', 'LLM Evaluation & Benchmarks', 'Basics',
 'LLM 출력 품질을 체계적으로 측정. LLM-as-judge, 인간 평가 조합으로 정확도, 유용성, 안전성 평가.',
 E'# LLM Evaluation & Benchmarks\n\n## 평가 방법론\n1. **자동 메트릭**: BLEU, ROUGE, BERTScore\n2. **LLM-as-Judge**: GPT-4가 출력 품질 판정 (인간 평가와 80%+ 일치)\n3. **인간 평가**: 정확도, 유용성, 안전성 직접 평가\n\n## 주요 벤치마크\n- **MMLU**: 다분야 지식 테스트\n- **HumanEval**: 코드 생성 능력\n- **GSM8K**: 수학 추론\n- **TruthfulQA**: 사실성 검증\n\n## 다차원 평가 프레임워크\n- 정확도 (factual accuracy)\n- 유해성 (toxicity, bias)\n- 일관성 (consistency across prompts)\n- 지시 따르기 (instruction following)\n\n## 실무 팁\n- 단일 벤치마크보다 다차원 평가가 신뢰적\n- 도메인 특화 평가 데이터셋 구축 필요',
 4.1, 9, '2026-04-05', '["Benchmarks", "LLM-as-Judge", "Red Teaming"]'::jsonb),

('prompt-engineering', 'Prompt Engineering', 'Basics',
 'LLM에 전달하는 프롬프트를 체계적으로 설계하여 원하는 출력을 이끌어내는 기법.',
 E'# Prompt Engineering\n\n## 핵심 원칙\n1. **구체적 지시**: 모호하지 않게 명확히 요청\n2. **구분자 사용**: XML 태그, 마크다운으로 섹션 분리\n3. **단계별 분해**: 복잡한 태스크를 작은 단계로 나누기\n4. **예시 제공**: Few-shot으로 원하는 출력 형태 보여주기\n\n## 고급 기법\n- **System Prompt**: 역할, 톤, 제약조건 설정\n- **Few-shot Learning**: 2-5개 예시로 패턴 학습\n- **Chain-of-Thought**: 추론 과정 유도\n- **XML Tags**: Claude에서 응답 일관성 40% 향상\n\n## 프롬프트 템플릿\n```\n<role>You are a senior AI engineer.</role>\n<task>Analyze the following code for performance issues.</task>\n<format>Return a JSON with {issue, severity, suggestion}.</format>\n<code>{user_code}</code>\n```\n\n## 안티패턴\n- 너무 긴 프롬프트 (토큰 낭비)\n- 모순되는 지시\n- 예시 없이 복잡한 형식 요구',
 4.4, 11, '2026-04-02', '["Chain-of-Thought", "Few-shot Learning", "System Prompts"]'::jsonb),

('agent-architectures', 'Agent Architectures', 'Advanced',
 'LLM 기반 자율 에이전트 설계 패턴. ReAct, Plan-and-Execute, Reflection으로 도구 사용, 계획, 자기 교정 구현.',
 E'# Agent Architectures\n\n## 주요 패턴\n1. **ReAct**: Reasoning + Acting 교차. 추론→행동→관찰 반복\n2. **Plan-and-Execute**: 먼저 계획 수립, 그 다음 단계별 실행\n3. **Reflection**: 자기 출력을 평가하고 개선하는 자기 교정 루프\n4. **Tool-calling**: 외부 도구(API, DB, 코드 실행)를 호출하는 패턴\n\n## ReAct 예시\n```\nThought: I need to find the population of Tokyo.\nAction: search(\"Tokyo population 2024\")\nObservation: Tokyo has 13.96 million people.\nThought: I now have the answer.\nAnswer: Tokyo''s population is approximately 13.96 million.\n```\n\n## 프레임워크 비교\n| 프레임워크 | 패턴 | 강점 |\n|---|---|---|\n| LangChain | Tool-calling | 가장 범용적 |\n| LangGraph | State machine | 복잡한 분기 |\n| CrewAI | Role-based | 멀티에이전트 |\n| AutoGen | Conversational | 코드 생성 |',
 4.7, 8, '2026-04-09', '["Multi-Agent Systems", "Tool Use", "ReAct"]'::jsonb),

('semantic-search', 'Semantic Search', 'Technique',
 '키워드 매칭이 아닌 의미 기반 문서 검색. 임베딩 공간에서 코사인 유사도로 관련성 측정.',
 E'# Semantic Search\n\n## 개요\n키워드 매칭(BM25)이 아닌 의미(semantic) 기반으로 문서를 검색하는 기술입니다.\n\n## BM25 vs Dense Retrieval\n| 방식 | 원리 | 장점 | 단점 |\n|---|---|---|---|\n| BM25 | 키워드 빈도 | 빠름, 정확한 키워드 매칭 | 동의어 못 찾음 |\n| Dense | 임베딩 유사도 | 의미 이해 | 느림, 인프라 필요 |\n| Hybrid | 둘 결합 | 최적 성능 | 복잡도 높음 |\n\n## Reranking\n1단계 검색(recall 중심) → 2단계 리랭킹(precision 중심)\n- Cohere Rerank, ColBERT 등\n- 정확도와 비용의 균형\n\n## DPR (Dense Passage Retrieval)\n- BM25 대비 Open-domain QA에서 +9% recall\n- 질문-문서 쌍으로 학습된 dual encoder',
 4.0, 6, '2026-03-15', '["Embeddings", "RAG", "BM25"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Evidence 삽입
INSERT INTO kaas.evidence (id, concept_id, source, summary, curator, curator_tier, comment)
VALUES
-- RAG evidence
('rag-ev-001', 'rag', 'Chip Huyen — AI Engineering', 'Retrieval-first mental model. Precision@k가 핵심 지표. 청킹 전략이 모델 선택보다 중요하다.', 'Hyejin Kim', 'Gold', '가장 접근성 좋은 RAG 입문 자료. 실무 적용 시 chunking 섹션 필독.'),
('rag-ev-002', 'rag', 'LlamaIndex — Production Patterns', '기본 naive RAG는 검색 정확도 ~60%. Hybrid + rerank로 85%+ 달성 가능.', 'Minjun Park', 'Silver', 'Production gap 이해에 핵심. 수치 기반 비교가 설득력 있음.'),
('rag-ev-003', 'rag', 'Anthropic — Contextual Retrieval', 'Context prefix를 청크에 추가하여 검색 실패율 67% 감소.', 'Hyejin Kim', 'Gold', '2026년 기준 SOTA 기법. 구현 난이도 낮고 효과 큼.'),
-- Chain-of-Thought evidence
('cot-ev-001', 'chain-of-thought', 'Wei et al. — CoT Prompting (2022)', 'few-shot CoT가 GSM8K에서 기존 대비 +20% 정확도.', 'Donghyun Lee', 'Gold', 'CoT의 foundational paper. 반드시 읽어야 할 논문.'),
('cot-ev-002', 'chain-of-thought', 'Kojima et al. — Zero-shot CoT', '''Let''s think step by step'' 한 줄로 zero-shot 추론 대폭 향상.', 'Soyeon Choi', 'Silver', '실무에서 바로 적용 가능한 가장 간단한 CoT 기법.'),
-- Embeddings evidence
('emb-ev-001', 'embeddings', 'OpenAI — Embedding Guide', 'text-embedding-3-large 3072 차원, Matryoshka 차원 축소.', 'Minjun Park', 'Silver', '임베딩 모델 선택 첫 참고.'),
('emb-ev-002', 'embeddings', 'Pinecone — Vector DB 101', 'HNSW 인덱스가 recall-latency 트레이드오프 가장 범용적.', 'Hyejin Kim', 'Gold', '벡터 DB 입문자 추천.'),
('emb-ev-003', 'embeddings', 'Weaviate — Hybrid Search', 'BM25 + 벡터 검색 결합으로 키워드+의미 검색 장점 확보.', 'Donghyun Lee', 'Gold', 'Hybrid search 구현 시 필독.'),
-- Fine-tuning evidence
('ft-ev-001', 'fine-tuning', 'Hu et al. — LoRA (2021)', '파라미터 0.1%로 full fine-tuning 동등 성능.', 'Soyeon Choi', 'Silver', 'PEFT의 시작점.'),
('ft-ev-002', 'fine-tuning', 'Dettmers et al. — QLoRA (2023)', '4-bit 양자화 + LoRA로 단일 GPU 65B 학습.', 'Donghyun Lee', 'Gold', 'GPU 제한 환경 필수 기법.'),
-- Multi-Agent evidence
('ma-ev-001', 'multi-agent', 'Wu et al. — AutoGen (2023)', '멀티에이전트로 단일 대비 +15% 성능.', 'Minjun Park', 'Silver', '멀티에이전트 입문 최적.'),
('ma-ev-002', 'multi-agent', 'CrewAI Documentation', '역할 기반 오케스트레이션으로 워크플로우 자연어 정의.', 'Hyejin Kim', 'Gold', '실무 오케스트레이션 패턴.'),
-- Evaluation evidence
('eval-ev-001', 'evaluation', 'Zheng et al. — LLM-as-a-Judge (2023)', 'GPT-4 판정이 인간 평가와 80%+ 일치.', 'Soyeon Choi', 'Silver', 'LLM 평가 자동화 현실적 방법.'),
('eval-ev-002', 'evaluation', 'Anthropic — Measuring Performance', '다차원 평가가 단일 벤치마크보다 신뢰적.', 'Donghyun Lee', 'Gold', '평가 프레임워크 설계 참고.'),
-- Prompt Engineering evidence
('pe-ev-001', 'prompt-engineering', 'OpenAI — Prompt Engineering Guide', '구체적 지시와 단계별 분해가 품질 80% 결정.', 'Hyejin Kim', 'Gold', '프롬프트 기본기 필독.'),
('pe-ev-002', 'prompt-engineering', 'Anthropic — Prompt Best Practices', 'XML 태그와 역할 부여로 일관성 40% 향상.', 'Minjun Park', 'Silver', 'Claude 특화지만 범용 유용.'),
-- Agent Architectures evidence
('aa-ev-001', 'agent-architectures', 'Yao et al. — ReAct (2022)', '추론+행동 교차 패턴이 HotpotQA +6% 정확도.', 'Donghyun Lee', 'Gold', '에이전트 아키텍처 기초 논문.'),
('aa-ev-002', 'agent-architectures', 'LangChain — Agent Concepts', 'Tool-calling이 가장 보편적 패턴.', 'Soyeon Choi', 'Silver', 'Production 에이전트 구현 참고.'),
-- Semantic Search evidence
('ss-ev-001', 'semantic-search', 'Karpukhin et al. — DPR (2020)', 'Dense Retrieval이 BM25 대비 Open-domain QA +9% recall.', 'Minjun Park', 'Silver', 'Dense retrieval 시작점.'),
('ss-ev-002', 'semantic-search', 'Cohere — Rerank Guide', '2단계 파이프라인으로 정확도와 비용 균형.', 'Hyejin Kim', 'Gold', 'Reranking 도입 효과 수치화.')
ON CONFLICT (id) DO NOTHING;

-- 시스템 유저 ID (로그인 연동 전까지 사용)
-- core.app_user에 이미 존재해야 함
DO $$
DECLARE
  sys_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

-- ============================================
-- 1. 에이전트 3개 (퍼블리싱 MOCK_AGENTS와 동일)
-- ============================================

INSERT INTO kaas.agent (id, user_id, name, icon, api_key, wallet_address, karma_tier, karma_balance, domain_interests, knowledge)
VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    sys_user_id,
    'Coding Assistant',
    '🤖',
    'ck_live_demo_coding_assistant_key_0001',
    '0x742d35Cc6634C0532925a3b844Bc9e7595F4a8',
    'Silver', 1250,
    '["AI Engineering", "LLM Frameworks", "Embeddings"]'::jsonb,
    '[{"topic": "RAG", "lastUpdated": "2025-11-15"}, {"topic": "Prompt Engineering", "lastUpdated": "2026-01-20"}, {"topic": "Embeddings", "lastUpdated": "2026-04-12"}]'::jsonb
  ),
  (
    'a0000002-0000-0000-0000-000000000002',
    sys_user_id,
    'Research Bot',
    '🔬',
    'ck_live_demo_research_bot_key_0002',
    '0x892a1Bc4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0',
    'Bronze', 320,
    '["Embeddings", "RAG Pipelines", "Semantic Search"]'::jsonb,
    '[{"topic": "Embeddings", "lastUpdated": "2026-04-10"}, {"topic": "Semantic Search", "lastUpdated": "2026-03-01"}]'::jsonb
  ),
  (
    'a0000003-0000-0000-0000-000000000003',
    sys_user_id,
    'Support Bot',
    '💬',
    'ck_live_demo_support_bot_key_0003',
    '0x553f2Dc3E4f5A6b7C8d9E0f1A2b3C4d5E6f7A8b9',
    'Bronze', 180,
    '["Prompt Engineering", "Evaluation"]'::jsonb,
    '[{"topic": "Prompt Engineering", "lastUpdated": "2026-04-01"}]'::jsonb
  )
ON CONFLICT (api_key) DO NOTHING;

-- ============================================
-- 2. 크레딧 원장 (Coding Assistant: 500 입금, 270 소비 → 잔액 230)
-- ============================================

INSERT INTO kaas.credit_ledger (agent_id, amount, type, description, tx_hash, chain)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 250, 'deposit', 'Initial deposit via MetaMask', '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', 'status'),
  ('a0000001-0000-0000-0000-000000000001', 250, 'deposit', 'Top-up deposit', '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a', 'status'),
  ('a0000001-0000-0000-0000-000000000001', -20, 'consume', 'purchase: rag', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -10, 'consume', 'purchase: chain-of-thought', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -20, 'consume', 'purchase: agent-architectures', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -5, 'consume', 'purchase: embeddings', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -20, 'consume', 'purchase: fine-tuning', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -5, 'consume', 'purchase: semantic-search', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -20, 'consume', 'purchase: prompt-engineering', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -20, 'consume', 'follow: multi-agent', NULL, NULL),
  ('a0000001-0000-0000-0000-000000000001', -10, 'consume', 'purchase: evaluation', NULL, NULL);

-- Research Bot: 200 입금, 50 소비 → 잔액 150
INSERT INTO kaas.credit_ledger (agent_id, amount, type, description)
VALUES
  ('a0000002-0000-0000-0000-000000000002', 200, 'deposit', 'Initial deposit'),
  ('a0000002-0000-0000-0000-000000000002', -25, 'consume', 'follow: semantic-search'),
  ('a0000002-0000-0000-0000-000000000002', -25, 'consume', 'follow: embeddings');

-- Support Bot: 100 입금, 20 소비 → 잔액 80
INSERT INTO kaas.credit_ledger (agent_id, amount, type, description)
VALUES
  ('a0000003-0000-0000-0000-000000000003', 100, 'deposit', 'Initial deposit'),
  ('a0000003-0000-0000-0000-000000000003', -20, 'consume', 'purchase: prompt-engineering');

-- ============================================
-- 3. 구매/팔로우 이력 (Coding Assistant 5건)
-- ============================================

INSERT INTO kaas.query_log (id, agent_id, concept_id, action_type, credits_consumed, provenance_hash, chain, created_at)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'rag', 'purchase', 20,
   '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'status', '2026-04-13 15:00:00'),
  ('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'chain-of-thought', 'purchase', 10,
   '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', 'status', '2026-04-13 14:00:00'),
  ('b0000003-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'agent-architectures', 'purchase', 20,
   '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1', 'status', '2026-04-12 11:15:00'),
  ('b0000004-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', 'fine-tuning', 'purchase', 20,
   '0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'status', '2026-04-13 09:30:00'),
  ('b0000005-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'multi-agent', 'follow', 25,
   '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'status', '2026-04-12 16:00:00');

-- ============================================
-- 4. 큐레이터 보상 (40% revenue share)
-- ============================================

INSERT INTO kaas.curator_reward (curator_id, query_log_id, amount, withdrawn, created_at)
VALUES
  (sys_user_id, 'b0000001-0000-0000-0000-000000000001', 8, false, '2026-04-13 15:00:00'),
  (sys_user_id, 'b0000002-0000-0000-0000-000000000002', 4, false, '2026-04-13 14:00:00'),
  (sys_user_id, 'b0000003-0000-0000-0000-000000000003', 8, true, '2026-04-12 11:15:00'),
  (sys_user_id, 'b0000004-0000-0000-0000-000000000004', 8, false, '2026-04-13 09:30:00');

END $$;

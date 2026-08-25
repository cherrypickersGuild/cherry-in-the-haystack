# Advanced 6개 페이지 — 체크리스트

> 기준일: 2026-08-25 · 지침 `1-work-guidelines.md` · 절차 `2-implementation-guide.md`
> 표기: `-` 미착수 · `▶` 진행 · `✅` 완료 · `⛔` 차단(승인 대기)

---

## 0. 승인 게이트 — ⛔ 전부 통과해야 Phase 1 시작

| 결정 | 내용 | 상태 |
|---|---|---|
| D1 | `MultiHopRAG` 신설 | ⛔ |
| D2 | `CustomEmbedding` 신설 | ⛔ |
| D3 | `AdversarialEvaluation` **신설하지 않음** (연결만) | ⛔ |
| D4 | `LoRA` 를 PEFT 밑으로 이동 (⚠️ Basics 표시 변경) | ⛔ |
| D5 | 하위 깊이 — 실무 기준으로 얕게 | ⛔ |
| D6 | 외부 논문 **11편** 적재 (3차 검토로 5편 추가) · 🔴 **Custom Embeddings 의 전제조건** | ⛔ |
| D7 | 새 개념 설명은 영어 | ⛔ |
| D8 | `menuLabel` 을 별칭에서 분리 (코드 1줄) | ⛔ |
| D9 | **신설 개념 2개 → 5개** (2차 검토 §3-A) | ⛔ |
| D10 | TTL 출처 표기 = **A안(delta 파일 분리)** | ⛔ |

> **D8 이 승인 안 되면 D1~D7 도 진행 불가.** 별칭을 넣는 순간 메뉴 이름이 알파벳순으로 바뀐다.

---

## 1. Phase 0 — 준비 (쓰기 없음)

| # | 항목 | 산출물 | 상태 |
|---|---|---|---|
| 0-0 | 선행: 스크립트 이식 | ✅ 5개 파일 이식 · `.gitignore` 2건 · 리서처 JSON 재생성(오류 1,216 → 0) | ✅ |
| 0-1 | 기준선 스냅샷 고정 | ✅ `기준선-스냅샷-2026-08-25.md` 생성 (305 · 310 · 7 · 3,054 · 7 · 2) | ✅ |
| 0-2 | `scripts/advanced/precheck.cjs` + `plan.cjs` 작성 | 계획 정의는 `plan.cjs` 한 곳 · precheck/apply/rollback 공용 | ✅ |
| 0-3 | precheck 실행 | ✅ 통과 (실패 0 · 경고 1 = 역슬래시 8건, Phase 1-B 로 이월) | ✅ |
| 0-4 | **롤백 스크립트를 apply 보다 먼저 작성** | ✅ `rollback-ontology.cjs` — 안전장치·재실행 안전 확인 | ✅ |

---

## 2. Phase 1 — 온톨로지 변경 🔴 쓰기

### 2-A. 신설 개념 5개

| # | 항목 | 확인 | 상태 |
|---|---|---|---|
| 1-1 | `MultiHopRAG` 삽입 | `meta_json.origin='cherry-authored'` | - |
| 1-2 | `MultiHopRAG` 경계 문장이 문서에 있는가 | `2-implementation-guide.md` §2-1 | - |
| 1-3 | `MultiHopRAG --SUBTOPIC--> RAG` | | - |
| 1-4 | `MultiHopRAG --RELATED--> GraphRAG` | 축이 다름을 표시 | - |
| 1-5 | `CustomEmbedding` 삽입 | | - |
| 1-6 | `CustomEmbedding` 경계 문장 | §2-2 | - |
| 1-7 | `CustomEmbedding --SUBTOPIC--> Embedding` | | - |
| 1-8 | `CustomEmbedding --RELATED--> Finetuning` | | - |
| 1-8a | `AdapterTuning` 삽입 + `--SUBTOPIC--> ParameterEfficientFinetuning` | 2차 검토 | - |
| 1-8b | `ContrastiveFinetuning` 삽입 + `--SUBTOPIC--> CustomEmbedding` | 이름이 `ContrastiveLearning` 이 아닌지 확인 | - |
| 1-8c | `HardNegativeMining` 삽입 + `--SUBTOPIC--> CustomEmbedding` | | - |

### 2-B. 관계 이동 1건 (D4)

| # | 항목 | 확인 | 상태 |
|---|---|---|---|
| 1-9 | `LoRA --SUBTOPIC--> Finetuning` 해제 | **DELETE 아님 · `revoked_at` 설정** | - |
| 1-10 | `LoRA --SUBTOPIC--> ParameterEfficientFinetuning` 삽입 | | - |
| 1-11 | `QuantizedLoRA --SUBTOPIC--> LoRA` 는 그대로인지 | 건드리지 않음 | - |
| 1-12 | Fine-tuning(Basics) 페이지 표시 변화 확인 | ✅ 하위 **6 → 6** — LoRA 빠지고 CustomEmbedding 붙음. LoRA 는 PEFT 밑으로 | ✅ |

### 2-C. 관계 추가 8건

| # | from → to | 상태 |
|---|---|---|
| 1-13 | `MultiAgentCollaboration --RELATED--> MultiAgentSystem` | - |
| 1-14 | `Coordinator --SUBTOPIC--> MultiAgentSystem` | - |
| 1-15 | `RedTeaming --RELATED--> EvaluationMetric` | - |
| 1-16 | `PromptInjection --RELATED--> RedTeaming` | - |
| 1-17 | `Guardrails --RELATED--> RedTeaming` | - |
| 1-18 | `SafetyGuard --RELATED--> RedTeaming` | - |
| 1-19 | `QueryExpansion --RELATED--> MultiHopRAG` | - |
| 1-20 | `QueryProcessing --RELATED--> MultiHopRAG` | - |
| 1-20a | `SelfAsk`·`ReAct`·`GraphRAG --RELATED--> MultiHopRAG` | - |
| 1-20b | `QuantizedLoRA --RELATED--> ParameterEfficientFinetuning` (⚠️ 표시용 지름길, `note` 기록) | - |
| 1-20c | `PlannerExecutorAgent`·`WorkflowAutomation --RELATED--> MultiAgentSystem` | - |
| 1-20d | `SemanticRepresentation --RELATED--> CustomEmbedding` | - |
| 1-21 | **순환 검사 0건** | - |

### 2-D. 별칭 18건

| # | 개념 | 별칭 | 타입 | 상태 |
|---|---|---|---|---|
| 1-22 | `MultiAgentSystem` | `multiagent` | VARIANT | - |
| 1-23 | `MultiAgentSystem` | `Multi-agent System` | SYNONYM | - |
| 1-24 | `MultiAgentSystem` | `Multi-agent Orchestration` | SYNONYM | - |
| 1-25 | `QuantizedLoRA` | `QLoRA` | ABBREVIATION | - |
| 1-26 | `ParameterEfficientFinetuning` | `PEFT` | ABBREVIATION | - |
| 1-27 | `ParameterEfficientFinetuning` | `Parameter-Efficient Fine-Tuning` | SYNONYM | - |
| 1-28 | `RedTeaming` | `Red Teaming` | VARIANT | - |
| 1-29 | `RedTeaming` | `Adversarial Evaluation` | SYNONYM | - |
| 1-30 | `AdvancedPrompting` | `Advanced Prompting` | VARIANT | - |
| 1-31 | `ChainOfThought` | `chain-of-thought` | VARIANT | - |
| 1-32 | `ChainOfThought` | `CoT` | ABBREVIATION | - |
| 1-33 | `MultiHopRAG` | `Multi-hop RAG` 외 3건 | SYNONYM/VARIANT | - |
| 1-34 | `CustomEmbedding` | `Custom Embeddings` 외 2건 | SYNONYM | - |

### 2-E. Phase 1 종료 검증

| # | 항목 | 통과 기준 | 상태 |
|---|---|---|---|
| 1-35 | 건수 | concept **310** · relation **331**(신규 22 · 해제 1) · alias **25** | - |
| 1-36 | 기존 데이터 무변경 | chunk 3,054 · 기존 305개 이름·설명 불변 | - |
| 1-37 | 순환 | 0건 | - |
| 1-38 | 롤백 리허설 | 롤백 → 원상복귀 확인 → 다시 적용 | - |

---

## 2-F. Phase 1-B — 정본 동기화 ⭐

> ⚠️ **Phase 1 직후에 반드시 한다.** 미루면 DB 와 파일이 어긋난 채로 이후 작업이 진행된다.
> ⚠️ **전체를 내보낸다.** 원본 305개를 포함한 완전한 병합본이어야 GraphDB 재구축 때 파일 하나로 복원된다.

| # | 항목 | 산출물 / 확인 | 상태 |
|---|---|---|---|
| 1B-1 | `scripts/ontology/export-ttl.cjs` 작성 | 전체 + delta 2종 출력 | - |
| 1B-2 | `scripts/ontology/export-snapshot.cjs` 작성 | 스냅샷 JSON 재생성 | - |
| 1B-3 | `scripts/ontology/verify-ttl.cjs` 작성 | TTL 파싱 ↔ DB 대조 | - |
| 1B-4 | **전체 TTL 생성** `llm_ontology_v3-2026-08-25.ttl` | 개념 310 · 관계 331 · 별칭 25 | - |
| 1B-5 | **delta TTL 생성** `llm_ontology_v3-delta-2026-08-25.ttl` | 개념 5 · 관계 22 · 별칭 18 만 | - |
| 1B-6 | **스냅샷 JSON 재생성** | `counts` 310/331/25 · `exportedFrom` 을 postgres 로 | - |
| 1B-7 | **리서처 JSON 재생성** | 305 → **310 항목** | - |
| 1B-8 | `validate-researcher-json.cjs` 통과 | 오류 0 | - |
| 1B-9 | ⚠️ **v2 TTL 보존 확인** | `llm_ontology_v2-2026-08-19.ttl` 그대로 있음 | - |
| 1B-10 | 3중따옴표 처리 | 개행 포함 description 23건이 깨지지 않음 | - |
| 1B-10a | 🔴 **역슬래시 이스케이프** | LaTeX 수식 8건(ALiBi·BPC·GELU·Planning·ReLU·RMSNorm·SwiGLU·TreeSearch)이 `\\` 로 나가고 라운드트립에서 원본과 동일 | - |
| 1B-11 | 해제 관계 제외 | `LoRA --SUBTOPIC--> Finetuning` 이 v3 에 **없음** | - |
| 1B-12 | 신규 클래스 출처 표기 | 신설 5개에 `llm:origin "cherry-authored"` | - |
| 1B-13 | `CONTRADICTS` 술어 | 0건이라 안 나오는 게 정상. 생기면 `llm:contradicts` 필요 | - |

**종료 검증**

| # | 검증 | 통과 기준 | 상태 |
|---|---|---|---|
| S1 | 건수 일치 | TTL · JSON · DB 가 310 / 331 / 25 | - |
| S2 | **라운드트립** | TTL 파싱 ↔ DB 불일치 **0건** | - |
| S3 | **원본 무변경 증명** | v2 TTL 의 305개 이름·설명이 v3 에서 글자 단위 동일 | - |
| S4 | 추론 트리플 | 원본에 없던 상위관계가 새로 안 생김 | - |
| S5 | delta 내용 | 우리 것만 · 원본 것이 섞이지 않음 | - |

---

## 3. Phase 2 — 도구·코드

| # | 항목 | 파일 | 상태 |
|---|---|---|---|
| 2-1 | 검색어에 별칭 포함 | `scripts/learning/search-terms.cjs` | - |
| 2-2 | 하위 개념명·별칭도 포함 | 같은 파일 | - |
| 2-3 | 단어경계 매칭 유지 (부분문자열 금지) | 같은 파일 | - |
| 2-4 | **`menuLabel` 을 별칭에서 분리** (D8) | `concept.service.ts` | - |
| 2-5 | 후보 문단 재측정 | PEFT 0→26 · Multi-agent 0→71 | - |
| 2-6 | ⚠️ 기존 RAG 체리 7개가 전부 후보에 들어오는지 | 이전에 1개 누락됐던 결함 | - |
| 2-7 | `tsc --noEmit` 신규 에러 0 | | - |
| 2-8 | 6개 메뉴 이름이 안 바뀌었는지 화면 확인 | | - |

---

## 4. Phase 3 — 외부 자료 (D6)

> 🔴 **Custom Embeddings 는 D6 없이 착수 불가.** 책 재료가 도구 기준 1건이고 `contrastive` 는 0건이다.

| # | 논문 | 항목 | 상태 |
|---|---|---|---|
| 3-1 | Four-Axis Design Framework (arXiv:2601.00536) | Multi-hop RAG | - |
| 3-2 | Agentic RAG: A Survey (arXiv:2501.09136) | Multi-hop RAG | - |
| 3-3 | TASR (arXiv:2606.13814) | Multi-hop RAG | - |
| 3-4 | NV-Retriever (arXiv:2407.15831) | Custom Embeddings | - |
| 3-5 | MTEB 리뷰 (arXiv:2406.01607) | Custom Embeddings | - |
| 3-6 | Matryoshka-Adaptor (arXiv:2407.20243) | Custom Embeddings | - |
| 3-6a | Matryoshka Representation Learning 원논문 (arXiv:2205.13147) | Custom Embeddings | - |
| 3-6b | Conventional Contrastive Learning Often Falls Short (arXiv:2505.19274) | Custom Embeddings | - |
| 3-6c | Simple Adaptive Attacks, ICLR 2025 (arXiv:2404.02151) | Adversarial Eval | - |
| 3-6d | Multi-Agent Collaboration Mechanisms 서베이 (arXiv:2501.06322) | Multi-agent | - |
| 3-6e | MultiBreak 다중턴 벤치마크 (arXiv:2605.01687) | Adversarial Eval | - |
| 3-7 | 논문별 라이선스 확인 | 재배포 가능 여부 | - |
| 3-8 | `source_type='WEB_URL'` · `source_url` 채움 | | - |
| 3-9 | 본문 전체가 아니라 **인용 범위만** 적재 | | - |
| 3-10 | 기존 3,054문단 무변경 확인 | | - |
| 3-11 | 적재 본문을 저장소에 커밋하지 않음 | | - |

---

## 5. Phase 4 — 페이지 6장

각 페이지 공통 항목. **체리는 5~7개, 그중 최소 5개는 원문 전문 확인 필수.**

| 페이지 | Overview 3문단 | 체리 5~7 | 축 MECE | 원문대조 | References 4 | 링크 2+ | 하위 3+ |
|---|---|---|---|---|---|---|---|
| 5-1 Advanced Prompting | - | - | - | - | - | - | - |
| 5-2 Multi-hop RAG | - | - | - | - | - | - | - |
| 5-3 PEFT / LoRA | - | - | - | - | - | - | - |
| 5-4 Multi-agent | - | - | - | - | - | - | - |
| 5-5 Custom Embeddings ⚠️ | - | - | - | - | - | - | - |
| 5-6 Adversarial Eval | - | - | - | - | - | - | - |

**페이지별 특이 확인**

| # | 항목 | 상태 |
|---|---|---|
| 4-1 | Multi-hop RAG — `multi-hop-rag` 매핑을 `MultiHopRAG` 로 변경 (`app/page.tsx`) | - |
| 4-2 | Custom Embeddings — `custom-embeddings` 매핑을 `CustomEmbedding` 로 변경 | - |
| 4-3 | Adversarial Eval — `displayTitle` 에 두 이름 다 넣기 | - |
| 4-4 | 🔴 Custom Embeddings — **책 재료 1건.** Phase 3 완료가 **전제조건**. D6 반려 시 이 페이지는 보류하거나 Cherries 를 비운 채 발행 | - |
| 4-5 | 화면에 한글을 임의로 넣지 않았는지 (데이터의 한글은 그대로) | - |
| 4-6 | 기여자를 닉네임으로 표기했는지 (인공지능 티 내지 않음) | - |

---

## 6. Phase 5 — 검증

| # | 검증 | 통과 기준 | 상태 |
|---|---|---|---|
| V1 | 건수 | concept 310 · relation 331 · alias 25 | - |
| V2 | 순환 | 0건 | - |
| V3 | 기존 데이터 무변경 | chunk 3,054 · 기존 개념 305 불변 | - |
| V4 | MECE | 축이 서로 안 겹치고 Overview ③을 덮는가 (사람 판정) | - |
| V5 | **원문 대조** | 체리 1건당 `chunkId` **전문**을 읽고 왜곡 없음 확인 | - |
| V6 | 링크 | 모든 `url` 실제 접속. 페이지당 2개 이상 열림 | - |
| V7 | 하위 개념 | 페이지당 3개 이상 (예상: 11·5·3·4·3·3) | - |
| V8 | 화면 실동작 | 6개 메뉴 4구획 + 로드맵 | - |
| V9 | 중복 매핑 해소 | `custom-embeddings` ≠ `embeddings` | - |
| V10 | 타입체크 | `tsc --noEmit` 신규 에러 0 | - |
| V11 | Basics 영향 | Fine-tuning 하위 6 → 6 · LoRA 의 상위가 PEFT 하나뿐 | - |
| V12 | 로드맵 렌더 | 새 개념 이름이 칸을 넘치지 않는지 (`fitText`) | - |

---

## 7. Phase 6 — 최종 확인

| # | 항목 | 통과 기준 | 상태 |
|---|---|---|---|
| F1 | 정본 3종 건수 | TTL · 스냅샷 JSON · DB 가 310 / 331 / 25 | - |
| F2 | 라운드트립 재실행 | 불일치 0건 | - |
| F3 | 리서처 JSON | 310 항목 · 검증 스크립트 통과 | - |
| F4 | 원본 무변경 | v2 TTL 대비 305개가 글자 단위 동일 | - |
| F5 | v2 보존 | `llm_ontology_v2-2026-08-19.ttl` 삭제되지 않음 | - |
| F6 | Phase 2~5 중 온톨로지가 바뀌었다면 | **Phase 1-B 를 다시 돌렸는가** | - |

> ⚠️ GraphDB 를 다시 띄우는 것은 이 기획의 범위가 아니다. 여기서는 **그때 쓸 입력 파일**까지만 만든다.

## 8. 마무리

| # | 항목 | 상태 |
|---|---|---|
| 8-1 | `4-progress-log.md` 갱신 | - |
| 8-2 | `../base-data/` 현황 문서 갱신 또는 새 날짜 버전 | - |
| 8-3 | `../concept-quality/researcher-package/` 재생성 (개념 305→310) — **Phase 1-B 에서 이미 함. 여기선 확인만** | - |
| 8-4 | 커밋 — **사용자가 직접 한다** | - |

# Advanced 6개 페이지 — 구현 가이드 (절차·상세설계)

> 기준일: 2026-08-25 · 지침: `1-work-guidelines.md` · 근거: `research/`
> **D1~D7 승인 전에는 §3 이후를 실행하지 않는다.**

---

## 1. 전체 흐름

```
Phase 0    준비       기준선 고정 · 스크립트 골격                        쓰기 없음
Phase 1    온톨로지   개념 5 신설 · 관계 22 삽입(이동 1 포함) · 별칭 18    🔴 쓰기
Phase 1-B  정본동기화 ⭐ TTL · 스냅샷 JSON · 리서처 JSON 전면 재생성       파일
Phase 2    도구       검색어에 별칭 포함 · menuLabel 분리                 코드
Phase 3    외부자료   arXiv 논문 11편 적재                               🔴 쓰기
Phase 4    콘텐츠     6개 페이지 × (Overview + 체리 5~7 + References 4)   🔴 쓰기
Phase 5    검증       MECE · 원문대조 · 링크 · 순환 · 화면 실동작
Phase 6    최종확인   정본 3종 재검증 · 라운드트립
```

> ⭐ **Phase 1-B 를 Phase 1 바로 뒤에 둔다.** 온톨로지가 바뀌는 것은 Phase 1 하나뿐이므로, 여기서 정본을 맞춰두지 않으면 이후 작업 내내 DB 와 파일이 어긋난 채로 간다.

각 Phase는 **앞 Phase의 검증이 통과해야** 다음으로 간다.

---

## 2. Phase 1 — 온톨로지 변경 명세

### 2-1. 신설 개념 ① `MultiHopRAG`

| 필드 | 값 |
|---|---|
| `ontology_node` | `MultiHopRAG` |
| `canonical_name` | `MultiHopRAG` |
| `meta_json` | `{"origin":"cherry-authored","addedAt":"2026-08-25"}` |
| `description` (영어) | *Multi-hop RAG answers questions that a single retrieval cannot: the result of one search becomes the input to the next. A router or planner decomposes the question, retrieves evidence for the first hop, uses what it found to form the next query, and repeats. The hard problem is not finding — it is knowing when to stop: retrieve too long and cost explodes, stop too early and the answer is wrong.* |

**경계 정의 (한 문장, 못 박음)**
> **MultiHopRAG = 검색 결과가 다음 검색의 입력이 되는 RAG.**
> `GraphRAG` 는 **색인 구조**(지식을 어떻게 쌓나), `HybridRetrieval` 은 **랭킹**(한 번에 잘 찾기). 축이 서로 다르므로 겹치지 않는다.

**관계**
```
MultiHopRAG      --SUBTOPIC--> RAG
MultiHopRAG      --RELATED-->  GraphRAG          (자주 함께 쓰이나 다른 축임을 표시)
QueryExpansion   --RELATED-->  MultiHopRAG       (multi-hop 의 부품. 지금 어디에도 안 붙어 있음)
QueryProcessing  --RELATED-->  MultiHopRAG
```

**별칭** — `Multi-hop RAG`(SYNONYM) · `Multi-hop Retrieval`(SYNONYM) · `Iterative Retrieval`(SYNONYM) · `multihop`(VARIANT)

### 2-2. 신설 개념 ② `CustomEmbedding`

| 필드 | 값 |
|---|---|
| `ontology_node` | `CustomEmbedding` |
| `canonical_name` | `CustomEmbedding` |
| `meta_json` | `{"origin":"cherry-authored","addedAt":"2026-08-25"}` |
| `description` (영어) | *Custom embeddings adapt a general-purpose embedding model to one domain. General models handle everyday language well but miss the distinctions that matter inside law, medicine, or a single company's documents. Contrastive fine-tuning pulls matching pairs together and pushes mismatched ones apart; the quality of that training rests almost entirely on which wrong answers you choose to teach with.* |

**경계 정의**
> **CustomEmbedding = 범용 임베딩 모델을 특정 도메인에 맞게 다시 학습시키는 것.**
> Basics 의 `Embedding` 은 "임베딩이 무엇이고 왜 쓰나", 여기는 "내 것으로 만드는 법".

**관계**
```
CustomEmbedding --SUBTOPIC--> Embedding
CustomEmbedding --RELATED-->  Finetuning        (임베딩 모델 파인튜닝이므로)
```

**별칭** — `Custom Embeddings`(SYNONYM) · `Domain-specific Embeddings`(SYNONYM) · `Embedding Fine-tuning`(SYNONYM)

### 2-3. 관계 이동 1건 (D4)

```
[해제]  LoRA --SUBTOPIC--> Finetuning                      revoked_at = now()
[삽입]  LoRA --SUBTOPIC--> ParameterEfficientFinetuning    origin='cherry-authored'
```
⚠️ **지우지 않고 `revoked_at` 으로 해제한다.** 이력이 남아야 되돌릴 수 있다.

**결과 구조**
```
Finetuning
 ├─ InstructionTuning · SupervisedFinetuning · TaskSpecificFinetuning · TransferLearning
 ├─ CustomEmbedding (RELATED)        ← §2-2 로 새로 붙는다
 └─ ParameterEfficientFinetuning
     ├─ LoRA
     │   └─ QuantizedLoRA
     ├─ QuantizedLoRA (RELATED · 표시용 지름길)
     └─ AdapterTuning
```

> ⚠️ **Finetuning 의 직계 하위는 6 → 6 이다.** LoRA 가 빠지고(-1) CustomEmbedding 이 붙는다(+1).
> 초안은 빼는 쪽만 세어 5 로 적었다 — 계산 착오(E9, 적용 후 verify 가 잡음).

### 2-3A. 신설 개념 3개 추가 (2차 검토 · `1-work-guidelines.md` §3-A)

| 노드 | 상위 | 설명(영어 초안) |
|---|---|---|
| `AdapterTuning` | `ParameterEfficientFinetuning` (SUBTOPIC) | *Adapter tuning inserts a small trainable module into each layer of a frozen pre-trained model. Only the adapters are updated, so a single base model can serve many tasks by swapping adapters.* |
| `ContrastiveFinetuning` | `CustomEmbedding` (SUBTOPIC) | *Contrastive fine-tuning trains an embedding model by pulling matching pairs closer and pushing mismatched pairs apart. It is the standard way to adapt a general embedding model to a specific domain.* |
| `HardNegativeMining` | `CustomEmbedding` (SUBTOPIC) | *Hard negative mining chooses the wrong answers used in contrastive training — passages that look close to the query but are not the answer. It drives embedding quality more than any other single choice, and choosing badly teaches the model that correct answers are wrong.* |

> ⚠️ 이름 주의: `ContrastiveLearning` 이 아니라 **`ContrastiveFinetuning`**. 대조 학습 일반은 임베딩보다 넓은 개념이므로, 일반을 특수 밑에 넣으면 계층이 뒤집힌다.

### 2-4. 관계 추가 — 총 22건 삽입 · 1건 해제

| from | 관계 | to | 목적 |
|---|---|---|---|
| `MultiAgentCollaboration` | RELATED | `MultiAgentSystem` | 지금 `AgenticTask` 밑에 떠 있음 |
| `Coordinator` | SUBTOPIC | `MultiAgentSystem` | 하위 0개 해소 |
| `RedTeaming` | RELATED | `EvaluationMetric` | D3 — 평가와 정렬 사이 다리 |
| `PromptInjection` | RELATED | `RedTeaming` | 공격 기법. 지금 어디에도 안 붙어 있음 |
| `Guardrails` | RELATED | `RedTeaming` | 방어 쪽 짝 |
| `SafetyGuard` | RELATED | `RedTeaming` | 방어 쪽 짝 |
| `QueryExpansion` | RELATED | `MultiHopRAG` | 2-1 참조 |
| `QueryProcessing` | RELATED | `MultiHopRAG` | 2-1 참조 |

**2차 검토로 추가된 8건 — 화면의 `03 Child Concepts` 를 채우기 위함**

| from | 관계 | to | 근거 |
|---|---|---|---|
| `SelfAsk` | RELATED | `MultiHopRAG` | 4축 프레임워크에서 **Interleaved 실행계획**으로 분류됨 |
| `ReAct` | RELATED | `MultiHopRAG` | 동일 |
| `GraphRAG` | RELATED | `MultiHopRAG` | 4축 프레임워크의 **축 B(색인 구조)**. ⚠️ 방향을 §2-1 의 반대로 잡았다 — GraphRAG 가 MultiHopRAG 페이지에 뜨게 하기 위함 |
| `QuantizedLoRA` | RELATED | `ParameterEfficientFinetuning` | ⚠️ **표시용 지름길 간선.** 이미 LoRA 경유로 이어져 있어 의미상 중복. `note` 에 사유 기록 |
| `AdapterTuning` | SUBTOPIC | `ParameterEfficientFinetuning` | 신설 |
| `PlannerExecutorAgent` | RELATED | `MultiAgentSystem` | 현재 형제. 역할 분담의 대표 패턴 |
| `WorkflowAutomation` | RELATED | `MultiAgentSystem` | 경계가 겹치는 인접 개념 |
| `SemanticRepresentation` | RELATED | `CustomEmbedding` | 기존 `Embedding` 하위를 재사용 |
| `ContrastiveFinetuning` | SUBTOPIC | `CustomEmbedding` | 신설 |
| `HardNegativeMining` | SUBTOPIC | `CustomEmbedding` | 신설 |

> ⚠️ 순환 검사 필수. 특히 `RedTeaming --RELATED--> EvaluationMetric` 은 두 최상위 가지를 잇는다.

**적용 후 `03 Child Concepts` 개수 (실측 시뮬레이션)**

```
Advanced Prompting  11개  ✅      Multi-agent          4개  ✅
Multi-hop RAG        5개  ✅      Custom Embeddings    3개  ✅
PEFT / LoRA          3개  ✅      Adversarial Eval     3개  ✅
```

### 2-5. 별칭 등록 18건 — 검색어 문제 해결의 핵심

책이 쓰는 말과 온톨로지 이름이 달라서 후보 문단이 0으로 나온다. 이걸 별칭으로 푼다.

| 개념 | 별칭 | 타입 | 효과 |
|---|---|---|---|
| `MultiAgentSystem` | `multiagent` | VARIANT | **0 → 71건** |
| `MultiAgentSystem` | `Multi-agent System` | SYNONYM | |
| `MultiAgentSystem` | `Multi-agent Orchestration` | SYNONYM | 메뉴 라벨과 일치 |
| `QuantizedLoRA` | `QLoRA` | ABBREVIATION | **+14건** |
| `ParameterEfficientFinetuning` | `PEFT` | ABBREVIATION | **+8건** |
| `ParameterEfficientFinetuning` | `Parameter-Efficient Fine-Tuning` | SYNONYM | |
| `RedTeaming` | `Red Teaming` | VARIANT | |
| `RedTeaming` | `Adversarial Evaluation` | SYNONYM | 메뉴 라벨과 일치 |
| `AdvancedPrompting` | `Advanced Prompting` | VARIANT | |
| `ChainOfThought` | `chain-of-thought` · `CoT` | VARIANT · ABBREVIATION | |
| `MultiHopRAG` | `Multi-hop RAG` · `Multi-hop Retrieval` · `Iterative Retrieval` | SYNONYM ×3 | 신설 개념 |
| `MultiHopRAG` | `multihop` | VARIANT | 책 표현 |
| `CustomEmbedding` | `Custom Embeddings` · `Domain-specific Embeddings` · `Embedding Fine-tuning` | SYNONYM ×3 | 신설 개념 |
| `HybridRetrieval` | (이미 `Hybrid Search` 있음) | — | 기존 · 추가 없음 |

**합계 18건** — MultiAgentSystem 3 · QuantizedLoRA 1 · PEFT 2 · RedTeaming 2 · AdvancedPrompting 1 · ChainOfThought 2 · MultiHopRAG 4 · CustomEmbedding 3

**별칭 등록 후 후보 문단 (도구 기준 · 실측)**
```
PEFT                 0 →  26건
Multi-agent          0 →  72건
Advanced Prompting        83건   (그중 45건이 "Reflexion" → 실질 38)
Multi-hop RAG             58건
Adversarial Eval          57건
Custom Embeddings          1건   🔴 D6 없이는 불가
```

---

## 2-B. Phase 1-B — 정본 동기화 ⭐

### 왜 하나

GraphDB 는 나중에 **다시 만들어야 한다.** 그때 입력이 되는 것이 TTL 이다. 지금 우리가 넣는 것은 **원본 온톨로지에 우리 것을 임시로 합친 판**이므로, **원본 305개도 빠짐없이 그대로 들어가야** 파일 하나로 전부 복원된다.

> ⚠️ **델타만 내보내면 안 된다.** 우리가 추가한 5개·22건만 담긴 파일로는 GraphDB 를 복원할 수 없다.

### 갱신 대상 4종

| 파일 | 지금 | 갱신 후 | 왜 필요한가 |
|---|---|---|---|
| `python_services/packages/idea_to_graph_ontology/data/llm_ontology_v3-2026-08-25.ttl` | (없음) | 개념 **310** · 관계 **331** · 별칭 **25** — **전부** | **GraphDB 재구축의 입력** |
| `…/llm_ontology_v3-delta-2026-08-25.ttl` | (없음) | 우리가 추가한 것만 | 원본과 우리 것을 나중에 구분 |
| `apps/docs/ontology-migration/ontology-snapshot.json` | 305 / 310 / 7 | **310 / 331 / 25** | `scripts/ontology/verify.cjs` 의 대조 기준. 안 고치면 검증이 실패한다 |
| `apps/docs/concept-quality/researcher-package/concepts-to-fill.json` | 305 항목 | **310 항목** | 리서처 작업 대상 목록 |

> ⚠️ **v2 TTL 은 남겨둔다.** 덮어쓰지 않는다. v2 = 원본, v3 = 임시 병합본.

### TTL 매핑 규칙

```
handbook.concept          →  llm:<ontology_node> a owl:Class ;
                               rdfs:label "<canonical_name>"@en ;
                               llm:description <3중따옴표><description><3중따옴표>
handbook.concept_alias    →  skos:altLabel "<alias_text>"
handbook.concept_relation
   SUBTOPIC               →  rdfs:subClassOf
   PREREQUISITE           →  llm:isPrerequisiteOf
   EXTENDS                →  llm:extends
   RELATED                →  llm:relatedTo
   CONTRADICTS            →  llm:contradicts        ⚠️ 원본에 없던 술어 (현재 0건)
출처(신규 클래스만)         →  llm:origin "cherry-authored"
```

**직렬화 주의 (실측 확인분)**

```
✅ 노드명 305개 전부  ^[A-Za-z][A-Za-z0-9_]*$   → IRI 로 안전
✅ description 에 3중따옴표 0건 · 큰따옴표 0건 · 제어문자 0건
🔴 description 8건에 역슬래시 포함  → **TTL 에서 \\ 로 이스케이프 필수**
   ALiBi · BPC · GELU · Planning · ReLU · RMSNorm · SwiGLU · TreeSearch
   지식팀이 쓴 LaTeX 수식이다.  \(d\) · \frac{1}{N} · \sum · A\* · \sqrt · \sigma
   Turtle 리터럴 안에서 역슬래시는 이스케이프 문자라, 그대로 쓰면 파싱이 깨진다.
⚠️ description 23건에 개행 포함  → 3중따옴표 리터럴 필수
✅ 별칭 7건 전부 따옴표·역슬래시 없음
⚠️ revoked_at IS NOT NULL 행은 내보내지 않는다
   → LoRA→Finetuning 은 빠지고 LoRA→ParameterEfficientFinetuning 만 나간다
⚠️ 추론 트리플이 섞이면 안 된다 — DB 에서 직접 뽑으므로 원천적으로 없다
   (원본 TTL 을 GraphDB 에서 뽑을 때 infer=false 가 필요했던 것과 같은 취지)
```

### D10 — 관계의 출처를 TTL 에 어떻게 남기나 ⛔ 승인 필요

RDF 는 **트리플 하나에 메타데이터를 붙이지 못한다.** `concept_relation.origin` 을 그대로 옮길 방법이 없다.

| 안 | 방법 | 평가 |
|---|---|---|
| **A (권장)** | 전체 TTL + **delta TTL** 두 개를 낸다 | 파일이 하나 늘 뿐, 구분은 확실하다 |
| B | RDF reification | 트리플마다 4줄이 붙어 파일이 4배가 된다 |
| C | 안 남긴다 | 나중에 원본과 우리 것을 구분할 수 없다 |

**A 안을 제안한다.** 신규 **클래스**에는 `llm:origin` 을 붙일 수 있으므로(주어가 있음), 개념은 전체 파일 안에서도 구분된다. 구분이 불가능한 것은 **관계**뿐이며 그것을 delta 파일이 담는다.

### 스냅샷 JSON 갱신

기존 스키마를 그대로 유지한다.

```jsonc
{ "exportedFrom": "postgres://handbook (2026-08-25 병합본)",
  "infer": false,
  "counts": { "concepts": 310, "relations": 331, "aliases": 25, "withDescription": 310 },
  "concepts": [ { "node", "label", "description", "aliases": [] } ],
  "relations": [ { "from", "to", "type" } ] }
```

⚠️ `exportedFrom` 이 **GraphDB 가 아니라 Postgres** 로 바뀐다. 정본이 옮겨갔다는 표시다.

### 검증 (Phase 1-B 종료 조건)

| # | 항목 | 통과 기준 |
|---|---|---|
| S1 | 건수 | TTL·JSON 둘 다 개념 310 · 관계 331 · 별칭 25 |
| S2 | **라운드트립** | TTL 을 파싱해 DB 와 대조 — 개념·관계·별칭 불일치 **0건** |
| S3 | **원본 무변경 증명** | v2 TTL 의 305개 개념 이름·설명이 v3 에서 **글자 단위로 동일** |
| S4 | 해제 반영 | `LoRA --SUBTOPIC--> Finetuning` 이 v3 에 **없음** |
| S5 | 추론 트리플 | 원본에 없던 상위관계가 새로 생기지 않았음 |
| S6 | delta 파일 | 우리가 넣은 개념 5 · 관계 22 · 별칭 18 만 들어 있음 |
| **S7** | **역슬래시 이스케이프** | LaTeX 수식 8건이 `\\` 로 나가고, 파싱 후 원본과 글자 단위로 같은가 |

### ⚠️ TTL 이 담지 않는 것

```
❌ content.concept_page            Overview 본문 · References
❌ handbook.paragraph_concept_link 체리 문장
❌ handbook.book / chapter / section / paragraph_chunk   책 본문
```

**TTL 은 온톨로지 전용이다.** 페이지 콘텐츠는 Postgres 에만 있다. GraphDB 를 다시 세워도 화면 내용은 복원되지 않는다 — 이 점을 문서에 못 박아 둔다.

---

## 3. Phase 2 — 도구·코드 변경

### 3-1. 검색어에 별칭을 포함시킨다

`scripts/learning/search-terms.cjs`(브랜치 `researcher-evidence-handoff`)가 **온톨로지 정식 이름만** 쓰고 `handbook.concept_alias` 를 안 읽는다. 이 결함 때문에 RAG 추출에서 이미 발행된 체리 1건이 누락됐다(`../base-data/handoff-2026-08-25.md` §5-B).

```
[수정]  검색어 = 노드명 + canonical_name + 별칭 전부 + 하위 개념명 + 하위 개념 별칭
[매칭]  단어경계 정규식 (\m...\M). 부분문자열 매칭 금지 — "system" 같은 과다매칭 방지
```

### 3-2. ⚠️ `menuLabel` 을 별칭에서 떼어낸다 — 새로 발견된 문제

`concept.service.ts` 가 이렇게 되어 있다.

```ts
menuLabel: concept.aliases[0] ?? concept.label
```

그리고 provider 가 별칭을 `ORDER BY a.alias_text` **알파벳순**으로 준다. 즉 **별칭을 추가하면 화면에 뜨는 메뉴 이름이 알파벳 순서에 따라 바뀐다.**

`multiagent` 같은 검색용 별칭을 넣으면 **메뉴 이름이 그것으로 바뀔 수 있다.**

```
[문제] 별칭이 "표시 이름"과 "검색어" 두 용도로 겹쳐 쓰이고 있다
[수정] menuLabel: page?.concept_name ?? concept.label      ← 별칭을 안 쓴다
       aliases 는 조회·검색 전용으로만 쓴다
```

> **D8 (신규 결정 항목)**: 위 한 줄 코드 수정. 승인 필요.
> 승인 안 되면 Phase 1의 별칭 등록을 할 수 없다(메뉴 이름이 깨진다).

---

## 4. Phase 3 — 외부 자료 도입 (D6)

`handbook.book.source_type` 에 **`WEB_URL` 이 이미 있고**(enum: PDF · EPUB · HTML · MARKDOWN · WEB_URL · CUSTOM) `source_url` 칼럼도 있다. **스키마 변경이 필요 없다.**

### 4-1. 적재 대상 11편  (2차 검토로 5편 추가 — 전부 원문 확인분)

| 항목 | 논문 | URL |
|---|---|---|
| Multi-hop RAG | Four-Axis Design Framework for Multi-hop QA | arXiv:2601.00536 |
| Multi-hop RAG | Agentic RAG: A Survey | arXiv:2501.09136 |
| Multi-hop RAG | TASR: Training-Free Adaptive Stopping | arXiv:2606.13814 |
| Custom Embeddings | NV-Retriever: effective hard-negative mining | arXiv:2407.15831 |
| Custom Embeddings | Recent Advances in Text Embedding (MTEB 리뷰) | arXiv:2406.01607 |
| Custom Embeddings | Matryoshka-Adaptor | arXiv:2407.20243 |
| Custom Embeddings | Matryoshka Representation Learning (원 논문) | arXiv:2205.13147 |
| Custom Embeddings | Conventional Contrastive Learning Often Falls Short | arXiv:2505.19274 |
| Adversarial Eval | Simple Adaptive Attacks (ICLR 2025) | arXiv:2404.02151 |
| Multi-agent | Multi-Agent Collaboration Mechanisms: A Survey | arXiv:2501.06322 |

### 4-2. 적재 절차

```
① 라이선스 확인      논문별로 재배포 가능 여부 확인 (R5)
② book 행 생성       source_type='WEB_URL' · source_url=논문 URL · author=저자
③ chapter/section    논문 섹션 구조 그대로
④ paragraph_chunk    ⚠️ 본문 전체가 아니라 인용할 범위만 적재
⑤ 검증               기존 3,054문단이 안 변했는지 확인
```

> ⚠️ **RAG.json 과 같은 취급.** 적재된 본문은 저장소에 커밋하지 않는다.

---

## 5. Phase 4 — 페이지 6장 상세 설계

각 페이지는 **Overview 3문단 + 체리 5~7개(MECE 축 명시) + References 4단계**로 구성한다.
체리 축 표의 "재료"는 실측한 후보 문단 위치다. **`외부`** 표시는 책에 없어 Phase 3 자료가 필요한 축이다.

---

### 5-1. Advanced Prompting

| | |
|---|---|
| 메뉴 | `chain-of-thought` · BASICS/ADVANCED = **ADVANCED** |
| 노드 | `AdvancedPrompting` (변경 없음) |
| `displayTitle` | **Advanced Prompting Techniques** |

**Overview 3문단 골자**
```
① 무엇     기본 지시·예시를 넘어, 모델이 답에 이르는 과정 자체를 설계하는 기법군.
           "무엇을 묻나"가 아니라 "어떻게 생각하게 하나".
② 왜       같은 모델·같은 질문이라도 추론 경로 설계에 따라 정확도가 갈린다.
           학습 없이, 프롬프트만으로 얻는 개선이라 비용이 가장 싸다.
③ 모양     드러내기(CoT) → 쪼개기(Decomposition) → 여러 번 시도해 고르기(Ensembling)
           → 스스로 고치기(Self-Criticism). The Prompt Report 의 5분류가 표준이다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 추론을 쓰게 하면 왜 나아지는가 | AI Engineering Ch.5 (12건) |
| C2 | 예시가 있고 없고의 차이 (ICL · few-shot · zero-shot) | AI Engineering Ch.5 · `in-context learning` 15건 |
| C3 | 문제를 쪼개는 것 (Decomposition) | ⚠️ 3건으로 얇음 |
| C4 | 스스로 고치는 루프 (Reflexion 계열) | Building Applications Ch.11 (14건) · Ch.7 (10건) |
| C5 | 대가 — 토큰·지연시간이 는다 | AI Engineering Ch.9 Inference Optimization (4건) |
| C6 | **반전 — 유명한 기법이 조건에 따라 진다** | The Prompt Report **MMLU·GPT-3.5-turbo 사례연구**: Few-Shot CoT 최상 · Self-Consistency 는 Few-Shot 에서 이득 미미 · Zero-Shot CoT < Zero-Shot. ⚠️ **조건을 반드시 명시할 것** |

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *AI Engineering* Ch.5 "Prompt Engineering" (소장, 78문단) | ✗ 소장 |
| NEXT → | The Prompt Report (arXiv:2406.06608) | ✅ |
| THEN → | *Building Applications with AI Agents* Ch.11 "Improvement Loops" (소장) | ✗ 소장 |
| DEEP DIVE → | Towards Better Chain-of-Thought Prompting Strategies: A Survey (arXiv:2310.04959) | ✅ |

열리는 링크 **2개** — 기준 충족.

---

### 5-2. Multi-hop RAG

| | |
|---|---|
| 메뉴 | `multi-hop-rag` |
| 노드 | `MultiHopRAG` **(신설)** — 현재 `HybridRetrieval` 에서 변경 |
| `displayTitle` | **Multi-hop RAG** |

**Overview 3문단 골자**
```
① 무엇     한 번의 검색으로 답이 안 나오는 질문을 다룬다.
           검색 결과가 다음 검색의 입력이 된다.
② 왜       실제 질문의 상당수는 여러 사실을 이어야 답이 된다.
           단일 검색 RAG 는 정확히 여기서 무너진다.
③ 모양     실행 계획 · 색인 구조 · 다음 행동 결정 · 정지 조건 — 네 축으로 갈린다.
           핵심 난제는 "어떻게 찾나"가 아니라 "언제 멈추나"다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 왜 한 번으론 안 되나 | Building Applications Ch.6 Knowledge and Memory (26건) |
| C2 | 질의를 다시 쓰고 확장하기 | LLM EH Ch.9 (9건) · Ch.4 (5건) · `query expansion` 13건 |
| C3 | 그래프로 잇기 — GraphRAG 와의 경계 | `GraphRAG` 16건 · `knowledge graph` 15건 |
| C4 | **언제 멈추나** — 이 주제의 고유 축 | **외부** (TASR · Stop-RAG) |
| C5 | 비용이 폭증하는 지점 | **외부** (FrugalRAG · EfficientRAG) |
| C6 | 벤치마크가 실제로 재는 것 | `HotpotQA` 10건 + 외부 |

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *AI Engineering* Ch.6 "RAG and Agents" (소장) | ✗ |
| NEXT → | *LLM Engineers Handbook* Ch.9 "RAG Inference Pipeline" (소장, 58문단) | ✗ |
| THEN → | Four-Axis Design Framework (arXiv:2601.00536) | ✅ |
| DEEP DIVE → | Agentic RAG: A Survey (arXiv:2501.09136) | ✅ |

---

### 5-3. PEFT / LoRA / QLoRA

| | |
|---|---|
| 메뉴 | `peft-lora` |
| 노드 | `ParameterEfficientFinetuning` (변경 없음, **하위가 생김**) |
| `displayTitle` | **Parameter-Efficient Fine-tuning** |

**Overview 3문단 골자**
```
① 무엇     모델 전체를 다시 학습시키지 않고, 아주 작은 부품만 학습시켜
           모델을 특정 용도에 맞추는 기법군.
② 왜       650억 파라미터를 전부 학습시키려면 GPU 수십 장이 필요하다.
           QLoRA 는 같은 일을 48GB 한 장으로 한다. 이 격차가 존재 이유다.
③ 모양     덧붙이기(Additive) · 골라내기(Selective) · 저차원으로 다시 표현하기
           (Reparameterized). LoRA 는 셋째의 대표이고 QLoRA 는 그 변종이다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 전체 파인튜닝의 비용 | AI Engineering Ch.7 Finetuning (26건) |
| C2 | LoRA 가 작동하는 원리 — 저랭크 | `LoRA` 16건 |
| C3 | QLoRA — 4비트 양자화가 더해지면 | `QLoRA` 14건 · `quantization` 20건 · `4-bit` 5건 |
| C4 | 품질 손실은 얼마나 되나 | AI Engineering Ch.7 · LLM EH Ch.5 (7건) |
| C5 | 언제 쓰면 안 되나 | ⚠️ `catastrophic forgetting` 2건으로 얇음 |
| C6 | 파인튜닝이냐 RAG 냐 | AI Engineering Ch.7 (기존 RAG 체리와 연결됨) |

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *AI Engineering* Ch.7 "Finetuning" (소장, 112문단) | ✗ |
| NEXT → | *LLM Engineers Handbook* Ch.5 "Supervised Fine-Tuning" (소장) | ✗ |
| THEN → | LoRA: Low-Rank Adaptation (arXiv:2106.09685) | ✅ |
| DEEP DIVE → | PEFT: A Comprehensive Survey (arXiv:2403.14608) | ✅ |

---

### 5-4. Multi-agent Orchestration

| | |
|---|---|
| 메뉴 | `agent-topologies` |
| 노드 | `MultiAgentSystem` (변경 없음, **하위가 생김**) |
| `displayTitle` | **Multi-agent Orchestration** |

**Overview 3문단 골자**
```
① 무엇     에이전트 하나로 안 되는 일을 여러 에이전트에게 나눠 시키고,
           그 흐름을 통제하는 법.
② 왜       한 에이전트에 모든 역할을 넣으면 프롬프트가 비대해지고 실패가 뒤엉킨다.
           나누면 각자가 단순해지지만, 대신 조율 비용이 생긴다.
③ 모양     누가 결정하나(중앙·분산·계층) · 어떻게 대화하나(블랙보드·메시지·핸드오프)
           · 누가 무엇을 맡나. 세 질문이 설계를 결정한다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 왜 하나로는 안 되나 | Building Applications Ch.8 "From One Agent to Many" (42건 / 127문단) |
| C2 | 구조 — **peer-to-peer · centralized · distributed** | ✅ arXiv:2501.06322 (원문 확인) + Ch.8 · Ch.2 (13건) |
| C3 | 어떻게 대화하나 — 핸드오프·블랙보드·메시지 | Ch.5 Orchestration (13문단) · Ch.8 |
| C4 | 실패 모드 — 무한 루프 · 비용 폭증 | Ch.12 Protecting Agentic Systems (10건) |
| C5 | 협력만이 아니다 — **cooperation · competition · coopetition** | ✅ arXiv:2501.06322 (원문 확인) + Ch.8 · Ch.13 Human-Agent Collaboration |
| C6 | 무엇으로 재나 | Ch.9 Validation and Measurement (5건) |

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *Building Applications with AI Agents* Ch.8 "From One Agent to Many" (소장, 127문단) | ✗ |
| NEXT → | 같은 책 Ch.5 "Orchestration" (소장) | ✗ |
| THEN → | Multi-Agent Collaboration Mechanisms: A Survey of LLMs (arXiv:2501.06322) ✅원문확인 | ✅ |
| DEEP DIVE → | A Taxonomy of Hierarchical Multi-Agent Systems (arXiv:2508.12683) | ✅ |

---

### 5-5. Custom Embeddings

| | |
|---|---|
| 메뉴 | `custom-embeddings` |
| 노드 | `CustomEmbedding` **(신설)** — 현재 `Embedding` 에서 변경 |
| `displayTitle` | **Custom Embeddings** |

**Overview 3문단 골자**
```
① 무엇     남이 만든 범용 임베딩 모델을 내 도메인에 맞게 다시 학습시키는 것.
② 왜       범용 모델은 일반 문장은 잘 다루지만, 법률·의료·사내 문서처럼
           좁은 도메인의 미묘한 차이를 놓친다. 검색 품질이 거기서 갈린다.
③ 모양     맞는 쌍은 가깝게, 틀린 쌍은 멀게(contrastive). 품질을 가르는 것은
           "어떤 오답으로 가르치느냐"다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 범용 모델이 왜 부족한가 | LLM EH Ch.4 RAG Feature Pipeline (11건) |
| C2 | 대조 학습의 골격 — **그리고 그것만으로는 부족하다는 반전** | ✅ arXiv:2505.19274 (원문 확인): *"InfoNCE contrastive loss often reduces effectiveness in state-of-the-art models"* |
| C3 | **hard negative 의 함정 — 가장 비슷한 것의 70%가 사실 정답** | **외부** (NV-Retriever) |
| C4 | cross-encoder 를 교사로 삼기 | `cross-encoder` 3건 + **외부** |
| C5 | 차원을 줄여도 되는가 (Matryoshka) | ✅ arXiv:2205.13147 (원문 확인, 14배 축소 — ⚠️ 비전 결과라 텍스트에 그대로 옮기지 말 것) |
| C6 | 무엇으로 재나 (MTEB **8과제** · 56 데이터셋) | ✅ arXiv:2406.01607 (원문 확인) + `MTEB` 1건 |

🔴 **6축 중 5축이 외부 의존이고, 책 재료는 도구 기준 1건이다.**
```
contrastive (아무 형태)         책에 0건
domain-specific + embedding     책에 0건
hard negative                   책에 1건
MTEB                            책에 1건
fine-tune* + embedding 동시     책에 9건   ← C1 하나를 겨우 받칠 양
```
**D6 승인이 없으면 이 페이지는 착수 자체가 불가능하다.** 반려 시 선택지는 두 가지 —
① Overview·References·Child Concepts 만 채우고 **Cherries 는 비운 채 정직하게 표시**
② 이 항목을 **보류**하고 나머지 5개만 진행

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *LLM Engineers Handbook* Ch.4 "RAG Feature Pipeline" (소장, 149문단) | ✗ |
| NEXT → | NV-Retriever: effective hard-negative mining (arXiv:2407.15831) | ✅ |
| THEN → | Recent Advances in Text Embedding — MTEB 리뷰 (arXiv:2406.01607) | ✅ |
| DEEP DIVE → | Matryoshka-Adaptor (arXiv:2407.20243) | ✅ |

열리는 링크 **3개**.

---

### 5-6. Adversarial Evaluation

| | |
|---|---|
| 메뉴 | `adversarial-eval` |
| 노드 | `RedTeaming` (변경 없음, **연결이 생김**) |
| `displayTitle` | **Adversarial Evaluation and Red Teaming** |

> 제목에 두 이름을 다 넣어 메뉴("평가")와 개념(`RedTeaming`)의 간극을 흡수한다. D3 참조.

**Overview 3문단 골자**
```
① 무엇     일부러 공격해서 모델이 어디서 무너지는지 재는 것.
           red teaming 은 찾는 활동, adversarial evaluation 은 재는 활동이다.
② 왜       일반 평가는 정상 입력에서의 성능을 잰다. 실제 배포에서 문제가 되는 것은
           정상 입력이 아니다.
③ 모양     공격을 만들고(최적화·반복·진화) → 표준 벤치마크로 점수를 내고
           → 그 점수를 매긴 심판이 믿을 만한지 다시 묻는다.
```

**체리 6축**

| # | 축 | 재료 |
|---|---|---|
| C1 | 일반 평가와 무엇이 다른가 | Building Applications Ch.9 Validation (10건) |
| C2 | 공격은 어떻게 만들어지나 | Ch.12 Protecting Agentic Systems (31건 / 134문단) |
| C3 | 프롬프트 인젝션 | `prompt injection` 11건 · AI Engineering Ch.5 (5건) |
| C4 | 심판을 믿을 수 있나 (LLM-as-a-judge) | LLM EH Ch.7 Evaluating LLMs (7건) |
| C5 | **반전 — 로버스트니스는 모델 크기와 무관하다** (계열 *내부* 기준) | ✅ HarmBench arXiv:2402.04249 (원문 확인) |
| C6 | 방어는 부서지기 쉽다 — 다중 턴 · 적응형 공격 | ✅ MultiBreak arXiv:2605.01687 (ASR@1 26.6~83.3%) · 적응형 공격 arXiv:2404.02151 (원문 확인) + Ch.12 |

**References**

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *Building Applications with AI Agents* Ch.12 "Protecting Agentic Systems" (소장, 134문단) | ✗ |
| NEXT → | 같은 책 Ch.9 "Validation and Measurement" (소장) | ✗ |
| THEN → | HarmBench (arXiv:2402.04249) | ✅ |
| DEEP DIVE → | JailbreakBench (NeurIPS 2024) | ✅ |

---

## 6. 스크립트 명세

| 파일 | 성격 | 하는 일 | 안전장치 |
|---|---|---|---|
| `scripts/advanced/precheck.cjs` | 읽기 | 변경 전 상태 스냅샷 · 충돌·순환 사전 검사 | — |
| `scripts/advanced/apply-ontology.cjs` | 🔴 쓰기 | Phase 1 전체 (개념 5 · 관계 22 삽입 + 1 해제 · 별칭 18) | `--confirm` · 단일 트랜잭션 · 전후 건수 출력 |
| `scripts/advanced/rollback-ontology.cjs` | 🔴 쓰기 | 위를 되돌림 (`meta_json.origin='cherry-authored'` 기준) | `--confirm` |
| `scripts/advanced/import-external.cjs` | 🔴 쓰기 | Phase 3 외부 논문 적재 | `--confirm` |
| `scripts/advanced/seed-page.cjs` | 🔴 쓰기 | Phase 4 페이지 1장 발행 (인자로 노드 지정) | `--confirm` |
| `scripts/advanced/verify.cjs` | 읽기 | Phase 5 검증 전체 | — |
| `scripts/ontology/export-ttl.cjs` | 읽기 | Phase 1-B **DB → TTL 전체 + delta 2종** |
| `scripts/ontology/export-snapshot.cjs` | 읽기 | Phase 1-B **DB → `ontology-snapshot.json` 재생성** |
| `scripts/ontology/verify-ttl.cjs` | 읽기 | Phase 1-B 라운드트립 검증 (TTL 파싱 ↔ DB) | — |

**공통 규칙**
```
① 쓰기는 전부 단일 트랜잭션. 하나라도 실패하면 전량 롤백
② 실행 전·후 건수를 반드시 출력   concept · relation · alias · chunk · link
③ 기존 305/310/3,054 가 예상 외로 변하면 즉시 중단
④ ON CONFLICT DO NOTHING 으로 재실행 안전하게
```

---

## 7. Phase 5 — 검증 절차

| # | 검증 | 통과 기준 |
|---|---|---|
| V1 | 건수 | concept 305→**310** · relation 310→**331**(신규 22 삽입 · 기존 1 해제) · alias 7→**25** |
| V2 | 순환 | 0건 |
| V3 | 기존 데이터 무변경 | paragraph_chunk 3,054 · 기존 개념 305개의 이름·설명 불변 |
| V4 | **MECE** | 페이지별 체리 축이 서로 겹치지 않고, Overview ③의 "모양"을 덮는지 사람이 판정 |
| V5 | **원문 대조** | 체리 1건당 `chunkId` 의 **전문**을 읽고 insight 가 원문을 왜곡하지 않는지 확인 |
| V6 | 링크 | References 의 모든 `url` 에 실제 접속. 4칸 중 **2개 이상**이 열려야 함 |
| V7 | 하위 개념 | 6개 페이지 각각 childConcepts **3개 이상** |
| V8 | 화면 | 6개 메뉴를 눌러 4구획이 다 뜨고 로드맵이 그려지는지 실동작 확인 |
| V9 | 중복 매핑 | `custom-embeddings` 와 `embeddings` 가 **다른 노드**를 가리키는지 (기존 V9 경고 해소) |
| V10 | 타입체크 | `tsc --noEmit` 신규 에러 0건 |
| **V13** | **인용 등급** | 체리·Overview 의 모든 외부 주장이 `research/0-요약.md` §6 의 **🟢 A등급**인가. 🔴 미확인 항목이 하나라도 쓰였으면 실패 |
| **V14** | **조건 명시** | 수치가 들어간 주장에 **측정 조건**(벤치마크·모델·판정자)이 함께 적혀 있는가 |

---

## 8. Phase 6 — 최종 확인

Phase 1-B 에서 만든 정본 3종이 **Phase 2~5 를 거치는 동안에도 유효한지** 다시 확인한다.

온톨로지는 Phase 1 이후 바뀌지 않으므로 원칙적으로 재생성이 필요 없다. 다만 다음 경우에는 **Phase 1-B 를 다시 돌린다.**

```
· Phase 3 에서 외부 자료를 넣다가 개념·별칭을 추가한 경우
· Phase 4 중 하위 개념이 부족해 관계를 더 이은 경우
· 검증(V2 순환 · V7 하위개수)에서 실패해 관계를 고친 경우
```

**최종 확인 항목**

| # | 항목 | 통과 기준 |
|---|---|---|
| F1 | 정본 3종 건수 | TTL · 스냅샷 JSON · DB 가 **310 / 331 / 25** 로 일치 |
| F2 | 라운드트립 재실행 | 불일치 0건 |
| F3 | 리서처 JSON | 310 항목 · `validate-researcher-json.cjs` 통과 (⚠️ 이 스크립트는 `deploy` 에 없다 — `1-work-guidelines.md` §5 선행조건) |
| F4 | 원본 무변경 | v2 TTL 대비 305개 개념이 글자 단위로 동일 |
| F5 | v2 보존 | `llm_ontology_v2-2026-08-19.ttl` 이 지워지지 않았음 |

> ⚠️ **GraphDB 를 다시 띄우는 것은 이 기획의 범위가 아니다.** 여기서 만드는 것은 그때 쓸 **입력 파일**이다. 재구축 시점·방법은 별도 결정 사항이다.

---

## 9. 이 기획이 끝나면

```
Advanced 6개    체리 0 → 30~42개 · References 24건(링크 12건 이상)
                ⚠️ D6 반려 시 Custom Embeddings 제외 → 5개 페이지 · 체리 25~35개
온톨로지        305 → 310 개념 · 관계 310 → 331건 · 별칭 7 → 25건
정본 파일       llm_ontology_v3 (전체 + delta) · ontology-snapshot.json · concepts-to-fill.json
                → GraphDB 를 다시 세울 때 이 파일들이 입력이 된다
남는 일         Basics 6개 · 나머지 293개 개념 (→ ../concept-quality/ 의 리서처 작업)
```

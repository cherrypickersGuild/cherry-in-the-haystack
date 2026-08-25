# Advanced 6개 페이지 — 작업 지침 (배경·목표·결정·범위)

> 기준일: 2026-08-25 · 대상 브랜치 `deploy`
> 번호식 4종: 본 문서(지침) · `2-implementation-guide.md`(절차·상세설계) · `3-checklist-table.md`(검수) · `4-progress-log.md`(진행)
> 근거 자료: **`research/`** 7종 — 6개 항목을 외부 논문·서베이로 조사한 결과. 본 기획의 모든 판단은 여기서 나왔다.
> 선행: `../ontology-migration/`(이관 완료) · `../concept-quality/`(콘텐츠 품질 기준) · `../base-data/handoff-2026-08-25.md`

---

## 0. 왜 이 기획인가

Learning > Advanced 6개 메뉴가 가리키는 온톨로지 개념이 **이름과 안 맞는다.** 6개 중 이름이 그대로 있는 건 1개뿐이다.

원인은 단순하다. **PRD의 Advanced 토픽 이름과 온톨로지 개념 이름이 서로 따로 만들어졌고**, 화면을 붙일 때 가장 비슷해 보이는 개념에 연결했다. 근거 문서가 있어서가 아니라 **판단으로 붙인 것이며, 두 건은 잘못 붙였다.**

지금까지는 온톨로지가 지식팀 자산이라 손댈 수 없었다. **2026-08-25 사용자 확정으로 지식팀은 더 이상 없고, 온톨로지는 우리가 직접 고친다.** 그래서 이 기획이 가능해졌다.

---

## 1. 지금 상태 (2026-08-25 실측)

| # | 메뉴 | 매핑 | 상태 | 체리 | **후보 문단** (도구 기준 · 기획 적용 후) |
|---|---|---|---|---:|---:|
| 1 | Advanced Prompting | `AdvancedPrompting` | ✅ 정확 | 0 | **83** (그중 45가 `Reflexion` → 실질 38) |
| 2 | Multi-hop RAG | `HybridRetrieval` | ❌ 틀림 | 0 | **58** |
| 3 | PEFT / LoRA / QLoRA | `ParameterEfficientFinetuning` | ⚠️ 하위 0개 | 0 | 0 → **26** |
| 4 | Multi-agent Orchestration | `MultiAgentSystem` | ⚠️ 하위 0개 | 0 | 0 → **72** |
| 5 | Custom Embeddings | `Embedding` | ❌ Basics와 중복 | 0 | ⚠️ **1** |
| 6 | Adversarial Evaluation | `RedTeaming` | ⚠️ 위치 어긋남 | 0 | **57** |

> ⚠️ **E8 (2차 검토)**: 초안은 이 열을 **손으로 고른 넉넉한 검색어**로 쟀다. 실제 도구는 **노드명 + 별칭 + 하위 개념명**만 쓴다. 위 값은 **도구 기준으로 다시 잰 것**이며, 초안 값(126 · 63 · 26 · 71 · 27 · 100)보다 대체로 낮다.
>
> 🔴 **가장 심각한 것은 Custom Embeddings 다.** 도구 기준 **1건**이고, 주제에 맞는 문단을 따로 찾아도 **10건 안팎**이다. 핵심 축의 재료는 아예 없다.
> ```
> contrastive (아무 형태)        0건   ← 대조학습이 책에 한 번도 안 나온다
> domain-specific + embedding    0건
> hard negative / negative sampl 1건
> MTEB                           1건
> fine-tune* + embedding 동시    9건   ← 사실상 이게 전부
> sentence-transformer           9건
> ```
> → **이 페이지는 소장 도서만으로는 만들 수 없다. D6(외부 자료) 없이는 착수 자체가 불가능하다.**

**6개 전부 체리 0건이다.** 화면은 뜨지만 Overview 윗칸(온톨로지 한글 설명)만 있고 나머지 세 구획이 비어 있다.

**소장 도서 실측**

```
AI Engineering                        18장 ·   877문단
Building Applications with AI Agents  20장 · 1,114문단
LLM Engineers Handbook                20장 ·   670문단
paper                                 23장 ·     0문단   ← 본문 미적재
Reflexion                              0장 ·     0문단   ← 본문 미적재
─────────────────────────────────────────────────────
                                              3,054문단
```

---

## 2. 목표 — 완성의 정의

6개 페이지가 각각 **PRD 4구획을 다 채우고, 근거를 보증할 수 있는 상태**가 되는 것.

| 구획 | 완성 기준 |
|---|---|
| 01 Overview | 3문단(정의 · 왜 중요한가 · 일의 모양). 영어 |
| 02 Cherries | **5~7개**. MECE 축을 문서로 명시하고 그 축을 덮을 것. 각 체리는 **원문 전문을 읽고** 작성 |
| 03 Child Concepts | 온톨로지에서 자동. **최소 3개 이상**이 붙어 있을 것 |
| 04 Progressive References | 4단계(START HERE → NEXT → THEN → DEEP DIVE). **최소 2개는 실제로 열리는 링크** |

> ⚠️ **RAG 페이지의 전철을 밟지 않는다.** 현재 유일한 발행본인 RAG는 원문 앞부분(400~700자)만 보고 요약했고, MECE도 링크도 검증하지 않았다(`../concept-quality/1-work-guidelines.md` §2). 이번엔 검증을 완성 기준에 넣는다.

---

## 3. 결정 사항 — ⚠️ 승인 필요

각 항목의 근거는 `research/` 해당 문서 §8(또는 §10)에 있다.

### D1. Multi-hop RAG — `MultiHopRAG` 신설

| | |
|---|---|
| **제안** | ⭕ 신설. `RAG` 하위, `GraphRAG`·`HybridRetrieval`과 형제. **§3-A 로 하위 개념 연결이 추가됨** |
| 근거 | `HybridRetrieval`은 "한 번에 잘 찾기", multi-hop은 "여러 번 나눠 찾기". **다른 축이다.** 대안(메뉴명을 Hybrid Retrieval로 변경)은 PRD를 고치는 일이라 더 크다 |
| 경계 정의 | **"검색 결과가 다음 검색의 입력이 되는 RAG."** 이 정의면 GraphRAG(색인 구조)·HybridRetrieval(랭킹)과 안 겹친다 |
| 리스크 | 재료가 얇다(직격 5건) → D6과 묶여야 함 |

### D2. Custom Embeddings — `CustomEmbedding` 신설

| | |
|---|---|
| **제안** | ⭕ 신설. `Embedding` 하위 + `Finetuning`과 RELATED. **§3-A 로 하위 개념 2개가 함께 신설됨** |
| 근거 | 신설하지 않으면 Basics "Embeddings"와 **영원히 같은 페이지**다. `Embedding` 하위가 지금 1개(`SemanticRepresentation`)뿐이라 자리가 넉넉하다 |
| 경계 정의 | **"범용 임베딩 모델을 특정 도메인에 맞게 다시 학습시키는 것."** |
| 리스크 | 🔴 **재료 사실상 없음** — 도구 기준 1건 · `contrastive` 0건. **D6 이 전제조건**(R9) |

### D3. Adversarial Evaluation — B안(연결만) 채택

| | |
|---|---|
| **제안** | ❌ 신설하지 않음. `RedTeaming --RELATED--> EvaluationMetric` 만 추가 |
| 근거 | 관련 개념이 **이미 23개** 있다. 신설보다 **연결 정리가 급하다.** `PromptInjection`·`Guardrails`·`SafetyGuard`를 이어주면 하위가 충분히 채워진다 |
| 대안 | A안(`AdversarialEvaluation` 신설)은 메뉴 의미와 더 맞지만, `RedTeaming`과 의미가 90% 겹쳐 형제 중복을 만든다 |
| 보완 | 페이지 제목(`displayTitle`)을 "Adversarial Evaluation and Red Teaming"으로 두어 메뉴-개념 간극을 흡수 |

### D4. LoRA 위치 — PEFT 밑으로 이동

| | |
|---|---|
| **제안** | ⭕ `LoRA --SUBTOPIC--> Finetuning` 을 `LoRA --SUBTOPIC--> ParameterEfficientFinetuning` 으로 변경 |
| 근거 | 학계 표준 분류(arXiv:2403.14608)에서 LoRA는 PEFT의 **Reparameterized** 갈래다. 형제가 아니라 하위가 맞다 |
| ⚠️ 부작용 | **Fine-tuning(Basics) 페이지에서 LoRA 가 직계 하위에서 빠지고 PEFT 밑으로 내려간다.** 대신 `CustomEmbedding` 이 RELATED 로 붙어 **하위 개수는 6 → 6 으로 같다**(E9 정정) |
| 효과 | PEFT 페이지 후보 문단 **0 → 16건**(별칭까지 넣으면 26건) |

### D5. 하위 깊이 — 실무 기준으로 얕게

| | |
|---|---|
| **제안** | 학계 4분류를 **그대로 옮기지 않는다.** 실제로 쓰이는 것만 |
| 근거 | PEFT Survey는 방법을 60여 개 나열한다. 다 넣으면 화면이 학술 색인이 된다. 우리 제품은 **읽고 배우는 곳**이다 |
| 기준 | ① 우리 책에 언급이 있거나 ② 대표 원전이 명확한 것만. 둘 다 아니면 넣지 않는다 |

### D6. 외부 자료 도입 — 2개 항목에 한해 도입

| | |
|---|---|
| **제안** | ⭕ Multi-hop RAG · Custom Embeddings 에 한해 arXiv 논문을 `handbook.book` 에 추가 |
| 근거 | 두 항목은 책 재료만으로 체리 5~7개를 MECE로 못 채운다. 나머지 4개는 책만으로 가능하다 |
| 방법 | `book_source_type_enum` 에 **`WEB_URL` 이 이미 있고** `source_url` 칼럼도 있다 → **스키마 변경 불필요** |
| 부수 효과 | References 링크가 실제로 열리게 된다(현재 RAG는 4개 중 3개가 안 열림) |

### D7. 새 개념의 설명 언어 — 영어

| | |
|---|---|
| **제안** | 새로 만드는 개념의 `description` 은 **영어**로 쓴다 |
| 근거 | 사이트 콘셉트가 영어다. 기존 한글 275건은 **지식팀 유산이므로 그대로 둔다**(2026-08-25 확정). 새로 넣는 것까지 한글로 맞출 이유가 없다 |
| 결과 | 설명 언어가 섞인다. 이는 **의도된 것**이며, `origin` 칼럼으로 출처가 구분되므로 나중에 일괄 정리가 가능하다 |

### D8. `menuLabel` 을 별칭에서 분리 — ⚠️ 기획 중 발견

| | |
|---|---|
| **제안** | ⭕ `concept.service.ts` 한 줄 수정 |
| 문제 | `menuLabel: concept.aliases[0] ?? concept.label` 인데, provider 가 별칭을 **알파벳순**으로 준다. 즉 **별칭을 추가하면 화면 메뉴 이름이 바뀐다** |
| 원인 | 별칭이 "표시 이름"과 "검색어" 두 용도로 겹쳐 쓰이고 있다 |
| 수정 | `menuLabel: page?.concept_name ?? concept.label` — 별칭을 쓰지 않는다. 별칭은 조회·검색 전용 |
| ⚠️ 종속 | **D8 이 승인되지 않으면 별칭 등록을 할 수 없고, 따라서 D1~D7 도 진행 불가** |

---

## 3-A. ⚠️ 2차 검토(2026-08-25)에서 드러난 설계 결함 — D1·D2 범위 확대

**초안은 자기가 세운 완성 기준을 스스로 어겼다.**

§2 완성 기준은 `03 Child Concepts` **3개 이상**을 요구한다. 그런데 화면의 children 은 **"이 개념을 `to` 로 하는 관계"**(`postgres-relation.provider.ts`)다. 초안이 제안한 관계는 신설 개념에서 **바깥으로 나가는** 방향이 대부분이라, 정작 그 페이지에는 하위가 안 뜬다.

**초안 적용 시 실측 결과**

```
Advanced Prompting   11개  ✅
Adversarial Eval      3개  ✅
Multi-hop RAG         2개  ❌ 미달
Multi-agent           2개  ❌ 미달
PEFT / LoRA           1개  ❌ 미달
Custom Embeddings     0개  ❌ 미달   ← 이 구획이 그대로 빈 채로 남는다
```

**6개 중 4개가 미달.** 특히 Custom Embeddings 는 0개라 **작업을 다 해도 그 구획이 지금과 똑같이 비어 있다.**

### 수정 — 신설 개념 2개 → 5개

| 신설 개념 | 상위 | 근거 |
|---|---|---|
| `MultiHopRAG` | `RAG` | D1 (기존) |
| `CustomEmbedding` | `Embedding` | D2 (기존) |
| **`AdapterTuning`** | `ParameterEfficientFinetuning` | PEFT Survey 의 **Additive/Adapters** 갈래. Houlsby et al. 2019 |
| **`ContrastiveFinetuning`** | `CustomEmbedding` | 임베딩 재학습의 기본 골격 |
| **`HardNegativeMining`** | `CustomEmbedding` | 품질을 가르는 핵심 기법 |

> ⚠️ `ContrastiveLearning` 이 아니라 **`ContrastiveFinetuning`** 으로 이름 짓는다. 대조 학습 일반은 임베딩보다 넓은 개념이라, 일반을 특수 밑에 넣으면 계층이 뒤집힌다.

### 수정 — 기존 개념 연결 추가

```
SelfAsk · ReAct · GraphRAG          --RELATED--> MultiHopRAG
QuantizedLoRA                       --RELATED--> ParameterEfficientFinetuning
PlannerExecutorAgent                --RELATED--> MultiAgentSystem
WorkflowAutomation                  --RELATED--> MultiAgentSystem
SemanticRepresentation              --RELATED--> CustomEmbedding
```

**수정 후 실측** — 6개 전부 통과
```
Advanced Prompting  11 · Multi-hop RAG 5 · PEFT 3 · Multi-agent 4
Custom Embeddings    3 · Adversarial Eval 3
```

> ⚠️ **`QuantizedLoRA --RELATED--> ParameterEfficientFinetuning` 은 화면을 위한 지름길 간선이다.** 이미 `QuantizedLoRA --SUBTOPIC--> LoRA --SUBTOPIC--> PEFT` 로 이어져 있어 의미상 중복이다. 손자를 직계로도 노출하려는 표시 목적임을 `note` 칼럼에 기록한다.

---

## 4. 온톨로지를 손대는 원칙

1. **형제와 겹치지 않게.** 새 개념은 형제와의 경계를 **한 문장으로** 정의하고 문서에 남긴다. 정의를 못 쓰면 만들지 않는다.
2. **순환 금지.** 현재 순환 0건. 넣기 전·후로 스크립트 검증한다.
3. **출처를 구분.** `handbook.concept_relation.origin` 이 지금 전부 `graphdb-import` 다. 우리가 넣는 것은 **`cherry-authored`** 로 넣는다. `handbook.concept` 에는 origin 칼럼이 없으므로 `meta_json` 에 `{"origin":"cherry-authored"}` 를 넣는다.
4. **이름 규칙.** CamelCase · 영어 · 약어는 대문자 유지(`RAG` · `LoRA` · `PEFT` · `QLoRA`).
5. **삭제하지 않는다.** 기존 305개 개념·310건 관계는 **하나도 지우지 않는다.** D4의 관계 이동만 예외이며, 이것도 `revoked_at` 소프트 삭제 + 새 행 삽입으로 처리해 이력을 남긴다.
6. **되돌릴 수 있게.** 모든 쓰기는 단일 트랜잭션 · `--confirm` 안전장치 · 롤백 스크립트 동반.
7. ⭐ **정본을 즉시 맞춘다.** 온톨로지를 바꾸면 **같은 Phase 안에서** TTL·스냅샷 JSON·리서처 JSON 을 다시 만든다. DB 만 바뀌고 파일이 남으면, GraphDB 를 다시 세울 때 우리 작업이 통째로 사라진다.
8. ⭐ **정본은 항상 전체다.** 델타만 내보내지 않는다. 원본 305개를 포함한 **완전한 병합본**이어야 파일 하나로 복원된다.

---

## 5. 범위

### ⛔ 선행 조건 — `deploy` 에 없는 스크립트

본 기획의 Phase 1-B·2 는 다음 스크립트에 의존하는데, **`deploy` 브랜치에 없다.** 다른 작업자의 `researcher-evidence-handoff` 브랜치에만 있고 아직 병합되지 않았다.

```
❌ scripts/learning/search-terms.cjs             Phase 2 가 고칠 대상
❌ scripts/learning/validate-researcher-json.cjs Phase 1-B 의 검증 도구
❌ scripts/learning/export-evidence-candidates.cjs
❌ scripts/learning/overview-format.cjs
```

**둘 중 하나를 먼저 해야 한다.**
| 선택 | 내용 |
|---|---|
| ① 병합 | `researcher-evidence-handoff` 를 `deploy` 로 병합. ⚠️ `concepts-to-fill.json` 재생성본과 `.gitignore` 변경도 함께 들어온다 |
| ② 이식 | 필요한 4개 파일만 `deploy` 로 옮긴다 |

> ⚠️ 어느 쪽이든 **`search-terms.cjs` 의 별칭 미반영 결함**(`../base-data/handoff-2026-08-25.md` §5-B)은 Phase 2 에서 고쳐야 한다.

---

### 하는 것

```
① 온톨로지 변경        개념 신설 2개 · 관계 13삽입/1해제 · 별칭 18건 등록
② 검색어 보강          concept_alias 를 검색어에 포함하도록 도구 수정
③ 콘텐츠 작성          6개 페이지 × (Overview 3문단 + 체리 5~7 + References 4)
④ 외부 자료 도입       2개 항목에 한해 arXiv 논문 적재
⑤ 정본 동기화 ⭐        DB → TTL(전체+delta) · ontology-snapshot.json · concepts-to-fill.json
                       전면 재생성. 원본 305개도 전부 포함한 **임시 병합본**을 만든다
⑥ 검증                 MECE · 원문 대조 · 링크 접속 · 순환 · 화면 실동작
```

### 하지 않는 것

```
✗ Basics 6개 손대기          — 이번 범위 아님. 단, D4의 부작용으로 Fine-tuning 페이지는 표시가 바뀐다
✗ 나머지 293개 개념 채우기   — `../concept-quality/` 의 리서처 작업으로 진행
✗ 원문 뷰어 화면 신설        — 소장 도서 링크 문제는 §6-R3 방식으로 우회
✗ 메뉴 이름·PRD 변경         — 온톨로지를 메뉴에 맞추지, 그 반대로 하지 않는다
✗ GraphDB 를 다시 띄우기      — 재구축 **시점·방법**은 이 기획의 범위 밖.
                               다만 그때 쓸 **입력 파일(TTL)** 은 여기서 만든다
✗ 커밋·푸시·배포             — 사용자가 직접 한다
```

---

## 6. 리스크와 대응

| # | 리스크 | 대응 |
|---|---|---|
| R1 | **D4로 Fine-tuning(Basics) 페이지 표시가 바뀐다** | 승인 항목으로 명시. 승인 못 받으면 D4를 빼고 **별칭 등록만**으로 검색어 문제를 푼다(효과 0 → 26건은 그대로) |
| R2 | **새 개념이 형제와 겹친다** — 특히 `MultiHopRAG` vs `GraphRAG` | 경계를 한 문장으로 못 쓰면 만들지 않는다. `2-implementation-guide.md` §2에 문장을 못 박는다 |
| R3 | **소장 도서 References가 안 열린다** (RAG에서 4개 중 3개) | References 4칸 중 **최소 2칸을 외부 링크 가능한 자료**로 채우는 것을 완성 기준에 넣는다. 소장 도서는 링크 대신 **책·장·절을 정확히 표기** |
| R4 | **체리를 원문 대조 없이 쓴다** (RAG의 실패) | 체리 1건당 **원문 전문**을 읽는다. 체크리스트에 chunkId별 확인란을 둔다 |
| R5 | **외부 논문 적재가 저작권 문제가 된다** | arXiv는 대부분 재배포 가능 라이선스지만 **논문별로 확인**한다. 본문 전체가 아니라 **인용 범위만** 적재한다 |
| R6 | **작업 중 프로덕션 DB가 깨진다** 🔴 로컬·프로덕션 공유 | 모든 쓰기 스크립트에 실행 전·후 건수 출력 + 단일 트랜잭션 + 롤백 스크립트. 기존 305/310 건수가 변하면 즉시 중단 |
| R7 | **설명 언어가 섞인다**(D7) | 의도된 것. `meta_json.origin` 으로 구분되므로 나중에 일괄 처리 가능 |
| R9 | 🔴 **Custom Embeddings 는 책 재료가 사실상 없다** (도구 기준 1건 · 주제 적합 10건 안팎 · `contrastive` 0건) | **D6 승인이 이 페이지의 전제조건이다.** D6 반려 시 이 페이지는 Overview·References 만 채우고 **Cherries 를 비운 채 정직하게 표시**하거나, 항목 자체를 보류한다 |
| R8 | **별칭을 넣으면 메뉴 이름이 바뀐다** | D8 로 처리. Phase 2 에서 코드를 먼저 고치고 Phase 1 의 별칭을 넣는다 — **순서가 바뀌면 화면이 깨진다** |

---

## 7. 승인이 필요한 것 (요약)

```
D1  MultiHopRAG 신설                    ⭕ 제안
D2  CustomEmbedding 신설                ⭕ 제안
D3  AdversarialEvaluation 신설 안 함    ❌ 제안 (연결만)
D4  LoRA 를 PEFT 밑으로 이동            ⭕ 제안  ⚠️ Basics 표시 변경 부작용
D5  하위 깊이 — 실무 기준으로 얕게      ⭕ 제안
D6  외부 자료 도입 (2개 항목)           ⭕ 제안
D7  새 개념 설명은 영어                 ⭕ 제안
D8  menuLabel 을 별칭에서 분리        ⭕ 제안  ⚠️ 이게 막히면 전부 막힘
D9  신설 개념 2개 → 5개 (§3-A)        ⭕ 제안  ⚠️ 2차 검토로 범위가 늘어남
D10 TTL 출처 표기 = A안(delta 분리)   ⭕ 제안  RDF 는 트리플에 메타데이터를 못 붙임
```

**D1~D10 승인 전에는 DB에 아무것도 쓰지 않는다.**

### 변경 규모 요약

```
개념 신설       5개    MultiHopRAG · CustomEmbedding · AdapterTuning
                      ContrastiveFinetuning · HardNegativeMining
관계 삽입      22건
관계 해제       1건    LoRA --SUBTOPIC--> Finetuning  (revoked_at)
별칭 등록      18건    검색어 문제 해결
코드 수정       1줄    menuLabel 분리
────────────────────────────────────────
개념 305 → 310 · 관계 310 → 331 · 별칭 7 → 25
```

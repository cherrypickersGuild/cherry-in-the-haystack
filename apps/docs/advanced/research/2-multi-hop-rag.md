# 2. Multi-hop RAG — 자료조사

| | |
|---|---|
| 사이드바 | `multi-hop-rag` / 라벨 "Multi-hop RAG" |
| 현재 매핑 | `HybridRetrieval` |
| 매핑 상태 | ❌ **틀렸다** — 서로 다른 주제다 |
| 조사일 | 2026-08-25 |

---

## 0. 왜 이게 문제인가

`HybridRetrieval`은 **키워드 검색과 벡터 검색을 섞는 기법**이다. 한 번에 잘 찾는 방법이다.
`Multi-hop RAG`는 **한 번 찾은 걸로 다음 질문을 만들어 또 찾는 것**이다. 여러 번 나눠 찾는 방법이다.

**전혀 다른 축이다.** 온톨로지에 `MultiHopRAG`가 없어서 이름이 비슷해 보이는 것에 붙인 것이고, 잘못 붙였다.

---

## 1. 이게 무슨 주제인가

한 번의 검색으로 답이 안 나오는 질문을 다룬다.

> "이 논문의 1저자가 다닌 대학의 총장은 누구인가?"

이걸 답하려면 ① 1저자를 찾고 ② 그 사람의 대학을 찾고 ③ 그 대학 총장을 찾아야 한다. **검색 결과가 다음 검색의 입력이 된다.** 이게 multi-hop이다.

핵심 어려움은 **"언제 그만 찾을 것인가"** 다. 계속 찾으면 비용이 늘고, 일찍 멈추면 답이 틀린다.

---

## 2. 학계 표준 분류 — 4축 설계 프레임워크 (2026)

`Retrieval–Reasoning Processes for Multi-hop Question Answering: A Four-Axis Design Framework` (arXiv:2601.00536)이 가장 정돈된 분류를 제시한다.

### 축 A — 전체 실행 계획 (검색을 언제 하나)

| 방식 | 설명 | 대표 시스템 |
|---|---|---|
| Retrieve-then-Read | 한 번 검색하고 끝 | DrQA · DPR+FiD · 원조 RAG |
| **Interleaved** | 추론과 검색을 번갈아 | **IRCoT · ReAct · Self-Ask** |
| **Plan-then-Execute** | 먼저 쪼개고 나서 검색 | **PAR-RAG · Decomposed Prompting** |
| Test-Time Search Scaling | 여러 경로를 탐색 | Tree-of-Thoughts · MindStar · MCTS |

### 축 B — 색인 구조 (지식을 어떻게 쌓나)

| 방식 | 대표 |
|---|---|
| Flat / 후보 목록 | BM25 · DPR |
| 계층 / 요약 트리 | RAPTOR · LongRAG |
| **그래프 / 지식그래프** | **GraphRAG · KG-o1** |
| 롱컨텍스트 증거 | LongRAG |

### 축 C — 다음 행동 결정 (어떻게 이어갈지 정하나)

```
규칙 기반      ReAct · IRCoT
정책 학습      BEAM Retrieval · SIM-RAG
탐색 기반      Tree-of-Thoughts
검증기 게이트  RARR · Stop-RAG
```

### 축 D — 정지 조건 (언제 멈추나)

```
자원 제약      hop 수 · 토큰 · 지연시간 상한
확신도 기반    불확실성 임계값
검증기 기반    Chain-of-Verification
학습된 정책    가치함수 기반 정지
```

> ⭐ **축 D가 이 주제의 핵심이자 다른 RAG 주제와 갈리는 지점이다.** 일반 RAG에는 "언제 멈출까"라는 질문 자체가 없다.

---

## 3. 대표 원전 · 시스템

| 이름 | 무엇 | 비고 |
|---|---|---|
| **IRCoT** | CoT 문장마다 검색을 끼워 넣음 | 내부 정지 기준이 없어 검색 호출이 과다 |
| **Self-Ask** | 복잡한 질문을 후속 질문으로 쪼개 각각 검색 | Decomposition 계열 |
| **EfficientRAG** | Labeler&Tagger + Filter 이중 구조. 매 단계 LLM을 안 부름 | 비용 절감 |
| **GraphRAG** | 지식그래프 위에서 검색 | 축 B |
| **GeAR** | 그래프 기반 에이전틱 검색 | |
| **TreeHop** | 다음 질의 임베딩을 생성·필터링 | arXiv:2504.20114 |
| **FrugalRAG** | RL 파인튜닝으로 검색 횟수 절감 | arXiv:2507.07634 |
| **TASR** | 학습 없이 반복 검색을 적응적으로 정지 | arXiv:2606.13814 |
| **Stop-RAG** | 검증기가 정지를 판단 | |

**벤치마크**: `HotpotQA` · `2WikiMultiHopQA` · `MuSiQue` · `IIRC` · `MEQA` · `FanOutQA`

---

## 4. 하위 개념 후보 (차일드 컨셉)

**신설 후보**

```
MultiHopRAG           (상위 후보: RAG)
IterativeRetrieval    검색을 반복하는 것 자체
QueryDecomposition    질문을 하위 질문으로 쪼개기
StoppingCriterion     언제 멈출지 — 이 주제의 고유 축
AgenticRAG            에이전트가 검색을 통제하는 형태
```

**이미 있어서 연결만 하면 되는 것**

```
QueryExpansion · QueryProcessing · GraphRAG · Reranking
ContextualRetrieval · KnowledgeGraph · PlannerExecutorAgent
```

`QueryExpansion`과 `QueryProcessing`이 이미 온톨로지에 있다. **multi-hop의 핵심 부품인데 지금은 RAG 밑에 안 붙어 있다.**

---

## 5. 인접 개념과의 경계 — ⚠️ 가장 조심할 부분

| 인접 | 경계 |
|---|---|
| `HybridRetrieval` | **한 번에 잘 찾기** vs **여러 번 나눠 찾기**. 다른 축이다 |
| `GraphRAG` | GraphRAG는 **색인 구조**(축 B), multi-hop은 **실행 계획**(축 A). 자주 같이 쓰이지만 같은 것이 아니다. ⚠️ **여기가 가장 헷갈리는 지점** |
| `AgentArchitecture` | Agentic RAG는 에이전트가 검색을 통제한다. multi-hop과 상당히 겹친다 |
| `AdvancedPrompting` | ReAct·Self-Ask는 **프롬프팅 기법이면서 multi-hop 실행 계획**이다. 이미 `AdvancedPrompting` 밑에 있다 |

> **경계를 이렇게 잡을 것을 제안한다**: MultiHopRAG = "**검색 결과가 다음 검색의 입력이 되는 RAG**". 이 정의면 GraphRAG(색인)·HybridRetrieval(랭킹)과 안 겹친다.

---

## 6. 현재 온톨로지 상태

```
AugmentationTechnique
 └─ RAG
     ├─ ContextualRetrieval
     ├─ DenseRetrieval
     ├─ GraphRAG
     ├─ HybridRetrieval          ← Advanced 메뉴가 잘못 가리키는 곳
     ├─ Reranking
     ├─ SimilaritySearch
     ├─ SparseRetrieval
     ├─ Chunking (RELATED)
     ├─ VectorDatabase (RELATED)
     ├─ Finetuning (RELATED)
     └─ Embedding (PREREQUISITE)

별도로 존재하나 RAG 밑에 없음:
  QueryExpansion · QueryProcessing · Retriever · InformationRetrieval
```

**`MultiHopRAG`도 `IterativeRetrieval`도 없다.**

---

## 7. 우리 DB에 있는 재료

**도구 기준 58건** (기획 적용 후 — `MultiHopRAG` + 별칭 + 하위 `QueryExpansion`·`QueryProcessing`·`SelfAsk`·`ReAct`·`GraphRAG`).
손수 고른 검색어 기준 합집합은 63건. 어느 쪽이든 **직격 용어는 5건뿐**이다.

```
  16  GraphRAG            ← 인접 주제
  15  knowledge graph     ← 인접 주제
  13  query expansion
  10  HotpotQA            ← 벤치마크 언급
   8  reranking           ← 인접 주제
   6  hybrid search       ← 인접 주제
   4  multihop            ← 직격
   3  query rewriting
   1  multi-hop           ← 직격
   1  query router
   0  agentic RAG · self-RAG · corrective RAG · iterative retrieval
```

⚠️ **6개 항목 중 재료가 가장 부족하다.** `multi-hop`/`multihop` 합쳐서 5건이다. **외부 자료 없이는 체리 5~7개를 MECE로 못 채운다.**

---

## 8. 판단을 위한 쟁점 (결정하지 않음)

1. **`MultiHopRAG`를 신설할 것인가?** 신설한다면 `RAG` 하위, `GraphRAG`와 형제. 정의는 "검색 결과가 다음 검색의 입력이 되는 RAG".
2. **아니면 메뉴 이름을 바꿀 것인가?** "Multi-hop RAG" → "Hybrid Retrieval"로 바꾸면 신설 없이 맞는다. 다만 PRD 문구를 바꾸는 일이다.
3. **`QueryExpansion`·`QueryProcessing`을 RAG 밑으로 연결할 것인가?** multi-hop의 부품인데 지금 떠 있다.
4. **외부 자료를 넣을 것인가?** `handbook.book.source_type`에 `WEB_URL`이 이미 있고 `source_url` 칼럼도 있다. **스키마 변경 없이** arXiv 논문을 넣을 수 있다. IRCoT·Self-Ask·EfficientRAG 논문이 1순위 후보.

---

## 출처

- [Retrieval–Reasoning Processes for Multi-hop QA: A Four-Axis Design Framework (arXiv:2601.00536)](https://arxiv.org/html/2601.00536v1)
- [Multi-hop Question Answering (arXiv:2204.09140)](https://arxiv.org/pdf/2204.09140)
- [Agentic Retrieval-Augmented Generation: A Survey (arXiv:2501.09136)](https://arxiv.org/html/2501.09136v4)
- [RAG: A Comprehensive Survey of Architectures, Enhancements, and Robustness Frontiers (arXiv:2506.00054)](https://arxiv.org/pdf/2506.00054)
- [FrugalRAG: Less is More in RL Finetuning for Multi-Hop QA (arXiv:2507.07634)](https://arxiv.org/pdf/2507.07634)
- [TreeHop: Generate and Filter Next Query Embeddings (arXiv:2504.20114)](https://arxiv.org/pdf/2504.20114)
- [TASR: Training-Free Adaptive Stopping for Iterative Retrieval (arXiv:2606.13814)](https://arxiv.org/pdf/2606.13814)
- [EfficientRAG 해설](https://medium.com/@techsachin/efficientrag-an-efficient-retriever-for-multi-hop-question-answering-524490e02030)

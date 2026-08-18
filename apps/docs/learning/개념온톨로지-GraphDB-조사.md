# Learning 개념 온톨로지 (GraphDB) — 조사

> 기준일: 2026-08-16
> **Learning의 "상위개념 ↔ 하위개념 연결"이 실제 코드/DB에서 어떻게 되어 있는지** 조사한 문서. 개념 페이지(4섹션) 중 **③ Child Concepts** 섹션이 이 그래프에서 나온다.
> 관련: `기획문서-참조지도-ND-Learning.md` §3 · `docs/PRD/product-scope.md` §1(4섹션 포맷) · `docs/PRD/functional-requirements.md`(Concept/Evidence Layer).

---

## 0. 결론 한 줄

**상위↔하위 개념 = GraphDB(Ontotext) 온톨로지의 `rdfs:subClassOf` 계층**으로 표현되고(개념 약 302개), python `idea_to_graph_ontology` 파이프라인이 구축하며, 백엔드 `writer_agent`의 `GET /api/writer-agent/related-concepts` SPARQL이 **SELF/PARENT(상위)/CHILD(하위)** 로 반환한다. **현재 프론트(개념 페이지)는 하드코딩이라 이 API에 미연결 — 연결이 다음 작업.**

---

## 1. 기술 스택

| 요소 | 무엇 | 비고 |
|---|---|---|
| **GraphDB (Ontotext 10.7.0)** | RDF 트리플스토어, **SPARQL** 질의 | Docker, 포트 `:7200`, repository = **`llm-ontology`** (`setup_graphdb.sh`) |
| **ChromaDB** | 개념 **벡터 검색**(청크↔개념 매칭) | `db/real/vector_store/` |
| **SQLite** (`new_concepts.db`) | 신규 개념 **스테이징** | 커밋 전 임시 |
| **NetworkX** | 인메모리 그래프 조작 | `ontology_graph_manager.py` |
| **LangGraph** | 문서→온톨로지 매핑 워크플로 | `document_ontology_mapper.py` |
| 서비스 위치 | `python_services/packages/idea_to_graph_ontology/` | 파이썬 패키지 |

---

## 2. 개념 모델 (핵심 — 상위/하위가 여기서 정의됨)

- 각 개념 = **`owl:Class`** + `rdfs:label`(이름) + `llm:description`(풍부한 설명 문단). 규모: 초기 **222개** → 확장(augmented) **302개**.
- **상위/하위 관계 = `rdfs:subClassOf`** (분류 계층). 실제 예:
  - `EncoderOnly` → { BERT, ALBERT, DeBERTa … }
  - `PositionalEncoding` → { ALiBi, RoPE, AbsolutePositional … }
  - `AutomaticMetric` → { Accuracy, BLEU, BPC … }
  - `Quantization` → { AWQ … } · `SearchProcedure` → { AStarSearch … } · `ToolUse` → { APIIntegration … } · `RAG` → { … }
  - 즉 **잎(구체 개념: BERT) → 상위(카테고리 개념: EncoderOnly)** 로 올라가는 트리 구조.
- **비계층 "관련" 관계 = `llm:related`** (`owl:ObjectProperty`, 확장 온톨로지). ⚠️ **현재 거의 미사용(트리플 1개)** — 실질 계층은 `subClassOf`가 전부. (PRD/FR가 말하는 prerequisite/subtopic/extends/contradicts 같은 세분 관계는 **아직 미구현**, 향후 확장 여지.)
- 데이터 파일(`data/`):
  - `llm_ontology.ttl` — 초기 스키마(222) · `llm_ontology_augmented.ttl` — 확장(302, `llm:related` 포함) · `config.ttl` — GraphDB repository 설정.

---

## 3. 백엔드가 그래프를 읽어 프론트에 공급하는 법

모듈: **`apps/api/src/modules/writer_agent/`** (전체 `AgentApiKeyGuard`). config `GRAPHDB.url`/`GRAPHDB.repository`(=`llm-ontology`).

| 엔드포인트 | 파일 | 하는 일 | 개념 페이지 어느 섹션 |
|---|---|---|---|
| **`GET /api/writer-agent/related-concepts?topic=<개념>`** | `graph-concept.service.ts` | GraphDB SPARQL — label=topic 인 `owl:Class` 찾아 **SELF + PARENT(`?node rdfs:subClassOf ?rel`) + CHILD(`?rel rdfs:subClassOf ?node`)** 한 번에 반환 | **③ Child Concepts (상위/하위)** |
| **`POST /api/writer-agent/input`** | `writer-agent.service.ts` | 토픽 매칭 **handbook v2 evidence** 패키징(raw SQL, concept + concept_alias) | **② Cherries (근거)** — 그래프 아님, handbook DB |

- `related-concepts` 응답 형태: `{ topic, matched, parents[], children[], meta{source:'graphdb', repository, total}, errors[] }`. 각 노드 = `{ id(localName), label, description }`.
- 즉 프론트 개념 페이지가 `related-concepts`를 호출하면 **그 개념의 바로 위(부모)·바로 아래(자식) 개념 목록**을 받는다. (한 단계씩.)

---

## 4. 그래프 구축 파이프라인 (python, 사람 검수 = Human-in-the-Loop)

`idea_to_graph_ontology` — 3단계 스테이징:

```
setup_graphdb.sh → initialize_vector_db.py   (초기 1회)
        │
  Stage 1  assign_ontology_concept_to_chunk.py   텍스트 청크 → 개념 매칭(ChromaDB 벡터 + concept_matcher)
        │        산출: db/stage/{task}/staged_result/output_with_concepts.jsonl
        ▼
  Stage 2  commit_ontology_assignment.py          commit_concepts.tsv 수동 편집 후 → GraphDB + Vector DB 커밋
        ▼
  Stage 3  add_relations.py                        개념 간 관계(subClassOf 계층 / related) 추가
```
- 안전장치: `db/stage/`(스테이징) · `db/real.backup/{ts}/`(커밋 전 백업) · `db/relations_backup/`(관계 백업) · `rollback_ontology.py`(롤백).
- 핵심 모듈: `storage/graph_query_engine.py`(SPARQL) · `storage/vector_store.py`(ChromaDB) · `pipeline/concept_matcher.py`(매칭) · `pipeline/ontology_graph_manager.py`(NetworkX).

---

## 5. 프론트 연결 상태 (현재) & 다음 작업

- 개념 페이지 `concept-reader-page.tsx`의 **Child Concepts = 하드코딩**(RAG 예시). `related-concepts` API **미연결**.
- Basics/Advanced 토픽 = placeholder(`handbook-placeholder.tsx`).
- ➡️ **할 일(Learning 완성)**:
  1. 개념 페이지가 **`GET /api/writer-agent/related-concepts?topic=`** 호출 → parents/children 실제 렌더(③ Child Concepts).
  2. **`POST /api/writer-agent/input`** → evidence로 ② Cherries 렌더.
  3. (선택) `llm:related`·세분 관계를 온톨로지에 채워 관련 개념 품질↑.

---

## 6. 핵심 파일 포인터

- **온톨로지 데이터·파이프라인**: `python_services/packages/idea_to_graph_ontology/`
  - `README.md`(전체 워크플로) · `data/llm_ontology*.ttl`(스키마·개념) · `setup_graphdb.sh` · `src/storage/graph_query_engine.py` · `src/scripts/{assign,commit,add_relations,rollback}*.py`
- **백엔드**: `apps/api/src/modules/writer_agent/` (`writer-agent.controller.ts` · `graph-concept.service.ts`[SPARQL] · `writer-agent.service.ts`[handbook evidence]) · config `apps/api/src/config`(`GRAPHDB`)
- **설계 정본**: `docs/PRD/product-scope.md` §1(4섹션·파이프라인) · `docs/PRD/functional-requirements.md`(Concept Layer=명사구 노드 / Evidence Layer=문단, 다대다) · `docs/architecture/handbook-ddl-redesign-proposal.md`(Evidence/handbook 스키마)
- **참조지도**: `기획문서-참조지도-ND-Learning.md` §3(Learning 전체 지도)

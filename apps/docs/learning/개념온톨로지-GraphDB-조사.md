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
- 즉 프론트 개념 페이지가 `related-concepts`를 호출하면 그 개념의 **상위·하위 개념 목록**을 받는다.
  - ⚠️ **정정(2026-08-19 실측)**: "한 단계씩"이 **아니다.** `config.ttl`의 `graphdb:ruleset "rdfs"` 때문에 GraphDB가 `subClassOf` 이행성을 추론해 **조상·자손 전체**를 평면으로 반환한다. 상세 §7-3.

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

---

## 7. 2026-08-19 실측 — 로컬 기동 & API 검증 (중요)

> 이 절은 **추정이 아니라 실제 구동 결과**다. 위 §0~§6의 일부 서술을 정정한다.

### 7-1. 호스팅은 존재하지 않는다 (팀 확인)

- 코드 기본값 `GRAPHDB_URL=http://100.102.45.81:7200`(`apps/api/config.ts:57`, `.env`도 동일)의 **호스트가 Tailscale tailnet에 없다.** 오프라인 기기도 목록엔 남는데 이 IP는 **멤버로도 안 잡힌다.** 온라인 노드 5대의 7200 포트도 전부 닫힘.
- **작성자 확인(정한결)**: "GraphDB는 호스팅이 안 되어 있습니다. 로컬에서만 했어요. to-be는 노트북을 서버로 쓰려고 했다."
- 즉 그 IP는 **3개월 전(커밋 `7920f2a`, 2026-05-31) 작업자 개인 머신의 당시 Tailscale IP**다. → **`config.ts` 하드코딩을 `.env` 전용으로 걷어내는 정리가 필요**(미실행, 사용자 결정 대기).

### 7-2. 로컬 기동은 성공 — 그래프는 리포만으로 완전 재현된다 ✅

`docker compose up -d graphdb`(리포 루트 `docker-compose.yml`의 `cherry-graphdb`, `ontotext/graphdb:10.7.4`) 로 기동 후:

| 단계 | 결과 |
|---|---|
| 리포지터리 생성 (`data/config.ttl`) | HTTP 201 |
| `llm_ontology_augmented.ttl` 로드 | HTTP 204 |
| 트리플 수 | **1,220** |
| `graph-concept.service.ts` SPARQL 실행 | **정상 응답** |

- **`llm_ontology_augmented.ttl`(302개)은 `llm_ontology.ttl`(222개)의 완전한 상위집합**이다(누락 0, 추가 80 — `Chunking`·`ContextWindow`·`Caching`·`ConceptDrift` 등). → **augmented를 정본으로 쓴다.**
- ⚠️ `setup_graphdb.sh`는 기본이 **222개짜리**(`TTL_PATH="$DATA_DIR/llm_ontology.ttl"`)이고 컨테이너명·이미지(`graphdb-ontology`/10.7.0)도 `docker-compose.yml`(`cherry-graphdb`/10.7.4)와 **다르다.** 팀 표준은 docker-compose 쪽.
- 결론: **서버는 TTL을 읽어주는 껍데기이고, 진짜 자산은 리포의 TTL 파일이다.** 작업자 노트북이 없어도 그래프는 복원된다.

### 7-3. ⚠️ API는 "직속"이 아니라 **조상·자손 전체**를 반환한다 (§3 정정)

`topic="Finetuning"` 실호출 비교:

| 조건 | 자식 수 | 내용 |
|---|---:|---|
| 추론 ON (서비스 기본) | **10** | 직속 6개 + `Quantized LoRA`(LoRA의 자식) · `Instruction Following` · `LLM Twin` · `Model Merging` |
| `infer=false` | **6** | TTL에 명시된 직속만 |

- 원인: `config.ttl`의 `graphdb:ruleset "rdfs"` → `subClassOf` **이행성 자동 추론**. PARENT에 최상위 `LLMConcept`이 섞여 나오는 것도 같은 이유.
- **화면 영향**: Child Concepts에 손자·증손자가 형제처럼 평면으로 섞이고, breadcrumb도 직속 부모가 아니라 조상 전부가 온다.
- **선택지**: ⓐ 서비스 SPARQL에 `infer=false` 추가(직속만) ⓑ 추론 결과를 깊이별로 묶어 렌더 ⓒ 평면 노출(비권장). → **권고 ⓐ.** (미결정)

### 7-4. ⚠️ UI 토픽 라벨로는 **하나도 매칭되지 않는다**

API는 `rdfs:label` 완전일치(대소문자만 무시)로 찾는다. 사이드바 라벨 실호출 결과:

| 던진 값 | 결과 |
|---|---|
| `Prompt Engineering` · `Fine-tuning` · `Agents` · `Embeddings` · `Evaluation` | **전부 `NO_CONCEPT_MATCHED`** |
| `RAG` · `Finetuning` · `AgentArchitecture` | 정상 |

- 어긋남 예: `Fine-tuning`↔`Finetuning`(하이픈) · `Agents`↔`AgentArchitecture` · `Embeddings`↔`Embedding`.
- Advanced 2개는 **온톨로지에 아예 없다**: `Multi-hop RAG`(유사 `HybridRetrieval`) · `Multi-agent Orchestration`(유사 `MultiAgentSystem`). `Custom Embeddings`는 `Embeddings`와 **같은 노드로 충돌**.
- → **UI 토픽 ↔ 온톨로지 노드 매핑 테이블 없이는 화면이 통째로 빈다.**

### 7-5. Evidence(Cherries) 쪽은 데이터가 없다 — 별개 트랙

Supabase handbook 스키마 읽기 전용 조회 결과:

| 테이블 | 행수 |
|---|---:|
| `handbook.paragraph_chunk` | **3,054** (AI Engineering 935 · Building Applications with AI Agents 1,248 · LLM Engineers Handbook 776 · Reflexion 95) |
| `handbook.section` / `chapter` / `book` | 746 / 81 / 5 |
| `handbook.concept` · `concept_alias` · `paragraph_concept_link` | **0 · 0 · 0** |
| `handbook.topic` · `subtopic` | **0 · 0** |
| `handbook.paragraph_embedding` | 0 |

- `POST /api/writer-agent/input`의 SQL은 `handbook.concept`에서 시작하므로 **어떤 토픽을 넣어도 빈 결과**다. → **② Cherries 섹션은 현재 데이터로 만들 수 없다.**
- 책 원문 3,054조각은 들어와 있으나 **개념에 연결되지 않은 생청크** 상태.
- 구 스키마 `public.key_ideas` **3,067행**(`core_idea_text`)에 실질 추출 결과가 있다(`idea_groups`는 0행).
- **`2-implementation-guide.md` Phase 0의 핵심 질문("합성 콘텐츠 발행 계층이 있나?")의 답 = 없다.** `content.concept_page`(`concept_slug`·`content_md`·`related_concepts`·`progressive_refs`)가 4섹션과 맞는 스키마이나, 들어있는 **1행은 KaaS 마켓용**(`a-mem-agentic-memory-architecture`)이지 Learning용이 아니다.
- ChromaDB 벡터스토어는 `.gitignore`의 `db/`에 걸려 **작업자 로컬에만** 존재.

### 7-6. 리포 TTL이 최신이 아닐 수 있다 (미해소)

- `data/*.ttl` 마지막 커밋 **2026-04-07**(`295f516`), GraphDB 연동 코드는 **2026-05-31**(`7920f2a`) — 7주 차이. 그 사이 로컬에서 Stage 2/3을 돌렸다면 파일에 없다.
- → 작성자에게 **GraphDB Workbench → Export → Turtle** 요청 필요(미수신). 다만 이는 **개수가 302보다 늘 수 있다**는 뜻이지 구조(단일 루트·깊이 6·전 개념 설명 보유)가 바뀐다는 뜻은 아니다.

### 7-7. 재현 방법

```bash
docker compose up -d graphdb                                  # cherry-graphdb :7200
D=python_services/packages/idea_to_graph_ontology/data
curl -X POST -F "config=@$D/config.ttl" http://localhost:7200/rest/repositories
curl -X POST -H "Content-Type: text/turtle" --data-binary "@$D/llm_ontology_augmented.ttl" \
     http://localhost:7200/repositories/llm-ontology/statements
curl http://localhost:7200/repositories/llm-ontology/size    # 1220
```
- Workbench: http://localhost:7200 (repository `llm-ontology`)
- 정리: `docker stop cherry-graphdb` / 완전 제거는 `docker rm -f cherry-graphdb && docker volume rm cherry-in-the-haystack_graphdb_data`
- ⚠️ `apps/api/.env`의 `GRAPHDB_URL`은 **아직 죽은 IP 그대로**다(미변경). API 레벨 검증을 하려면 `http://localhost:7200`으로 바꿔야 한다.

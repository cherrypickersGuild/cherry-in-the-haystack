# GraphDB 데이터 마이그레이션·동기화 — 작업 지침 (배경·목표·범위·의사결정)

> 기준일: 2026-08-19 · 대상 브랜치 `deploy`
> 번호식 4종: 본 문서(지침) · `2-implementation-guide.md`(스키마·절차) · `3-checklist-table.md`(검증) · `4-progress-log.md`(진행).
> 관련: `../learning/1-work-guidelines.md`(Learning 역순 작업) · `../learning/개념온톨로지-GraphDB-조사.md` §7(실측) · `../learning/ontology-gap/`(갭 리포트)
> 🔴 **본 작업은 공유 프로덕션 DB(Supabase)에 쓰기를 포함한다.** 모든 쓰기는 SQL 사전 제시 → 사용자 승인 후 실행(작업지침 §5·§7).

---

## 1. 배경 — 왜 이 작업이 필요한가

1. **Learning 화면을 JSON으로 만들 수 없다.** 개념이 302개(+증가)라 손으로 쓰는 JSON은 확장 불가. **DB에서 자동 생성**해야 한다.
2. **개념 간 관계가 GraphDB에만 있다.** Postgres `handbook` 스키마에는 **개념 관계 테이블이 아예 없다**(실측: `concept`·`concept_alias`·`paragraph_concept_link`만 존재).
3. **GraphDB는 호스팅이 없다.** 작성자(정한결) 확인 — 개인 로컬에서만 구동. 코드 기본값 `100.102.45.81:7200`은 죽은 IP(tailnet 비멤버).
4. → 지금 상태로 DB 기반 화면을 만들면 **로컬에선 되고 프로덕션에선 03 Child Concepts 가 통째로 빈다.**

## 2. 목표

**① 프로덕션에서 화면이 뜨게 한다** — 관계를 Postgres로 이관해 GraphDB 없이 서빙 가능하게.
**② 나중에 되돌릴 수 있게 한다** — GraphDB 정본으로 전환하거나 동기화하는 선택지를 **코드 수정 없이** 열어둔다.

> 목표 ②가 핵심이다. 지금의 이관은 **임시 조치**이며, 온톨로지 도구(GraphDB Workbench·SPARQL·python 파이프라인)를 영구히 버리는 결정이 아니다.

## 3. 결정 사항

| # | 결정 | 근거 |
|---|---|---|
| D1 | **관계를 Postgres에 둔다**(안 (가)) | GraphDB 호스팅 부재. 남의 노트북에 서비스가 걸리는 구조를 재발시키지 않음 |
| D2 | **3모드 전환 구조**: `postgres` / `graphdb` / `synced` | 목표 ② |
| D3 | 전환 스위치는 **백엔드 env**(`CONCEPT_RELATION_SOURCE`) 먼저, 관리자 UI는 나중 | 지금 쓰지도 않을 설정 화면을 늘리지 않음. 인터페이스만 갖춰두면 나중에 한 줄 |
| D4 | **온톨로지 노드 id를 `handbook.concept.meta_json`에 보존** | 전환 시 이름 매칭은 깨진다(실측: `Hybrid Search`↔`HybridRetrieval`). id가 있어야 기계적 전환 가능 |
| D5 | 관계 유형 5종(SUBTOPIC·PREREQUISITE·EXTENDS·RELATED·CONTRADICTS)을 **Postgres에 온전히 저장** | GraphDB는 현재 `rdfs:subClassOf` 1종뿐 |
| D6 | python 파이프라인(`idea_to_graph_ontology`)은 **당분간 재가동하지 않음** | 개념은 화면 작업의 갭 리포트로 늘어남. 재가동 시점에 출력처를 정함 |

## 3-A. 작업 순서 규칙 ⭐ (S3 3회차 — 안 정하면 두 번 일한다)

> **GraphDB 보완을 먼저 하고, 그다음 이관한다.**

이관을 먼저 하면 갭 리포트가 도출한 신설 개념(`Reranking` 등)이 Postgres 에 없어서 **화면은 여전히 `SOON`** 이고, 나중에 GraphDB 에 넣어도 Postgres 는 모른다 → **같은 작업을 두 번** 하게 된다.

```
① GraphDB 보완 (로컬 · 위험 0)   ② 스냅샷 추출·커밋   ③ Postgres 이관   ④ 컬럼 보완·API·화면
   중복 정리 · 노드 신설 · 관계 유형 · 누락 관계        (한 번에 최신 상태로)
```

## 3-B. 확장 범위 — GraphDB 수정·보완 (본 기획에 포함)

갭 리포트(`../learning/ontology-gap/index.html`)가 도출한 항목을 **이관 전에** GraphDB 에 반영한다.

| 작업 | 내용 | 근거 |
|---|---|---|
| B1 **중복 정리** | `Alignment`·`InferenceOptimization` — 라벨 2개·설명 2개 → canonical 1개 + 나머지 alias | 실측(S3 2회차) |
| B2 **노드 신설** | `Reranking`(2회 도출) · `Contextual Retrieval` · `GraphRAG` | 갭 `MISSING_NODE` |
| B3 **관계 유형 서술어** | `llm:prerequisite` · `llm:extends` · `llm:related` 정의 | 갭 `RELATION_TYPE_GAP` · R7 해소 |
| B4 **누락 관계** | 노드는 있으나 연결 없는 쌍(`Embedding`↔`RAG` 등) | 갭 `MISSING_RELATION` |
| B5 **별칭 표현** | 화면 라벨(`Hybrid Search` 등)을 `skos:altLabel` 또는 `llm:alias` 로 | 갭 `LABEL_ALIAS` |

⚠️ B1~B5 는 **승인된 제안만** 반영한다(`ontology-gap/decisions.json`). 미검토 항목은 넣지 않는다.

## 3-C. 확장 범위 — 기본 DB 컬럼 추가·보완 (본 기획에 포함)

| # | 대상 | 보완 | 이유 |
|---|---|---|---|
| C1 | `handbook.concept` | **`ontology_node` 전용 컬럼 추가**(+부분 유니크 인덱스) | `meta_json` 만으로는 유니크 제약·조인이 불편. 전환 매칭의 핵심 키(D4) |
| C2 | `content.concept_page` | **용도 구분 컬럼**(예: `surface`/`kind`) | 현재 KaaS 유물 1행과 Learning 페이지가 **같은 테이블에 섞인다** |
| C3 | `handbook.concept` | 설명 언어(`description_lang`) 검토 | 설명 91% 한글 — 영문 사이트 정책과 연결 |
| C4 | `concept_relation` | `origin`·`note` (설계에 이미 포함) | 사람이 넣은 관계를 동기화가 덮지 않게 |

⚠️ C1~C3 는 **기존 테이블 변경(ALTER)** 이라 🔴 위험도가 신규 테이블보다 높다. **컬럼 추가만**(NULL 허용), 기존 컬럼 변경·삭제 없음.

## 4. 범위

**옮기는 것**
| 대상 | 수량(실측) |
|---|---:|
| 개념 노드 (`owl:Class` + `rdfs:label`) | **302** |
| 계층 관계 (`rdfs:subClassOf`) | **301** |
| 설명 (`llm:description`) | **308행** (302 클래스 중 2개가 라벨 2개 보유) |

**안 옮기는 것**
- ChromaDB 벡터스토어(`db/` — `.gitignore`로 로컬 전용) · 스테이징(`new_concepts.db`) · 백업 디렉터리
- 구 스키마 `public.key_ideas`(3,067행) — **건드리지 않는다**
- `handbook.paragraph_chunk`(3,054행) — 이미 있음, 이관 대상 아님

## 5. 🔴 위험 · 제약 (실측 기반)

| # | 위험 | 실측 내용 | 대응 |
|---|---|---|---|
| R1 | **공유 프로덕션 DB** | 로컬=프로덕션 동일 Supabase | SQL 사전 제시·승인, 단일 트랜잭션, 롤백 스크립트 동봉 |
| R2 | **별칭 유니크가 전역** | `uq_concept_alias_text_ci_active` = `lower(alias_text)` **전역 유니크**(개념별 아님) | 삽입 전 **충돌 사전 점검** 필수. 충돌 시 중단하고 보고 |
| R3 | **개념명 유니크(대소문자 무시)** | `uq_concept_canonical_name_ci_active` = `lower(canonical_name)` where `revoked_at IS NULL` | 이관 전 중복 라벨 정리 |
| R4 | **라벨 2개인 클래스 존재** | `Alignment`·`InferenceOptimization` — 클래스 302 vs 라벨 308 | 하나를 canonical, 나머지는 alias 로 (R2 점검 통과 시) |
| R5 | **멱등성** | 재실행 시 관계 중복 삽입 위험 | `(from,to,type)` 유니크 + `ON CONFLICT DO NOTHING` |
| R6 | **리포 TTL이 최신이 아닐 수 있음** | `data/*.ttl` 마지막 커밋 2026-04-07, GraphDB 연동 코드는 05-31 | 작성자 export 미수신 — **이관 전 재확인**. 추가분은 나중에 증분 이관 가능 |
| R7 | **관계 유형 비대칭** | Postgres 5종 ↔ GraphDB 1종 | GraphDB로 되돌리려면 **먼저 서술어 확장**(Learning Phase 5). 그 전엔 전환 시 유형 손실 |
| R8 | **삭제 반영** | GraphDB에서 지운 개념을 Postgres가 모름 | `revoked_at` 소프트 삭제. 동기화 모드에서만 처리, 초기 이관은 **삽입만** |
| R10 | **`content.concept_page` 를 읽는 코드가 0** | 실측: 백엔드 어디서도 안 씀. DDL 에만 존재. 1행(`a-mem…`)은 출처 불명 유물 | 여기 넣는다고 화면이 뜨지 않는다 — **읽기 API 를 새로 만들어야 함**(범위에 포함) |
| R11 | **로컬 GraphDB 가 유일 소스** | 호스팅 없음. 내 맥북 컨테이너뿐 | **스냅샷 파일을 리포에 커밋**해 재현·감사 가능하게 |
| R12 | **보완/이관 순서** | 순서를 안 정하면 두 번 작업(§3-A) | GraphDB 보완 → 스냅샷 → 이관 |
| R9 | 순환 관계 | subClassOf 는 트리라 사이클 없음(실측: 단일 루트 `LLMConcept`, 최대 깊이 6) | 이관 후 사이클 검사로 재확인 |

## 6. 갈림길 (착수 전 사용자 결정)

| # | 갈림길 | 권고 |
|---|---|---|
| G1 | 이관 전에 작성자 **export 를 기다릴지** | 기다리지 말고 302개로 진행 · 추가분은 증분 이관(R6) |
| G2 | 관계 테이블 위치: `handbook` 스키마 vs 신규 스키마 | **`handbook`** — 개념 마스터와 같은 스키마 |
| G3 | 초기 이관 범위: **302개 전부** vs Learning 12개 관련분만 | **302개 전부** — 데이터가 작고(관계 301), 부분 이관은 나중에 정합성 문제를 만듦 |
| G4 | 설명 한글 91% | 그대로 이관(원문 보존). 표시 정책은 Learning 쪽에서 별도 결정 |

## 7. 결과물

- `handbook.concept_relation` 테이블 + 이관된 개념·관계
- 관계 공급자 인터페이스(3모드) + `CONCEPT_RELATION_SOURCE` env
- 소스 대조 스크립트(`relation-source-diff`) — **전환 전 안전 확인용**
- 롤백 스크립트

세부 절차는 `2-implementation-guide.md`, 검증은 `3-checklist-table.md`.

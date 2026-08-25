# API 백엔드 현황 (기준일: 2026-08-25)

> `apps/api`(NestJS). **08-01 대비 델타 문서.**
> 전체 모듈 구조·엔드포인트의 정본은 `legacy-docs/api-backend-status-2026-07-13.md`, 랜드스케이프 관련은 `api-backend-status-2026-08-01.md` — 둘 다 **여전히 유효**하다. 여기엔 그 이후 새로 생긴 것만 적는다.
> 이번 델타의 핵심: **Learning 개념 페이지 공개 읽기 API 신설** + **온톨로지 305개를 Postgres로 이관**(GraphDB 의존 제거).
> 함께 볼 것: `handoff-2026-08-25.md` · `frontend-status-2026-08-25.md` · `../ontology-migration/`(이관 기획 4종) · `../concept-quality/`(콘텐츠 품질 기획 4종)

---

## 0) 08-01 대비 델타 요약

| 구분 | 변경 | 위치 |
|---|---|---|
| **신규 모듈** | `ConceptModule` — Learning 개념 페이지 조립·서빙 | `src/modules/concept/` |
| **신규 엔드포인트** | `GET /api/learning/concepts` · `GET /api/learning/concepts/:key` (둘 다 **인증 없음**) | `concept.controller.ts` |
| **DB 스키마 변경** | 마이그레이션 2건 적용 완료 (아래 §2) | `docs/architecture/*-2026-08-19.sql` |
| **DB 데이터 적재** | 개념 305 · 관계 310 · 별칭 7 (GraphDB TTL → Postgres) | `handbook.concept*` |
| **운영 계정** | 읽기 전용 DB 계정 `researcher_ro` 신설 (2026-08-25) | Postgres 역할 |
| **스크립트** | `scripts/ontology/` 5개 · `scripts/learning/` 3개 | 아래 §5 |

> 그 외 백엔드(app-user·bench·kaas·writer_agent·frameworks_landscape·chain adapter 등)는 **07-13/08-01 문서와 동일, 변경 없음.**

---

## 1) 신규 모듈 — `ConceptModule`

### 1-1. 파일 구성

```
src/modules/concept/
├── concept.module.ts               모듈 등록 (app.module.ts:32 에 등록됨)
├── concept.controller.ts           @Controller('learning/concepts') · 인증 가드 없음
├── concept.service.ts              ConceptPageDto 조립 (206줄)
├── concept-relation.provider.ts    인터페이스 + DI 토큰 CONCEPT_RELATION_PROVIDER
└── providers/
    └── postgres-relation.provider.ts   Postgres 구현 (유일한 구현체)
```

### 1-2. 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| GET | `/api/learning/concepts` | 개념 목록(온톨로지 전체 305개) | 없음 |
| GET | `/api/learning/concepts/:key` | 개념 페이지 1장. `key`는 **slug · 온톨로지 노드명 · 별칭** 아무거나 | 없음 |

- **왜 공개인가**: 기존 `writer_agent` 모듈은 `AgentApiKeyGuard`가 걸려 있어 프론트에서 못 쓴다. 그래서 읽기 전용 공개 엔드포인트를 따로 뒀다.
- 못 찾으면 `NotFoundException` → 404 `unknown concept: <key>`.

### 1-3. 응답 DTO (`ConceptPageDto`)

PRD의 개념 페이지 4구획(Overview → Cherries → Child Concepts → Progressive References)이 그대로 필드로 대응한다.

```ts
{
  slug, node, section: 'BASICS'|'ADVANCED'|null, title, menuLabel, aliases[],
  meta: { updated, verified, source,
          contributors: { handle, initials, role }[] },   // 현재 0행 — 채워지면 자동 표시
  overview:   { definition, body },                        // 01
  cherries:   { source, author, locator, insight, curated, chunkId }[],  // 02
  childConcepts: { label, node, relation, why, hasPage }[],              // 03
  references: any[]                                        // 04
}
```

- 모든 조회는 `revoked_at IS NULL` 로 소프트 삭제를 거른다.
- `childConcepts[].hasPage` = 그 개념에 발행된 `content.concept_page`가 있는지 → 프론트가 **실선/점선**으로 구분해 그린다.

### 1-4. ⚠️ 관계 소스 전환 스위치 — 지금은 "설계만" 되어 있음

- `concept-relation.provider.ts`가 인터페이스와 DI 토큰을 정의하고, `concept.module.ts`가 `PostgresRelationProvider`를 주입한다. 서비스는 인터페이스만 보므로 **구현체를 갈아끼우면 화면·API 코드 수정 없이 소스가 바뀐다.**
- **다만 `CONCEPT_RELATION_SOURCE` env를 실제로 읽는 코드는 아직 없다.** 현재 코드·주석·기획서(`../ontology-migration/2-implementation-guide.md` §5)에만 이름이 등장하고, 모듈은 Postgres 구현을 **하드코딩**해 등록한다.
- 나중에 GraphDB로 되돌리려면: `providers/graphdb-relation.provider.ts`를 추가하고 `concept.module.ts`의 `useExisting`을 env 기반 `useFactory`로 바꾸면 된다. **그 한 곳만 고치면 된다.**

---

## 2) DB 스키마 변경 (🔴 공유 DB에 이미 적용됨)

> 🔴 로컬·프로덕션이 **같은 Supabase DB**를 쓴다. 아래는 **이미 실행되어 반영된 상태**이며, 다시 실행할 필요가 없다.

### 2-1. `docs/architecture/concept-relation-migration-2026-08-19.sql`

| 대상 | 변경 |
|---|---|
| `handbook.concept` | `ontology_node VARCHAR(200)` 추가 + 활성행 부분 유니크 인덱스 |
| `handbook.concept` | `description` 을 `VARCHAR(1000)` → **TEXT** 로 확장 |
| `handbook.concept_relation` | **신규 테이블** (from/to/relation_type/origin/note + `revoked_at`) |
| `handbook.concept_relation_enum` | **신규 ENUM** — `SUBTOPIC · PREREQUISITE · EXTENDS · RELATED · CONTRADICTS` |
| `handbook.paragraph_concept_link` | `insight TEXT` 추가 (체리 문장 저장용) |
| `content.concept_page` | `surface VARCHAR(20)` · `ontology_node VARCHAR(200)` · `section VARCHAR(20)` 추가 + 인덱스 |

- 관계 읽는 법: **`from` 은 `to` 의 `<relation_type>` 이다.** (예: `Chunking` 은 `RAG` 의 `SUBTOPIC` 이다)
- 롤백: `concept-relation-migration-2026-08-19.rollback.sql`

### 2-2. `docs/architecture/concept-page-contributor-2026-08-19.sql`

- `content.concept_page_contributor` **신규 테이블** — 개념 페이지별 기여자.
- `role` 은 `CHECK (role IN ('Author','Evidence sourcing','Lead reviewer','Concept mapping'))`.
- 롤백: `concept-page-contributor-2026-08-19.rollback.sql`

### 2-3. ⚠️ `description` 폭 확장은 실패에서 나온 것

이관 중 305개 중 5개의 `description` 이 `VARCHAR(1000)` 을 넘어 트랜잭션이 통째로 롤백됐다(DB 변경 0). 컬럼을 TEXT로 넓히고 재실행해서 통과했다. **길이 제약을 미리 재보지 않은 것이 원인**이므로, 앞으로 대량 적재 전에는 `precheck.cjs` 를 먼저 돌린다.

---

## 3) 적재된 데이터 (2026-08-25 실측)

```
handbook.concept                 305   (revoked_at IS NULL)
handbook.concept_relation        310   (origin = 'graphdb-import' 전량)
handbook.concept_alias             7
handbook.paragraph_chunk       3,054   (기존 · 변화 없음)
handbook.paragraph_concept_link    7   (RAG 체리 · insight 7건 모두 채워짐)
content.concept_page               2   (RAG 1 + 기존 a-mem 1)
content.concept_page_contributor   0
handbook.book                      5
handbook.knowledge_verification_contributor  0
```

**별칭 7건** — 이게 검색·조회 시 중요하다.

```
Chunking             → Chunking Strategies
Embedding            → Embeddings
Finetuning           → Fine-tuning
HybridRetrieval      → Hybrid Search
InferenceOptimization→ InferenceOptimization
RAG                  → Retrieval-Augmented Generation
VectorDatabase       → Vector Databases
```

**도서 5종**

```
AI Engineering                        Chip Huyen
Building Applications with AI Agents  Michael Albada
LLM Engineers Handbook                Unknown
paper                                 Unknown
Reflexion                             Unknown
```

**발행된 개념 페이지는 RAG 하나뿐**(`concept_slug='rag'`, `section='BASICS'`, `surface='learning'`, `progressive_refs` 4건). 나머지 304개는 온톨로지 이름·설명·관계만 있고 페이지 본문이 없다.

---

## 4) 읽기 전용 DB 계정 `researcher_ro` (2026-08-25 신설)

외부 리서처가 DB에서 직접 근거 문단을 뽑을 수 있도록 신설했다.

```sql
CREATE ROLE researcher_ro LOGIN PASSWORD '<사용자가 직접 지정>';
GRANT pg_read_all_data TO researcher_ro;
```

**검증 결과(실측)**

| 항목 | 결과 |
|---|---|
| 슈퍼유저 / 역할생성 / DB생성 / RLS우회 / 복제 | 전부 `false` |
| 소속 그룹 | `pg_read_all_data` **하나뿐** |
| 읽기 | 12개 스키마 108개 테이블 **전부 가능** |
| INSERT/UPDATE/DELETE/TRUNCATE 가능한 테이블 | **0개** |
| CREATE 가능한 스키마 | **0개** |

- 접속 host/port/database 는 `apps/api/.env` 의 `LOCAL_DB_*` 와 동일.
- ⚠️ Supabase 풀러를 거치므로 **계정명에 프로젝트 ID를 붙여야 한다**: `researcher_ro.<project-ref>` (기존 `postgres.<project-ref>` 와 같은 형식).
- 비밀번호는 사용자가 직접 정했고 **저장소·문서 어디에도 없다.** 잊으면 `ALTER ROLE researcher_ro PASSWORD '...'` 로 재설정한다.
- ⚠️ 이 계정은 `pg_read_all_data` 라서 **회원 이메일·API키·지갑이 있는 스키마도 읽힌다.** 스키마를 좁히려면 `pg_read_all_data` 를 회수하고 `GRANT USAGE/SELECT ON SCHEMA handbook, content` 로 바꾸면 된다(사용자 판단으로 현재는 전체 읽기).
- 제거: `DROP ROLE researcher_ro;`

---

## 5) 스크립트

### 5-1. `scripts/ontology/` — 온톨로지 이관 (1회성, 이미 완료)

| 파일 | 성격 | 하는 일 |
|---|---|---|
| `export-graphdb.cjs` | 읽기 | GraphDB → 스냅샷 JSON. 이후 단계는 GraphDB를 다시 안 묻는다 |
| `precheck.cjs` | 읽기(dry-run) | 이관 전 충돌·길이 점검 |
| `import-postgres.cjs` | 🔴 **쓰기** | 스냅샷 → Postgres. 단일 트랜잭션 · INSERT만 · 재실행 안전. `--confirm` 필요 |
| `verify.cjs` | 읽기 | 스냅샷 ↔ Postgres 라운드트립 대조 |
| `seed-rag-page.cjs` | 🔴 **쓰기** | RAG 페이지 1행 + 체리 7행 발행. `--confirm` 필요 |

- 스냅샷 정본: `apps/docs/ontology-migration/ontology-snapshot.json`
- TTL 원본: `python_services/packages/idea_to_graph_ontology/data/llm_ontology_v2-2026-08-19.ttl`
- ⚠️ TTL 내보낼 때 **`infer=false` 필수**. 안 그러면 RDFS 추론으로 생긴 가짜 상위관계가 섞인다(실제로 한 번 섞였다).

### 5-2. `scripts/learning/` — 콘텐츠 현황·리서처 패키지 (반복 사용)

| 파일 | 성격 | 하는 일 |
|---|---|---|
| `content-status.cjs` | 읽기 | 개념 페이지 콘텐츠 현황 리포트 |
| `build-researcher-json.cjs` | 읽기 | 리서처용 `concepts-to-fill.json` 생성 (305개 × 20필드) |
| `ontology-gap.cjs` | 읽기 | 갭 리포트 생성 — ⚠️ **아래 §6 참조, 지금은 못 쓴다** |

---

## 6) ⚠️ 알려진 문제 · 미결

| # | 내용 | 영향 |
|---|---|---|
| B1 | `CONCEPT_RELATION_SOURCE` env를 읽는 코드가 없다(문서·주석에만 존재) | 지금은 무해. GraphDB 복귀 시 `concept.module.ts` 수정 필요 |
| B2 | `scripts/learning/ontology-gap.cjs` 가 `apps/web/public/learning/concepts/*.json` 을 정본으로 읽는데, **그 JSON은 DB 이관으로 폐기됐다** | 스크립트가 낡은 데이터를 본다. 재조준하거나 폐기해야 함 |
| B3 | `content.concept_page` 에 `revoked_at` 컬럼이 없다(다른 handbook 테이블엔 있음) | 소프트 삭제 패턴 불일치. 서비스는 `is_published` 로만 거른다 |
| B4 | `handbook.knowledge_verification_contributor` · `content.concept_page_contributor` 둘 다 0행 | 화면에 기여자가 안 나온다(코드는 준비됨) |
| B5 | 리서처용 근거 추출 도구(`export-evidence-candidates.cjs` 등 4개)가 **`deploy` 에 없다** — `researcher-evidence-handoff` 브랜치에만 있음 | §7 참조 |

**타입체크 상태(2026-08-25 실측)**
- `apps/api`: `kaas-credit.service.spec.ts(154)` 1건 — **기존 무관 에러**
- 이번 작업으로 생긴 신규 에러 **0건**

---

## 7) 미병합 브랜치 — `researcher-evidence-handoff`

다른 작업자가 올린 브랜치. **`deploy` 에 병합되지 않았다.**

```
d90a237 docs: fix null url & md file
5e326e7 learning: add researcher evidence handoff tooling
```

| 파일 | 상태 |
|---|---|
| `scripts/learning/export-evidence-candidates.cjs` | 신규 129줄 — 개념별 근거 후보 문단을 DB에서 추출 |
| `scripts/learning/validate-researcher-json.cjs` | 신규 268줄 — 리서처 JSON 형식 검증 |
| `scripts/learning/search-terms.cjs` | 신규 62줄 — 개념별 검색어 생성 |
| `scripts/learning/overview-format.cjs` | 신규 56줄 — Overview 형식 유틸 |
| `scripts/learning/build-researcher-json.cjs` | 93줄 수정 |
| `concepts-to-fill.json` | 재생성본 |
| `.gitignore` | `evidence-candidates/` 제외 3줄 추가 |

**⚠️ 이 도구에 확인된 결함이 하나 있다.** `search-terms.cjs` 가 온톨로지 **정식 이름만** 검색어로 쓰고 `handbook.concept_alias` 를 안 읽는다. 그 결과 RAG 추출 시 **이미 발행된 체리 7개 중 1개(Hybrid search, chunkId `019e785e-8a25-70af-897a-13f2e80f9e67`)가 후보 241개에서 빠졌다.** 책에는 "Hybrid search"라고 적혀 있는데 검색어는 `HybridRetrieval` 이라서다. 별칭을 포함하면 후보가 **241 → 306** 으로 는다.

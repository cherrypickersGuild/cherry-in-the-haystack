# GraphDB 마이그레이션·동기화 — 구현 가이드 (스키마 · 절차)

> `1-work-guidelines.md` 의 결정(D1~D6)을 실제로 구현하는 방법. 🔴 모든 쓰기는 SQL 사전 제시 → 승인 후 실행.

---

## 1. 스키마 — `handbook.concept_relation` (신규)

```sql
-- 관계 유형: 화면 03 Child Concepts 의 배지와 1:1
CREATE TYPE handbook.concept_relation_enum AS ENUM (
  'SUBTOPIC', 'PREREQUISITE', 'EXTENDS', 'RELATED', 'CONTRADICTS'
);

-- ⚠️ 기존 handbook 테이블들은 id 기본값이 **없다**(앱이 UUIDv7 을 직접 생성해 넣는 구조).
--    신규 테이블은 기본값을 두되, `handbook.concept` 등 기존 테이블에 INSERT 할 때는
--    **id 를 명시적으로 넣어야 한다**(gen_random_uuid()). 안 넣으면 NOT NULL 위반.
CREATE TABLE handbook.concept_relation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- pgcrypto 설치 확인됨
  from_concept_id UUID NOT NULL REFERENCES handbook.concept(id),
  to_concept_id   UUID NOT NULL REFERENCES handbook.concept(id),
  relation_type   handbook.concept_relation_enum NOT NULL,
  -- 출처 추적: 어디서 온 관계인가 (이관/사람/파이프라인)
  origin          VARCHAR(20) NOT NULL DEFAULT 'graphdb-import',
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  CONSTRAINT ck_concept_relation_no_self CHECK (from_concept_id <> to_concept_id)
);

-- 멱등성(R5): 같은 (from,to,type) 재삽입 방지
CREATE UNIQUE INDEX uq_concept_relation_active
  ON handbook.concept_relation (from_concept_id, to_concept_id, relation_type)
  WHERE (revoked_at IS NULL);
CREATE INDEX idx_concept_relation_from ON handbook.concept_relation (from_concept_id) WHERE (revoked_at IS NULL);
CREATE INDEX idx_concept_relation_to   ON handbook.concept_relation (to_concept_id)   WHERE (revoked_at IS NULL);
```

**방향 규약 (중요 — 뒤집히면 화면이 거꾸로 뜬다)**

> **한 문장으로 읽는다: `from` 은 `to` 의 `<relation_type>` 이다.**

| 유형 | 읽는 법 | 예 |
|---|---|---|
| `SUBTOPIC` | from 은 to 의 하위 주제다 | `Chunking → RAG` |
| `PREREQUISITE` | from 은 to 의 선수 조건이다 | `Embeddings → RAG` |
| `EXTENDS` | from 은 to 를 확장한다 | `Reranking → RAG` |
| `CONTRADICTS` | from 은 to 와 상충한다 | — |
| `RELATED` | **대칭** — 방향 의미 없음 | `Finetuning ↔ RAG` |

- GraphDB `A rdfs:subClassOf B` → `from=A, to=B, type=SUBTOPIC`.
- **화면 "RAG 의 Child Concepts" = `to = RAG` 인 행 전부** (유형 불문).
- ⚠️ **`RELATED` 는 대칭이라 한 방향만 저장**하고(정렬상 앞선 개념을 `from`), **조회 시 양방향 검색**한다. 두 행을 넣으면 유니크 인덱스는 통과하지만 화면에 중복 카드가 뜬다.
- ⚠️ `PREREQUISITE`·`EXTENDS` 는 상하 관계가 **아니다.** `SUBTOPIC` 과 같은 방향 규약을 쓰되, **Learning Roadmap SVG 는 유형별로 위/아래를 다르게 배치**한다(선수=위, 확장=아래). 방향 규약과 시각 배치를 혼동하지 말 것.

## 2. 온톨로지 id 보존 (D4)

`handbook.concept.meta_json` (jsonb, **이미 존재** · GIN 인덱스 있음):

```json
{ "ontologyNode": "HybridRetrieval",
  "ontologyIri": "http://example.org/llm-ontology#HybridRetrieval",
  "importedAt": "2026-08-19",
  "importSource": "llm_ontology_augmented.ttl" }
```

조회: `WHERE meta_json->>'ontologyNode' = $1` (GIN 인덱스 활용)

### 2-A. `topic_id` 를 어떻게 채우나 (결함③ 보완)

**규칙: 이관되는 302개는 전부 `topic_id = NULL` 로 넣는다.**

- 이유: **온톨로지 계층과 화면의 Basics/Advanced 는 다른 축**이다. 온톨로지 최상위는 `ModelComponent`·`EvaluationMetric` 같은 기술 분류이지 학습 단계가 아니다(조사문서 §7).
- `topic_id` 는 **Learning 화면이 정식으로 다루는 개념에만** 나중에 부여한다(현재 12개). 이건 Learning 작업 소관이며 본 이관의 범위가 아니다.
- 따라서 이관 직후 "토픽 없는 개념 290개"는 **정상**이다. `handbook.concept.topic_id` 는 nullable 이고 부분 인덱스(`WHERE topic_id IS NOT NULL`)라 성능 문제도 없다.
→ 이 값이 있어야 나중에 GraphDB 전환·동기화 시 **이름이 아니라 id 로** 매칭된다(R2 회피).

## 3. 이관 절차 (4단계 · 각 단계 후 검증)

### 3-1. 추출 (읽기 전용 · GraphDB)
```
node scripts/ontology/export-graphdb.cjs  →  scratchpad/ontology-snapshot.json
```
- `owl:Class` + `rdfs:label` + `llm:description` + `rdfs:subClassOf` (**`infer=false`** — 직속만)
- 산출물을 **파일로 고정**한다. 이후 단계는 이 스냅샷만 본다(GraphDB 재질의 금지 → 재현 가능·감사 가능).

### 3-2. 사전 점검 (쓰기 없음 · dry-run) ⭐ 가장 중요
```
node scripts/ontology/precheck.cjs
```
| 점검 | 실패 시 |
|---|---|
| 라벨 2개 클래스 → canonical 1개 선택, 나머지 alias 후보 (R4) | 목록 보고 후 사람이 canonical 지정 |
| **alias 전역 유니크 충돌** (R2) — 후보 alias 가 다른 개념의 canonical/alias 와 겹치나 | **중단하고 보고**. 임의 해소 금지 |
| `canonical_name` 대소문자 무시 중복 (R3) | 중단·보고 |
| 관계 양끝 개념이 모두 존재하나 | 누락 목록 보고 |
| 사이클 검사 (R9) | 중단·보고 |
- 산출물: **삽입 예정 건수 표 + 충돌 목록**. 이 표를 사용자에게 제시하는 것이 승인 게이트.

### 3-3. 삽입 (🔴 쓰기 · 승인 후)
```
node scripts/ontology/import-postgres.cjs --confirm
```
- **단일 트랜잭션**. 실패 시 전체 롤백.
- **INSERT 만.** 기존 행 UPDATE/DELETE 없음.
- 모든 삽입에 `ON CONFLICT DO NOTHING` (재실행 안전 · R5).
- 순서: `concept` → `concept_alias` → `concept_relation` (FK 순서).
- **`id` 를 명시적으로 생성해 넣는다** — 기존 handbook 테이블은 id 기본값이 없다(결함①).
- `topic_id` 는 전부 `NULL`(§2-A).
- `topic` 은 별도(Basics/Advanced 2행) — Learning 쪽 작업.

### 3-4. 검증
```
node scripts/ontology/verify.cjs
```
- 건수 대조: 스냅샷 302/301 ↔ DB 삽입 건수
- **라운드트립**: DB 에서 다시 읽어 스냅샷과 **완전 일치**하는지(라벨·설명·관계 방향)
- 샘플 육안: `RAG` 의 하위가 GraphDB 질의 결과와 같은지

## 4. 롤백

```sql
-- 이관분만 정확히 지운다 (origin 으로 식별)
UPDATE handbook.concept_relation SET revoked_at = now()
  WHERE origin = 'graphdb-import' AND revoked_at IS NULL;
UPDATE handbook.concept SET revoked_at = now()
  WHERE meta_json->>'importSource' = 'llm_ontology_augmented.ttl' AND revoked_at IS NULL;
```
- **소프트 삭제**(`revoked_at`)를 기본으로 한다. 물리 삭제는 하지 않는다.
- 테이블 자체를 되돌리려면 `DROP TABLE handbook.concept_relation; DROP TYPE handbook.concept_relation_enum;` — 단, 이관 외 데이터가 들어간 뒤에는 금지.

## 5. 관계 공급자 (D2·D3) — 전환 구조

```
apps/api/src/modules/concept/
  concept-relation.provider.ts        인터페이스 (getRelations / getConcept)
  providers/postgres-relation.provider.ts
  providers/graphdb-relation.provider.ts   (기존 graph-concept.service 재사용)
  concept-relation.factory.ts         env 로 구현 선택
```

```ts
export interface ConceptRelationProvider {
  getConcept(key: string): Promise<ConceptNode | null>
  getRelations(key: string): Promise<{ parents: ConceptNode[]; children: ConceptNode[] }>
}
```

| `CONCEPT_RELATION_SOURCE` | 동작 |
|---|---|
| `postgres` (기본) | Postgres 만 사용. GraphDB 불필요 |
| `graphdb` | SPARQL 직접(`infer=false`). GraphDB 도달 가능해야 함 |
| `synced` | 서빙은 Postgres, 별도 잡이 GraphDB→Postgres 동기화 |

- **응답 DTO 는 세 구현이 동일**해야 한다. 화면·API 코드는 소스를 모른다.
- ⚠️ 백엔드 env 다(`NEXT_PUBLIC_*` 아님 — 작업지침 §6).

## 6. 동기화 (`synced` 모드 · 후속)

- 방향: **GraphDB → Postgres 단방향**. 역방향 쓰기는 하지 않는다(충돌 방지).
- 대조 키: `meta_json->>'ontologyNode'` (D4).
- 처리: 신규=INSERT · 변경=UPDATE(설명·라벨) · GraphDB 에서 사라짐=`revoked_at` 설정(R8).
- **사람이 Postgres 에 직접 넣은 관계**(`origin <> 'graphdb-import'`)는 **동기화가 건드리지 않는다.**
- 실행 시점: 수동 명령 우선. 자동 스케줄은 나중에.

## 7. 전환 안전 장치 — 소스 대조

```
node scripts/ontology/relation-source-diff.cjs
```
```
RAG          postgres 9 · graphdb 6 · 불일치 3 (Reranking, Contextual Retrieval, GraphRAG 미등록)
Embeddings   postgres 9 · graphdb 9 · 불일치 0 ✅
```
- **불일치 0 이 되기 전에는 `graphdb` 모드로 전환하지 않는다.**
- 관계 유형 손실(R7)도 여기서 드러난다 — GraphDB 쪽이 전부 SUBTOPIC 으로 보이면 아직 전환 불가.

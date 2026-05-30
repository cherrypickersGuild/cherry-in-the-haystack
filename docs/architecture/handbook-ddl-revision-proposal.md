# handbook 스키마 DDL 수정 기획안

> **작성일:** 2026-04-30
> **목적:** `content` 스키마의 엄격한 정합성 패턴을 `handbook`에 이식하여, 운영 안전성과 데이터 신뢰성 확보
> **대상 독자:** 백엔드 / DBA / AI 데이터 파이프라인 담당자

---

## 0. 요약

`handbook` 스키마는 책에서 추출한 evidence를 저장하는 영역으로, writer_agent의 글 작성에 사용된다. 그러나 현행 DDL은 다음 면에서 `content` 스키마 대비 부족하다:

- 부모-자식 삭제 정책이 `CASCADE` / `SET NULL`로 위험
- soft delete 패턴 부재 (영구 삭제만 가능)
- UNIQUE 제약 부족 → 중복/고아 데이터 위험
- 범위 / 타입 CHECK 부족
- 자동 `updated_at` 트리거 일부 누락

본 문서는 `content` 패턴을 기준으로 한 수정안을 제시한다. 마이그레이션 SQL은 §6에 정리.

---

## 1. content 스키마의 모범 패턴

수정안의 기준이 되는 `content`의 8가지 원칙:

| # | 원칙 | 예시 |
|---|---|---|
| 1 | 모든 FK는 `ON DELETE RESTRICT` | `content.article_raw → content.source` |
| 2 | soft delete는 `revoked_at TIMESTAMPTZ NULL` | 거의 모든 테이블 |
| 3 | UNIQUE는 `revoked_at IS NULL` partial index로 | `uq_source_url_handle_hash_active` |
| 4 | JSONB 컬럼엔 `jsonb_typeof` CHECK | `meta_json IS NULL OR jsonb_typeof = 'object'` |
| 5 | 도메인 값엔 범위 CHECK | `impact_score BETWEEN 0 AND 100` |
| 6 | 자동 `updated_at` 트리거 | `trg_*_set_updated_at` |
| 7 | 무결성 트리거로 cross-column 검증 | `validate_user_article_ai_state_representative_name` |
| 8 | Multi-tenant는 composite FK로 격리 | `(user_id, id)` 합성 |

---

## 2. handbook 현황 진단

### 2.1 심각도별 이슈

#### 🔴 중대

| ID | 위치 | 문제 | 영향 |
|---|---|---|---|
| H-01 | `paragraph_chunk.book_id` `ON DELETE SET NULL` | 책 삭제 시 본문이 출처 잃음 | writer_agent가 인용 출처 채우기 실패 |
| H-02 | `chapter`, `section`, `paragraph_concept_link`, `paragraph_embedding` `ON DELETE CASCADE` | 부모 1행 삭제 시 자식 수천 행 폭발 삭제 | 실수 한 번에 데이터 대량 손실 |
| H-03 | `idea_group.canonical_idea_text` UNIQUE 부재 | 같은 의미 그룹이 여러 행 생성 가능 | 정규화 본질 깨짐, 검색 결과 부풀음 |
| H-04 | `evidence_metadata.paragraph_chunk_id` UNIQUE 부재 | 한 문단에 metadata 여러 행 가능 | LEFT JOIN 시 결과 중복 부풀음 |

#### 🟡 중간

| ID | 위치 | 문제 |
|---|---|---|
| H-05 | `paragraph_hash` UNIQUE 부재 | DB 차원 dedup 안 됨 — 백엔드 quality gate에 의존 |
| H-06 | `paragraph_embedding`에 `(paragraph_chunk_id, model)` UNIQUE 부재 | 같은 문단 같은 모델 중복 임베딩 가능 |
| H-07 | `key_idea`의 모든 FK가 nullable + `SET NULL` | 부모 다 삭제되면 고아 텍스트 발생 |
| H-08 | `evidence_metadata`에 `created_at`/`updated_at` 부재 | 점수 갱신 이력 추적 불가 |
| H-09 | handbook 전체에 soft delete (`revoked_at`) 패턴 부재 | 책 회수, evidence 회수 등 처리 불가 — 하드 삭제만 |

#### 🟢 사소

| ID | 위치 | 문제 |
|---|---|---|
| H-10 | `paragraph_chunk.body_text` 길이 무제한 | 운영 사고 시 단일 행 100MB 가능 |
| H-11 | `processing_progress.status` CHECK 누락 | 자유 문자열 허용 (반면 `book.processing_status`엔 CHECK 있음) |
| H-12 | `paragraph_concept_link.extraction_confidence` 범위 X | 0~1 의도 불명, 100도 통과 |
| H-13 | `evidence_metadata.judge_*` 범위 X | 0~1 의도 불명 |
| H-14 | `evidence_metadata.keywords/entities` JSONB type CHECK 부재 | object/array 강제 안 됨 |
| H-15 | `paragraph_chunk.paragraph_index` 의미 코멘트 부재 | 책 전체 vs 챕터 내 인덱스 모호 |

---

## 3. 수정안 — 테이블별

### 3.1 `handbook.book`

**변경 사항**:
- `revoked_at` 추가 (soft delete)
- 자식 테이블 FK 모두 `ON DELETE RESTRICT`로 (자동 cascade 차단)

```sql
ALTER TABLE handbook.book
    ADD COLUMN revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_book_revoked_at ON handbook.book (revoked_at);

CREATE TRIGGER trg_book_set_updated_at
    BEFORE UPDATE ON handbook.book
    FOR EACH ROW
    EXECUTE FUNCTION core.set_updated_at();
```

### 3.2 `handbook.chapter` / `handbook.section`

**변경**:
- FK ON DELETE → `RESTRICT`
- `revoked_at` 추가

```sql
ALTER TABLE handbook.chapter
    DROP CONSTRAINT fk_chapter_book,
    ADD CONSTRAINT fk_chapter_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    ADD COLUMN revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE handbook.section
    DROP CONSTRAINT fk_section_book,
    ADD CONSTRAINT fk_section_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_section_chapter,
    ADD CONSTRAINT fk_section_chapter
        FOREIGN KEY (chapter_id) REFERENCES handbook.chapter(id)
        ON DELETE RESTRICT,
    ADD COLUMN revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER trg_chapter_set_updated_at BEFORE UPDATE ON handbook.chapter
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_section_set_updated_at BEFORE UPDATE ON handbook.section
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.3 `handbook.paragraph_chunk` ⭐ 핵심

**변경**:
- `book_id` → `NOT NULL` + `RESTRICT` (출처 보존 강제)
- `chapter_id`, `section_id`도 `RESTRICT` (단, NULL 허용 유지 — 챕터/섹션 미배정 가능)
- `paragraph_hash`에 partial UNIQUE
- `body_text` 길이 제한
- `revoked_at`, `updated_at` 추가

```sql
ALTER TABLE handbook.paragraph_chunk
    -- book은 필수 + RESTRICT
    ALTER COLUMN book_id SET NOT NULL,
    DROP CONSTRAINT fk_paragraph_chunk_book,
    ADD CONSTRAINT fk_paragraph_chunk_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    -- chapter, section은 nullable 유지 + RESTRICT
    DROP CONSTRAINT fk_paragraph_chunk_chapter,
    ADD CONSTRAINT fk_paragraph_chunk_chapter
        FOREIGN KEY (chapter_id) REFERENCES handbook.chapter(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_paragraph_chunk_section,
    ADD CONSTRAINT fk_paragraph_chunk_section
        FOREIGN KEY (section_id) REFERENCES handbook.section(id)
        ON DELETE RESTRICT,
    -- 본문 길이 제한
    ADD CONSTRAINT chk_paragraph_chunk_body_text_len
        CHECK (char_length(body_text) <= 50000),
    -- soft delete
    ADD COLUMN revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- paragraph_hash UNIQUE (NULL 허용, 같은 hash 차단)
CREATE UNIQUE INDEX uq_paragraph_chunk_hash_active
    ON handbook.paragraph_chunk (paragraph_hash)
    WHERE (paragraph_hash IS NOT NULL AND revoked_at IS NULL);

CREATE TRIGGER trg_paragraph_chunk_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_chunk
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.4 `handbook.idea_group`

**변경**:
- `canonical_idea_text` UNIQUE (정규화 본질)
- `updated_at` 추가

```sql
ALTER TABLE handbook.idea_group
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX uq_idea_group_canonical_idea_text_ci
    ON handbook.idea_group (lower(canonical_idea_text));

CREATE TRIGGER trg_idea_group_set_updated_at
    BEFORE UPDATE ON handbook.idea_group
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.5 `handbook.paragraph_concept_link`

**변경**:
- FK `ON DELETE RESTRICT` (paragraph_chunk 삭제 시 link 자동 삭제 차단)
- `extraction_confidence` 범위 CHECK
- `updated_at` 추가

```sql
ALTER TABLE handbook.paragraph_concept_link
    DROP CONSTRAINT fk_paragraph_concept_link_paragraph_chunk,
    ADD CONSTRAINT fk_paragraph_concept_link_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON DELETE RESTRICT,
    -- idea_group은 이미 RESTRICT라 그대로
    ADD CONSTRAINT chk_paragraph_concept_link_confidence
        CHECK (extraction_confidence IS NULL OR (extraction_confidence BETWEEN 0 AND 1)),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER trg_paragraph_concept_link_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_concept_link
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.6 `handbook.key_idea`

**변경**:
- `paragraph_chunk_id` 또는 `book_id` 중 하나는 NOT NULL 강제 (고아 차단)
- 모든 FK `RESTRICT`
- `updated_at` 추가

```sql
ALTER TABLE handbook.key_idea
    DROP CONSTRAINT fk_key_idea_paragraph_chunk,
    ADD CONSTRAINT fk_key_idea_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_key_idea_book,
    ADD CONSTRAINT fk_key_idea_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_key_idea_idea_group,
    ADD CONSTRAINT fk_key_idea_idea_group
        FOREIGN KEY (idea_group_id) REFERENCES handbook.idea_group(id)
        ON DELETE RESTRICT,
    -- 적어도 하나의 부모는 있어야 함
    ADD CONSTRAINT chk_key_idea_parent_required
        CHECK (paragraph_chunk_id IS NOT NULL OR book_id IS NOT NULL),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER trg_key_idea_set_updated_at
    BEFORE UPDATE ON handbook.key_idea
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.7 `handbook.evidence_metadata` ⭐ 핵심

**변경**:
- `paragraph_chunk_id` → `NOT NULL` + `RESTRICT`
- `paragraph_chunk_id`에 UNIQUE (한 문단 = 1 metadata)
- 모든 score 컬럼에 범위 CHECK
- JSONB type CHECK
- `created_at`, `updated_at` 추가

```sql
ALTER TABLE handbook.evidence_metadata
    ALTER COLUMN paragraph_chunk_id SET NOT NULL,
    DROP CONSTRAINT fk_evidence_metadata_paragraph_chunk,
    ADD CONSTRAINT fk_evidence_metadata_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON DELETE RESTRICT,
    -- 점수 범위
    ADD CONSTRAINT chk_evidence_metadata_judge_originality
        CHECK (judge_originality IS NULL OR (judge_originality BETWEEN 0 AND 1)),
    ADD CONSTRAINT chk_evidence_metadata_judge_depth
        CHECK (judge_depth IS NULL OR (judge_depth BETWEEN 0 AND 1)),
    ADD CONSTRAINT chk_evidence_metadata_judge_technical_accuracy
        CHECK (judge_technical_accuracy IS NULL OR (judge_technical_accuracy BETWEEN 0 AND 1)),
    -- JSONB 타입
    ADD CONSTRAINT chk_evidence_metadata_keywords_is_array
        CHECK (keywords IS NULL OR jsonb_typeof(keywords) = 'array'),
    ADD CONSTRAINT chk_evidence_metadata_entities_is_array
        CHECK (entities IS NULL OR jsonb_typeof(entities) = 'array'),
    -- 시간 컬럼
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 한 문단 = 1 metadata (writer_agent JOIN 안정성)
CREATE UNIQUE INDEX uq_evidence_metadata_paragraph_chunk
    ON handbook.evidence_metadata (paragraph_chunk_id);

CREATE TRIGGER trg_evidence_metadata_set_updated_at
    BEFORE UPDATE ON handbook.evidence_metadata
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.8 `handbook.paragraph_embedding`

**변경**:
- `paragraph_chunk_id` → `NOT NULL` + `RESTRICT`
- `(paragraph_chunk_id, model)` UNIQUE (모델별 1행)
- `updated_at` 추가

```sql
ALTER TABLE handbook.paragraph_embedding
    ALTER COLUMN paragraph_chunk_id SET NOT NULL,
    DROP CONSTRAINT fk_paragraph_embedding_paragraph_chunk,
    ADD CONSTRAINT fk_paragraph_embedding_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_paragraph_embedding_book,
    ADD CONSTRAINT fk_paragraph_embedding_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- (chunk, model) 조합 UNIQUE
CREATE UNIQUE INDEX uq_paragraph_embedding_chunk_model
    ON handbook.paragraph_embedding (paragraph_chunk_id, model);

CREATE TRIGGER trg_paragraph_embedding_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_embedding
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 3.9 `handbook.processing_progress`

**변경**:
- `status`에 CHECK 추가 (book.processing_status와 일관)
- FK `RESTRICT`

```sql
ALTER TABLE handbook.processing_progress
    DROP CONSTRAINT fk_processing_progress_book,
    ADD CONSTRAINT fk_processing_progress_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON DELETE RESTRICT,
    DROP CONSTRAINT fk_processing_progress_chapter,
    ADD CONSTRAINT fk_processing_progress_chapter
        FOREIGN KEY (chapter_id) REFERENCES handbook.chapter(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT chk_processing_progress_status
        CHECK (status IS NULL OR status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));
```

---

## 4. 영향 분석

### 4.1 마이그레이션 시 데이터 정리 필요

| 작업 | 사전 정리 |
|---|---|
| `paragraph_chunk.book_id NOT NULL` | `book_id IS NULL`인 행 → 삭제 또는 dummy book 매핑 |
| `idea_group.canonical_idea_text UNIQUE` | 중복 행 발견 시 → 하나로 통합, link 재매핑 |
| `evidence_metadata.paragraph_chunk_id UNIQUE` | 중복 행 → 가장 최근만 남기고 삭제 |
| `paragraph_chunk.paragraph_hash UNIQUE` | 중복 hash → 하나만 남기고 dedup |
| `evidence_metadata.paragraph_chunk_id NOT NULL` | NULL 행 → 좀비, 삭제 |

### 4.2 운영 흐름 변경 (중요)

**책 1권 삭제할 때**:

before (CASCADE):
```sql
DELETE FROM handbook.book WHERE id = 5;
-- 자식 다 같이 사라짐
```

after (RESTRICT):
```sql
-- 명시적 순서로 삭제
DELETE FROM handbook.paragraph_embedding
    WHERE paragraph_chunk_id IN (SELECT id FROM handbook.paragraph_chunk WHERE book_id = 5);
DELETE FROM handbook.evidence_metadata
    WHERE paragraph_chunk_id IN (SELECT id FROM handbook.paragraph_chunk WHERE book_id = 5);
DELETE FROM handbook.paragraph_concept_link
    WHERE paragraph_chunk_id IN (SELECT id FROM handbook.paragraph_chunk WHERE book_id = 5);
DELETE FROM handbook.key_idea WHERE book_id = 5;
DELETE FROM handbook.paragraph_chunk WHERE book_id = 5;
DELETE FROM handbook.section WHERE book_id = 5;
DELETE FROM handbook.chapter WHERE book_id = 5;
DELETE FROM handbook.book WHERE id = 5;
```

→ 또는 §5의 헬퍼 함수 사용.

### 4.3 백엔드 코드 영향

| 영향 | 변경 |
|---|---|
| writer_agent용 SQL의 `LEFT JOIN evidence_metadata` 결과가 더 이상 부풀지 않음 | `DISTINCT ON` 등 회피 코드 제거 가능 |
| `paragraph_hash` 중복 dedup이 DB 차원 보장 | quality gate에서 dedup 로직 제거 가능 (안전망으로 유지 권장) |
| soft delete (`revoked_at`) 활용 가능 | "회수된 책" 등 비즈니스 로직 추가 |

---

## 5. 마이그레이션 헬퍼 함수

```sql
CREATE OR REPLACE FUNCTION handbook.delete_book_cascade(p_book_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM handbook.paragraph_embedding
    WHERE paragraph_chunk_id IN (
        SELECT id FROM handbook.paragraph_chunk WHERE book_id = p_book_id
    );

    DELETE FROM handbook.evidence_metadata
    WHERE paragraph_chunk_id IN (
        SELECT id FROM handbook.paragraph_chunk WHERE book_id = p_book_id
    );

    DELETE FROM handbook.paragraph_concept_link
    WHERE paragraph_chunk_id IN (
        SELECT id FROM handbook.paragraph_chunk WHERE book_id = p_book_id
    );

    DELETE FROM handbook.key_idea WHERE book_id = p_book_id;
    DELETE FROM handbook.paragraph_chunk WHERE book_id = p_book_id;
    DELETE FROM handbook.section WHERE book_id = p_book_id;
    DELETE FROM handbook.chapter WHERE book_id = p_book_id;
    DELETE FROM handbook.processing_progress WHERE book_id = p_book_id;
    DELETE FROM handbook.book WHERE id = p_book_id;
END;
$$;

-- 사용 예
-- SELECT handbook.delete_book_cascade(5);
```

---

## 6. 마이그레이션 SQL 통합본

### Phase 1: 데이터 정리 (선행)

```sql
BEGIN;

-- 1) 중복 idea_group 통합
WITH duplicates AS (
    SELECT lower(canonical_idea_text) AS norm,
           array_agg(id ORDER BY id) AS ids
    FROM handbook.idea_group
    GROUP BY lower(canonical_idea_text)
    HAVING COUNT(*) > 1
),
keep_id AS (
    SELECT norm, ids[1] AS keep_id, ids[2:] AS drop_ids FROM duplicates
)
UPDATE handbook.paragraph_concept_link pcl
SET idea_group_id = ki.keep_id
FROM keep_id ki
WHERE pcl.idea_group_id = ANY(ki.drop_ids);

DELETE FROM handbook.idea_group ig
USING (
    SELECT unnest(ids[2:]) AS drop_id
    FROM (
        SELECT array_agg(id ORDER BY id) AS ids
        FROM handbook.idea_group
        GROUP BY lower(canonical_idea_text)
        HAVING COUNT(*) > 1
    ) d
) dups
WHERE ig.id = dups.drop_id;

-- 2) book_id NULL인 paragraph_chunk 정리
DELETE FROM handbook.paragraph_chunk WHERE book_id IS NULL;

-- 3) evidence_metadata 중복 정리 (최신만 유지)
DELETE FROM handbook.evidence_metadata em
USING (
    SELECT paragraph_chunk_id, MAX(id) AS keep_id
    FROM handbook.evidence_metadata
    WHERE paragraph_chunk_id IS NOT NULL
    GROUP BY paragraph_chunk_id
    HAVING COUNT(*) > 1
) keep
WHERE em.paragraph_chunk_id = keep.paragraph_chunk_id
  AND em.id != keep.keep_id;

DELETE FROM handbook.evidence_metadata WHERE paragraph_chunk_id IS NULL;

-- 4) paragraph_chunk 중복 hash 정리
DELETE FROM handbook.paragraph_chunk pc
USING (
    SELECT paragraph_hash, MIN(id) AS keep_id
    FROM handbook.paragraph_chunk
    WHERE paragraph_hash IS NOT NULL
    GROUP BY paragraph_hash
    HAVING COUNT(*) > 1
) keep
WHERE pc.paragraph_hash = keep.paragraph_hash
  AND pc.id != keep.keep_id;

COMMIT;
```

### Phase 2: 스키마 변경

```sql
BEGIN;

-- §3.1 ~ §3.9 의 ALTER 문들 모두 적용
-- (위에 분리된 ALTER 문을 순서대로 실행)

-- §5의 헬퍼 함수 생성

COMMIT;
```

---

## 7. 우선순위 및 일정

### Phase A — 즉시 (블로커 해결)
- H-01, H-02: FK ON DELETE RESTRICT 일괄 적용
- H-03: idea_group UNIQUE
- H-04: evidence_metadata UNIQUE

### Phase B — 1주 내
- H-05, H-06: paragraph_hash, embedding UNIQUE
- H-07: key_idea 부모 강제
- H-08: evidence_metadata 시간 컬럼

### Phase C — 점진 개선
- H-09: revoked_at 전반 적용 (운영 정책 협의 후)
- H-10 ~ H-15: 사소한 개선

---

## 8. 회의 시 결정 필요 사항

1. **soft delete 적용 범위** — handbook 전체에 `revoked_at` 도입 여부. 책/문단을 "회수"하는 비즈니스 시나리오가 있는가?
2. **`book_id NOT NULL` 마이그레이션** — 현재 NULL 행이 있다면 dummy book에 매핑할 것인가, 삭제할 것인가?
3. **`evidence_metadata` 1:1 강제** — 한 문단에 metadata 행 여러 개를 의도한 케이스가 있는가? (재처리 이력 보존 목적 등)
4. **`paragraph_embedding` 다중 모델** — `(chunk, model)` UNIQUE가 의도와 맞는가? 한 모델에 여러 임베딩 (예: 다른 chunk size)이 필요한가?
5. **delete_book_cascade 헬퍼** — 운영자가 직접 호출 vs 백엔드 API로만 노출?

---

## 9. 참고

- 기준 패턴: `docs/architecture/ddl-v1.1.sql` 의 `content` 스키마
- 진단 근거: writer_agent payload doc (handbook evidence_rows 50개 패딩 시 LEFT JOIN 안정성 필요)
- 영향 범위: 책 처리 파이프라인, writer_agent SQL, 기타 handbook을 읽는 모든 코드

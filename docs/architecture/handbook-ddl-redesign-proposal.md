# handbook 스키마 전면 재설계 제안

> **작성일:** 2026-04-30
> **목적:** content 스키마 수준의 정합성/일관성/확장성을 handbook에 적용하기 위한 전면 재설계 안
> **대상:** 백엔드 / DBA / AI 데이터 파이프라인 / PM
> **선행 문서:** [handbook-ddl-revision-proposal.md](./handbook-ddl-revision-proposal.md) (수정안) — 본 문서는 그보다 한 단계 위의 **재설계** 제안

---

## 0. 요약

`handbook` 스키마는 책에서 추출한 evidence를 저장하는 영역으로, writer_agent의 글 작성 재료로 사용된다. 단순 FK/CHECK 수정(=수정안)으로는 해결되지 않는 **본질적 설계 결함**이 있다:

1. **검색 키 이중화** — `idea_group` vs `extracted_concept` 중복
2. **카테고리 자유 텍스트** — `handbook_topic` 등이 마스터 없이 자유 입력
3. **점수 분산** — `paragraph_chunk` + `evidence_metadata` 두 곳에 흩어짐
4. **denormalize 남용** — `paragraph_embedding`이 본문/토픽 중복 저장
5. **고립 테이블** — `key_idea`, `knowledge_verification_contributor` 활용처 불명
6. **ID 불일치** — handbook만 BIGSERIAL, 나머지는 UUID v7
7. **type safety 부족** — 거의 모든 카테고리성 컬럼이 자유 텍스트

본 문서는 content 스키마의 8가지 패턴을 적용하여 재설계한다.

---

## 1. content 스키마의 모범 패턴 (재설계 기준)

| # | 원칙 | content 적용 예 |
|---|---|---|
| 1 | 모든 FK는 `ON DELETE RESTRICT` | `article_raw → source` |
| 2 | soft delete: `revoked_at TIMESTAMPTZ NULL` | 거의 모든 테이블 |
| 3 | UNIQUE는 `WHERE revoked_at IS NULL` partial index | `uq_source_url_handle_hash_active` |
| 4 | JSONB 컬럼은 `jsonb_typeof` CHECK | `meta_json` 모든 컬럼 |
| 5 | 도메인 값은 범위 CHECK | `impact_score BETWEEN 0 AND 100` |
| 6 | 자동 `updated_at` 트리거 | `trg_*_set_updated_at` |
| 7 | cross-column 정합성 트리거 | `validate_user_article_ai_state_representative_name` |
| 8 | composite FK로 부모 종속 격리 | `(user_id, id)` 합성 |

---

## 2. 본질적 문제 진단

### 2.1 검색 키 이중화 — `idea_group` vs `extracted_concept`

```sql
paragraph_concept_link
├── idea_group_id
├── extracted_concept VARCHAR(200)   ← idea_group의 정규화 무력화
```

- `idea_group.canonical_idea_text` = 정규화된 이름
- `paragraph_concept_link.extracted_concept` = 같은 idea_group 안에서도 다양한 표면 표현 가능
- 검색이 `extracted_concept`으로 일어나면 정규화 의미 없음
- doc Section 8 SQL은 `extracted_concept`만 매칭 → idea_group 사실상 dead

**해결**: 검색 키를 `concept_id` 단일화 + 변형 매칭은 `concept_alias` 테이블로

### 2.2 카테고리 자유 텍스트

```sql
book.handbook_section          VARCHAR(50)   -- enum 없음
evidence_metadata.handbook_topic     VARCHAR(100)  -- 마스터 X
evidence_metadata.handbook_subtopic  VARCHAR(100)  -- 마스터 X
evidence_metadata.extract_type       VARCHAR(50)   -- enum 없음
processing_progress.processing_unit  VARCHAR(50)   -- enum 없음
processing_progress.status           VARCHAR(50)   -- CHECK 없음
```

- "Retrieval", "retrieval", " Retrieval " 다 다른 값으로 들어옴
- content는 `entity_page_enum` + `entity_category` 마스터로 도메인 무결성 확보

**해결**: ENUM + 마스터 테이블 (topic / subtopic) 도입

### 2.3 점수 분산

```sql
paragraph_chunk
├── importance_score
├── sampling_weight
├── is_representative

evidence_metadata
├── judge_originality
├── judge_depth
├── judge_technical_accuracy
```

- 같은 "AI가 매긴 점수"가 두 테이블에 흩어짐
- 분리 기준 불명 — 새 점수 추가 시 어디 둘지 결정 어려움
- writer_agent가 항상 두 테이블 JOIN

**해결**: 모든 점수를 `paragraph_chunk`로 통합. `evidence_metadata` 폐기

### 2.4 denormalize 중복

```sql
paragraph_embedding
├── paragraph_chunk_id
├── body_text TEXT          ← paragraph_chunk.body_text와 중복
├── handbook_topic VARCHAR  ← evidence_metadata.handbook_topic과 중복
├── book_id                 ← paragraph_chunk.book_id와 중복
```

- 동기화 깨질 위험 (한 곳 update 시 stale)
- 디스크 낭비
- 신뢰 가능한 단일 소스(SSoT) 부재

**해결**: 중복 컬럼 제거. 필요 시 JOIN

### 2.5 고립/책임 불명 테이블

| 테이블 | 문제 |
|---|---|
| `key_idea` | 모든 FK nullable, 활용처 명세 없음, summary와 evidence_metadata와 책임 중복 |
| `knowledge_verification_contributor` | 다른 테이블과 FK 연결 X, 인간 검증자 추적인데 어떻게 사용하는지 불명 |

**해결**: 사용처 확인 후 폐기 또는 재정의

### 2.6 ID 타입 불일치

| 스키마 | ID |
|---|---|
| core, content, personal, snapshot, publishing, kaas | UUID v7 (앱 생성) |
| **handbook** | BIGSERIAL (DB 시퀀스) |

- 분산 환경 부적합
- 외부 노출 시 ID 추측 가능
- 다른 스키마와 cross-reference 시 타입 변환 필요

**해결**: UUID v7로 마이그레이션

---

## 3. 재설계 ENUM 타입 정의

```sql
-- 책 출처 타입
CREATE TYPE handbook.book_source_type_enum AS ENUM (
    'PDF', 'EPUB', 'HTML', 'MARKDOWN', 'WEB_URL', 'CUSTOM'
);

-- 책 처리 상태
CREATE TYPE handbook.book_processing_status_enum AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
);

-- 책 분류 (현재 handbook_section 대체)
CREATE TYPE handbook.section_kind_enum AS ENUM (
    'CORE', 'APPENDIX', 'TUTORIAL', 'REFERENCE', 'GLOSSARY'
);

-- 처리 진행 단위
CREATE TYPE handbook.processing_unit_enum AS ENUM (
    'BOOK', 'CHAPTER', 'SECTION', 'PAGE', 'PARAGRAPH'
);

-- 처리 진행 상태
CREATE TYPE handbook.processing_status_enum AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'
);

-- evidence 추출 타입 (현재 extract_type VARCHAR 대체)
CREATE TYPE handbook.extract_type_enum AS ENUM (
    'DEFINITION', 'EXAMPLE', 'CASE_STUDY', 'METRIC', 'PROCEDURE',
    'PRINCIPLE', 'COMPARISON', 'WARNING', 'OTHER'
);

-- alias 종류
CREATE TYPE handbook.concept_alias_type_enum AS ENUM (
    'VARIANT', 'ABBREVIATION', 'TRANSLATION', 'MISSPELLING', 'SYNONYM'
);
```

---

## 4. 재설계 테이블 스펙

### 4.1 카테고리 마스터 (신규)

#### `handbook.topic`

```sql
CREATE TABLE handbook.topic (
    id          UUID         NOT NULL,
    code        VARCHAR(80)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ  NULL,

    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uq_topic_code_active
    ON handbook.topic (code) WHERE (revoked_at IS NULL);
CREATE UNIQUE INDEX uq_topic_name_ci_active
    ON handbook.topic (lower(name)) WHERE (revoked_at IS NULL);
CREATE INDEX idx_topic_sort ON handbook.topic (sort_order);

CREATE TRIGGER trg_topic_set_updated_at
    BEFORE UPDATE ON handbook.topic
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

#### `handbook.subtopic`

```sql
CREATE TABLE handbook.subtopic (
    id          UUID         NOT NULL,
    topic_id    UUID         NOT NULL,
    code        VARCHAR(80)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),
    -- composite UNIQUE (subtopic은 topic 내부에서만 의미)
    CONSTRAINT uq_subtopic_id_topic UNIQUE (id, topic_id),

    CONSTRAINT fk_subtopic_topic
        FOREIGN KEY (topic_id) REFERENCES handbook.topic(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_subtopic_topic_code_active
    ON handbook.subtopic (topic_id, code) WHERE (revoked_at IS NULL);
CREATE UNIQUE INDEX uq_subtopic_topic_name_ci_active
    ON handbook.subtopic (topic_id, lower(name)) WHERE (revoked_at IS NULL);

CREATE TRIGGER trg_subtopic_set_updated_at
    BEFORE UPDATE ON handbook.subtopic
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 4.2 개념 정규화 (신규)

#### `handbook.concept` (기존 `idea_group` 대체)

```sql
CREATE TABLE handbook.concept (
    id             UUID         NOT NULL,
    canonical_name VARCHAR(200) NOT NULL,
    description    VARCHAR(1000) NULL,
    topic_id       UUID         NULL,
    subtopic_id    UUID         NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    meta_json      JSONB        NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at     TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_concept_topic
        FOREIGN KEY (topic_id) REFERENCES handbook.topic(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    -- subtopic은 topic 내부만 — composite FK
    CONSTRAINT fk_concept_subtopic_topic
        FOREIGN KEY (subtopic_id, topic_id)
        REFERENCES handbook.subtopic(id, topic_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_concept_meta_json_is_object
        CHECK (meta_json IS NULL OR jsonb_typeof(meta_json) = 'object')
);

-- 정규화 본질 — 같은 canonical name 1개만
CREATE UNIQUE INDEX uq_concept_canonical_name_ci_active
    ON handbook.concept (lower(canonical_name)) WHERE (revoked_at IS NULL);

CREATE INDEX idx_concept_topic ON handbook.concept (topic_id) WHERE (topic_id IS NOT NULL);
CREATE INDEX idx_concept_subtopic ON handbook.concept (subtopic_id) WHERE (subtopic_id IS NOT NULL);
CREATE INDEX idx_concept_active ON handbook.concept (is_active) WHERE (is_active = TRUE);
CREATE INDEX idx_concept_meta_json ON handbook.concept USING GIN (meta_json);

CREATE TRIGGER trg_concept_set_updated_at
    BEFORE UPDATE ON handbook.concept
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

#### `handbook.concept_alias` (신규 — fuzzy 검색)

```sql
CREATE TABLE handbook.concept_alias (
    id          UUID         NOT NULL,
    concept_id  UUID         NOT NULL,
    alias_text  VARCHAR(200) NOT NULL,
    alias_type  handbook.concept_alias_type_enum NOT NULL DEFAULT 'VARIANT',
    locale      VARCHAR(10)  NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_concept_alias_concept
        FOREIGN KEY (concept_id) REFERENCES handbook.concept(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_concept_alias_text_ci_active
    ON handbook.concept_alias (lower(alias_text)) WHERE (revoked_at IS NULL);
CREATE INDEX idx_concept_alias_concept ON handbook.concept_alias (concept_id);
CREATE INDEX idx_concept_alias_locale ON handbook.concept_alias (locale)
    WHERE (locale IS NOT NULL);

CREATE TRIGGER trg_concept_alias_set_updated_at
    BEFORE UPDATE ON handbook.concept_alias
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 4.3 책 구조

#### `handbook.book` (재설계)

```sql
CREATE TABLE handbook.book (
    id                       UUID NOT NULL,
    title                    VARCHAR(500) NOT NULL,
    author                   VARCHAR(255) NULL,
    section_kind             handbook.section_kind_enum NOT NULL DEFAULT 'CORE',

    source_type              handbook.book_source_type_enum NOT NULL,
    source_path              VARCHAR(1000) NULL,
    source_url               VARCHAR(1000) NULL,

    processing_status        handbook.book_processing_status_enum NOT NULL DEFAULT 'PENDING',
    total_paragraphs         INTEGER NULL,
    paragraphs_processed     INTEGER NOT NULL DEFAULT 0,
    llm_tokens_used          INTEGER NOT NULL DEFAULT 0,
    llm_cost_cents           NUMERIC(12,4) NOT NULL DEFAULT 0,

    meta_json                JSONB NULL,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at               TIMESTAMPTZ NULL,

    PRIMARY KEY (id),

    -- source_type별 필수 필드 정합성
    CONSTRAINT chk_book_source_consistency
        CHECK (
            (source_type IN ('PDF', 'EPUB', 'HTML', 'MARKDOWN') AND source_path IS NOT NULL)
            OR
            (source_type = 'WEB_URL' AND source_url IS NOT NULL)
            OR
            (source_type = 'CUSTOM')
        ),

    CONSTRAINT chk_book_paragraphs_processed
        CHECK (paragraphs_processed >= 0
               AND (total_paragraphs IS NULL OR paragraphs_processed <= total_paragraphs)),

    CONSTRAINT chk_book_llm_cost_nonneg
        CHECK (llm_cost_cents >= 0 AND llm_tokens_used >= 0),

    CONSTRAINT chk_book_meta_json_is_object
        CHECK (meta_json IS NULL OR jsonb_typeof(meta_json) = 'object')
);

CREATE UNIQUE INDEX uq_book_title_author_active
    ON handbook.book (lower(title), lower(coalesce(author, '')))
    WHERE (revoked_at IS NULL);

CREATE INDEX idx_book_processing_status ON handbook.book (processing_status)
    WHERE (revoked_at IS NULL);
CREATE INDEX idx_book_section_kind ON handbook.book (section_kind)
    WHERE (revoked_at IS NULL);
CREATE INDEX idx_book_revoked_at ON handbook.book (revoked_at);
CREATE INDEX idx_book_meta_json ON handbook.book USING GIN (meta_json);
CREATE INDEX idx_book_search
    ON handbook.book USING GIN (to_tsvector('simple',
        coalesce(title, '') || ' ' || coalesce(author, '')));

CREATE TRIGGER trg_book_set_updated_at
    BEFORE UPDATE ON handbook.book
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

#### `handbook.chapter` (재설계)

```sql
CREATE TABLE handbook.chapter (
    id                UUID NOT NULL,
    book_id           UUID NOT NULL,
    chapter_number    INTEGER NULL,
    title             VARCHAR(500) NULL,
    start_page        INTEGER NULL,
    end_page          INTEGER NULL,
    level             INTEGER NOT NULL DEFAULT 1,
    parent_chapter_id UUID NULL,
    detection_method  VARCHAR(50) NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at        TIMESTAMPTZ NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_chapter_id_book UNIQUE (id, book_id),

    CONSTRAINT fk_chapter_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    -- parent_chapter는 같은 book 내부만
    CONSTRAINT fk_chapter_parent_book
        FOREIGN KEY (parent_chapter_id, book_id)
        REFERENCES handbook.chapter(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_chapter_pages
        CHECK (start_page IS NULL OR end_page IS NULL OR end_page >= start_page),

    CONSTRAINT chk_chapter_level
        CHECK (level >= 1 AND level <= 6)
);

CREATE UNIQUE INDEX uq_chapter_book_number_active
    ON handbook.chapter (book_id, chapter_number)
    WHERE (revoked_at IS NULL AND chapter_number IS NOT NULL);
CREATE INDEX idx_chapter_book ON handbook.chapter (book_id);
CREATE INDEX idx_chapter_revoked_at ON handbook.chapter (revoked_at);

CREATE TRIGGER trg_chapter_set_updated_at
    BEFORE UPDATE ON handbook.chapter
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

#### `handbook.section` (재설계)

```sql
CREATE TABLE handbook.section (
    id                UUID NOT NULL,
    book_id           UUID NOT NULL,
    chapter_id        UUID NOT NULL,
    section_number    INTEGER NULL,
    title             VARCHAR(500) NOT NULL,
    level             INTEGER NOT NULL DEFAULT 1,
    parent_section_id UUID NULL,
    detection_method  VARCHAR(50) NOT NULL DEFAULT 'llm',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at        TIMESTAMPTZ NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_section_id_book UNIQUE (id, book_id),

    CONSTRAINT fk_section_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_section_chapter_book
        FOREIGN KEY (chapter_id, book_id)
        REFERENCES handbook.chapter(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_section_parent_book
        FOREIGN KEY (parent_section_id, book_id)
        REFERENCES handbook.section(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_section_level
        CHECK (level >= 1 AND level <= 6)
);

CREATE INDEX idx_section_book ON handbook.section (book_id);
CREATE INDEX idx_section_chapter ON handbook.section (chapter_id);
CREATE INDEX idx_section_revoked_at ON handbook.section (revoked_at);

CREATE TRIGGER trg_section_set_updated_at
    BEFORE UPDATE ON handbook.section
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 4.4 문단 + 점수 통합

#### `handbook.paragraph_chunk` (점수 통합 — `evidence_metadata` 폐기)

```sql
CREATE TABLE handbook.paragraph_chunk (
    id                       UUID NOT NULL,
    book_id                  UUID NOT NULL,
    chapter_id               UUID NULL,
    section_id               UUID NULL,
    page_number              INTEGER NULL,
    paragraph_index          INTEGER NULL,         -- 책 전체 기준
    chapter_paragraph_index  INTEGER NULL,         -- 챕터 내 기준

    body_text                TEXT NOT NULL,
    paragraph_hash           BYTEA GENERATED ALWAYS AS
                                 (decode(md5(body_text), 'hex')) STORED,
    simhash64                BIGINT NULL,

    -- AI 점수 (모두 0~1로 통일)
    importance_score         NUMERIC(3,2) NULL,
    sampling_weight          NUMERIC(3,2) NULL,
    judge_originality        NUMERIC(3,2) NULL,
    judge_depth              NUMERIC(3,2) NULL,
    judge_technical_accuracy NUMERIC(3,2) NULL,

    -- 분류
    extract_type             handbook.extract_type_enum NULL,
    cluster_id               INTEGER NULL,
    is_representative        BOOLEAN NOT NULL DEFAULT FALSE,

    -- LLM 처리 정보
    llm_tokens_used          INTEGER NULL,
    llm_cost_cents           NUMERIC(12,4) NULL,
    llm_provider             VARCHAR(50) NULL,
    llm_processed_at         TIMESTAMPTZ NULL,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at               TIMESTAMPTZ NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_paragraph_chunk_id_book UNIQUE (id, book_id),

    CONSTRAINT fk_paragraph_chunk_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_paragraph_chunk_chapter_book
        FOREIGN KEY (chapter_id, book_id)
        REFERENCES handbook.chapter(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_paragraph_chunk_section_book
        FOREIGN KEY (section_id, book_id)
        REFERENCES handbook.section(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    -- 본문 길이 제한
    CONSTRAINT chk_paragraph_chunk_body_text_len
        CHECK (char_length(body_text) >= 1 AND char_length(body_text) <= 50000),

    -- 점수 범위 (0~1 통일)
    CONSTRAINT chk_paragraph_chunk_importance
        CHECK (importance_score IS NULL OR (importance_score BETWEEN 0 AND 1)),
    CONSTRAINT chk_paragraph_chunk_sampling
        CHECK (sampling_weight IS NULL OR (sampling_weight BETWEEN 0 AND 1)),
    CONSTRAINT chk_paragraph_chunk_originality
        CHECK (judge_originality IS NULL OR (judge_originality BETWEEN 0 AND 1)),
    CONSTRAINT chk_paragraph_chunk_depth
        CHECK (judge_depth IS NULL OR (judge_depth BETWEEN 0 AND 1)),
    CONSTRAINT chk_paragraph_chunk_accuracy
        CHECK (judge_technical_accuracy IS NULL OR (judge_technical_accuracy BETWEEN 0 AND 1)),

    CONSTRAINT chk_paragraph_chunk_llm_nonneg
        CHECK ((llm_tokens_used IS NULL OR llm_tokens_used >= 0)
            AND (llm_cost_cents IS NULL OR llm_cost_cents >= 0))
);

-- 책 전체 paragraph_index UNIQUE
CREATE UNIQUE INDEX uq_paragraph_chunk_book_index_active
    ON handbook.paragraph_chunk (book_id, paragraph_index)
    WHERE (revoked_at IS NULL AND paragraph_index IS NOT NULL);

-- DB 차원 dedup
CREATE UNIQUE INDEX uq_paragraph_chunk_hash_active
    ON handbook.paragraph_chunk (paragraph_hash)
    WHERE (revoked_at IS NULL);

CREATE INDEX idx_paragraph_chunk_book ON handbook.paragraph_chunk (book_id);
CREATE INDEX idx_paragraph_chunk_chapter ON handbook.paragraph_chunk (chapter_id);
CREATE INDEX idx_paragraph_chunk_section ON handbook.paragraph_chunk (section_id);
CREATE INDEX idx_paragraph_chunk_simhash ON handbook.paragraph_chunk (simhash64);
CREATE INDEX idx_paragraph_chunk_extract_type
    ON handbook.paragraph_chunk (extract_type) WHERE (extract_type IS NOT NULL);
CREATE INDEX idx_paragraph_chunk_search
    ON handbook.paragraph_chunk USING GIN (to_tsvector('english', body_text));
CREATE INDEX idx_paragraph_chunk_revoked_at ON handbook.paragraph_chunk (revoked_at);

CREATE TRIGGER trg_paragraph_chunk_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_chunk
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 4.5 매핑 / 임베딩

#### `handbook.paragraph_concept_link` (단순화)

```sql
CREATE TABLE handbook.paragraph_concept_link (
    id                    UUID         NOT NULL,
    paragraph_chunk_id    UUID         NOT NULL,
    concept_id            UUID         NOT NULL,
    is_primary            BOOLEAN      NOT NULL DEFAULT FALSE,
    extraction_confidence NUMERIC(3,2) NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at            TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_pcl_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_pcl_concept
        FOREIGN KEY (concept_id) REFERENCES handbook.concept(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT uq_pcl_paragraph_concept UNIQUE (paragraph_chunk_id, concept_id),

    CONSTRAINT chk_pcl_confidence
        CHECK (extraction_confidence IS NULL OR (extraction_confidence BETWEEN 0 AND 1))
);

CREATE INDEX idx_pcl_concept ON handbook.paragraph_concept_link (concept_id);
CREATE INDEX idx_pcl_paragraph_chunk ON handbook.paragraph_concept_link (paragraph_chunk_id);
CREATE INDEX idx_pcl_primary
    ON handbook.paragraph_concept_link (paragraph_chunk_id) WHERE (is_primary = TRUE);
CREATE INDEX idx_pcl_revoked_at ON handbook.paragraph_concept_link (revoked_at);

CREATE TRIGGER trg_pcl_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_concept_link
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

→ `extracted_concept` 컬럼 제거. 검색은 `concept_id`로, 변형 매칭은 `concept_alias`로.

#### `handbook.paragraph_embedding` (중복 제거)

```sql
CREATE TABLE handbook.paragraph_embedding (
    id                   UUID         NOT NULL,
    paragraph_chunk_id   UUID         NOT NULL,
    model                VARCHAR(100) NOT NULL,
    embedding            vector(1536) NOT NULL,
    embedding_cost_cents NUMERIC(12,4) NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at           TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_paragraph_embedding_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_paragraph_embedding_cost_nonneg
        CHECK (embedding_cost_cents IS NULL OR embedding_cost_cents >= 0)
);

CREATE UNIQUE INDEX uq_paragraph_embedding_chunk_model_active
    ON handbook.paragraph_embedding (paragraph_chunk_id, model)
    WHERE (revoked_at IS NULL);

CREATE INDEX idx_paragraph_embedding_vector
    ON handbook.paragraph_embedding
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE TRIGGER trg_paragraph_embedding_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_embedding
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

→ `body_text`, `book_id`, `handbook_topic` 중복 컬럼 제거. JOIN으로 가져옴.

### 4.6 운영

#### `handbook.processing_progress` (재설계)

```sql
CREATE TABLE handbook.processing_progress (
    id              UUID NOT NULL,
    book_id         UUID NOT NULL,
    chapter_id      UUID NULL,
    page_number     INTEGER NULL,
    processing_unit handbook.processing_unit_enum NOT NULL,
    status          handbook.processing_status_enum NOT NULL DEFAULT 'PENDING',

    error_message   TEXT NULL,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ NULL,
    completed_at    TIMESTAMPTZ NULL,

    run_log_id      UUID NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_processing_progress_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_processing_progress_chapter_book
        FOREIGN KEY (chapter_id, book_id)
        REFERENCES handbook.chapter(id, book_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_processing_progress_run_log
        FOREIGN KEY (run_log_id) REFERENCES core.run_log(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    -- processing_unit별 필수 컬럼 정합성
    CONSTRAINT chk_processing_progress_unit_consistency
        CHECK (
            processing_unit = 'BOOK'
            OR (processing_unit = 'CHAPTER' AND chapter_id IS NOT NULL)
            OR (processing_unit = 'PAGE' AND page_number IS NOT NULL)
            OR processing_unit IN ('SECTION', 'PARAGRAPH')
        ),

    CONSTRAINT chk_processing_progress_attempt_nonneg
        CHECK (attempt_count >= 0)
);

CREATE INDEX idx_processing_progress_book_status
    ON handbook.processing_progress (book_id, status);
CREATE INDEX idx_processing_progress_failed
    ON handbook.processing_progress (last_attempt_at DESC)
    WHERE (status = 'FAILED');

CREATE TRIGGER trg_processing_progress_set_updated_at
    BEFORE UPDATE ON handbook.processing_progress
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

---

## 5. 폐기 / 통합 / 보류 테이블

| 기존 테이블 | 처리 |
|---|---|
| `handbook.idea_group` | **폐기** → `handbook.concept`로 대체 |
| `handbook.evidence_metadata` | **폐기** → `paragraph_chunk` 컬럼으로 통합 |
| `handbook.key_idea` | **보류 — 결정 필요** (§6.1 참조) |
| `handbook.knowledge_verification_contributor` | **유지 + FK 연결 보강** (§5.2 참조) |

### 5.1 `key_idea` 결정 트리

| 상황 | 처리 |
|---|---|
| 현재 사용 코드 없음 | **폐기** |
| 사용 중이고 paragraph_chunk와 별도 책임 | `handbook.paragraph_summary`로 재설계 (책임 명확화) |
| 사용 중이지만 paragraph_chunk와 1:1 | `paragraph_chunk.summary_text` 컬럼으로 통합 |

`paragraph_summary` 재설계 안 (사용 시):

```sql
CREATE TABLE handbook.paragraph_summary (
    id                  UUID NOT NULL,
    paragraph_chunk_id  UUID NOT NULL,
    summary_text        TEXT NOT NULL,
    summary_type        VARCHAR(20) NOT NULL,   -- 'one_liner', 'tldr', 'abstract'
    llm_provider        VARCHAR(50) NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          TIMESTAMPTZ NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_paragraph_summary_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_paragraph_summary_type
        CHECK (summary_type IN ('one_liner', 'tldr', 'abstract')),

    CONSTRAINT chk_paragraph_summary_text_len
        CHECK (char_length(summary_text) >= 1 AND char_length(summary_text) <= 5000)
);

CREATE UNIQUE INDEX uq_paragraph_summary_chunk_type_active
    ON handbook.paragraph_summary (paragraph_chunk_id, summary_type)
    WHERE (revoked_at IS NULL);

CREATE TRIGGER trg_paragraph_summary_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_summary
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### 5.2 `knowledge_verification_contributor` 재설계

**유지 결정** — 인간 검증자(외부 큐레이터/도메인 전문가)를 추적하는 필수 테이블. 다만 현재는 **다른 테이블과 FK 연결이 없는 고립 상태**라, 검증 행위를 paragraph와 연결하는 보조 테이블이 필요함.

#### `handbook.knowledge_verification_contributor` (재설계)

```sql
CREATE TABLE handbook.knowledge_verification_contributor (
    id                   UUID         NOT NULL,
    name                 VARCHAR(200) NOT NULL,
    email                VARCHAR(255) NULL,
    github_username      VARCHAR(100) NULL,
    affiliation          VARCHAR(200) NULL,        -- 소속 (학교/회사/단체)
    expertise_area       VARCHAR(500) NULL,        -- 전문 분야

    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    contributions_count  INTEGER      NOT NULL DEFAULT 0,
    joined_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_contribution_at TIMESTAMPTZ  NULL,

    -- core.app_user와 연결 가능 (서비스 가입한 검증자의 경우)
    app_user_id          UUID NULL,

    meta_json            JSONB        NULL,

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at           TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_kvc_app_user
        FOREIGN KEY (app_user_id) REFERENCES core.app_user(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_kvc_contributions_nonneg
        CHECK (contributions_count >= 0),

    CONSTRAINT chk_kvc_meta_json_is_object
        CHECK (meta_json IS NULL OR jsonb_typeof(meta_json) = 'object')
);

CREATE UNIQUE INDEX uq_kvc_name_ci_active
    ON handbook.knowledge_verification_contributor (lower(name))
    WHERE (revoked_at IS NULL);
CREATE UNIQUE INDEX uq_kvc_email_ci_active
    ON handbook.knowledge_verification_contributor (lower(email))
    WHERE (revoked_at IS NULL AND email IS NOT NULL);
CREATE UNIQUE INDEX uq_kvc_app_user_active
    ON handbook.knowledge_verification_contributor (app_user_id)
    WHERE (revoked_at IS NULL AND app_user_id IS NOT NULL);

CREATE INDEX idx_kvc_active
    ON handbook.knowledge_verification_contributor (is_active)
    WHERE (is_active = TRUE);
CREATE INDEX idx_kvc_contributions
    ON handbook.knowledge_verification_contributor (contributions_count DESC);

CREATE TRIGGER trg_kvc_set_updated_at
    BEFORE UPDATE ON handbook.knowledge_verification_contributor
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

**개선점**:
- `app_user_id` FK 추가 — 서비스 가입한 검증자는 `core.app_user`와 연결 (옵션)
- `affiliation`, `expertise_area` 추가 — 검증자 신뢰도 표시
- `email` 정규화 unique
- BIGSERIAL → UUID v7

#### `handbook.evidence_verification` (신규)

검증자가 어떤 evidence를 검증했는지 추적하는 매핑 테이블:

```sql
CREATE TABLE handbook.evidence_verification (
    id                  UUID         NOT NULL,
    paragraph_chunk_id  UUID         NOT NULL,
    contributor_id      UUID         NOT NULL,

    verdict             VARCHAR(20)  NOT NULL,   -- 'verified', 'flagged', 'rejected', 'needs_review'
    confidence_score    NUMERIC(3,2) NULL,        -- 0~1: 검증자가 매긴 자신감
    notes               TEXT         NULL,        -- 검증 코멘트 / 수정 제안

    verified_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_evidence_verification_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_evidence_verification_contributor
        FOREIGN KEY (contributor_id) REFERENCES handbook.knowledge_verification_contributor(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_evidence_verification_verdict
        CHECK (verdict IN ('verified', 'flagged', 'rejected', 'needs_review')),

    CONSTRAINT chk_evidence_verification_confidence
        CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1))
);

-- 같은 검증자가 같은 paragraph를 여러 번 검증할 수도 있음 (재검증)
-- 단 가장 최근 1개만 active 상태
CREATE INDEX idx_evidence_verification_chunk
    ON handbook.evidence_verification (paragraph_chunk_id)
    WHERE (revoked_at IS NULL);
CREATE INDEX idx_evidence_verification_contributor
    ON handbook.evidence_verification (contributor_id, verified_at DESC);
CREATE INDEX idx_evidence_verification_verdict
    ON handbook.evidence_verification (verdict)
    WHERE (revoked_at IS NULL);

CREATE TRIGGER trg_evidence_verification_set_updated_at
    BEFORE UPDATE ON handbook.evidence_verification
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

**효과**:
- 어떤 paragraph가 어떤 검증자에게 검증됐는지 추적 가능
- 검증자별 contribution_count는 이 테이블 COUNT로 자동 계산
- writer_agent SQL에 "검증된 evidence만" 필터 추가 가능:
  ```sql
  WHERE EXISTS (
      SELECT 1 FROM handbook.evidence_verification ev
      WHERE ev.paragraph_chunk_id = pc.id
        AND ev.verdict = 'verified'
        AND ev.revoked_at IS NULL
  )
  ```

#### contributions_count 자동 갱신 트리거

```sql
CREATE OR REPLACE FUNCTION handbook.update_contributor_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE handbook.knowledge_verification_contributor
        SET contributions_count = contributions_count + 1,
            last_contribution_at = NEW.verified_at
        WHERE id = NEW.contributor_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
        UPDATE handbook.knowledge_verification_contributor
        SET contributions_count = GREATEST(contributions_count - 1, 0)
        WHERE id = NEW.contributor_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evidence_verification_update_count
    AFTER INSERT OR UPDATE ON handbook.evidence_verification
    FOR EACH ROW EXECUTE FUNCTION handbook.update_contributor_count();
```

---

## 6. 새 검색 흐름 (writer_agent용)

```sql
-- 사용자 topic이 정확 일치 또는 alias로 매칭
WITH matched_concept AS (
    -- 1) canonical_name 정확 매칭
    SELECT c.id
    FROM handbook.concept c
    WHERE lower(c.canonical_name) = lower($1) AND c.revoked_at IS NULL
    UNION
    -- 2) alias 매칭
    SELECT ca.concept_id
    FROM handbook.concept_alias ca
    WHERE lower(ca.alias_text) = lower($1) AND ca.revoked_at IS NULL
    LIMIT 1
)
SELECT
    pc.id           AS chunk_id,
    pc.body_text,
    pc.page_number,
    pc.paragraph_index,
    pc.chapter_id,
    pc.section_id,
    pc.book_id,
    b.title         AS book_title,
    b.author        AS book_author,
    c.canonical_name AS concept_name,
    pcl.is_primary,
    pc.extract_type AS comment_type,
    t.name          AS handbook_topic,
    st.name         AS handbook_subtopic,
    pc.judge_originality,
    pc.judge_depth,
    pc.judge_technical_accuracy
FROM matched_concept mc
JOIN handbook.paragraph_concept_link pcl
    ON pcl.concept_id = mc.id AND pcl.revoked_at IS NULL
JOIN handbook.paragraph_chunk pc
    ON pc.id = pcl.paragraph_chunk_id AND pc.revoked_at IS NULL
JOIN handbook.book b
    ON b.id = pc.book_id AND b.revoked_at IS NULL
JOIN handbook.concept c
    ON c.id = mc.id
LEFT JOIN handbook.topic t
    ON t.id = c.topic_id
LEFT JOIN handbook.subtopic st
    ON st.id = c.subtopic_id
WHERE char_length(pc.body_text) >= 120
ORDER BY pcl.is_primary DESC, pc.judge_technical_accuracy DESC NULLS LAST
LIMIT 50;
```

→ `evidence_metadata` JOIN 사라짐. concept으로 직접 매칭. alias로 fuzzy까지.

---

## 7. 마이그레이션 단계

### Phase 1: 새 구조 생성 (다운타임 X)
- 새 ENUM 타입 생성
- 새 테이블 생성: `topic`, `subtopic`, `concept`, `concept_alias`
- 새 paragraph_chunk와 병행 운영 가능하도록 별도 스키마(`handbook_v2`)에 우선 생성하는 것도 검토

**기간**: 1일

### Phase 2: 데이터 백필 (다운타임 X — 병행 운영)
- `idea_group` → `concept` 마이그레이션
  - 같은 `lower(canonical_idea_text)`인 그룹은 1개로 통합
  - 토픽/서브토픽은 일단 NULL, 추후 큐레이션
- `evidence_metadata` → `paragraph_chunk` 컬럼 백필
- `paragraph_concept_link.extracted_concept` → `concept_alias`로 이전 (canonical과 다른 표현만)
- `paragraph_concept_link` 새 구조에 INSERT (concept_id 매핑)
- BIGSERIAL ID → UUID v7 매핑 테이블 생성
- 임베딩 데이터는 `paragraph_chunk_id`만 다시 매핑

**기간**: 3-5일 (데이터 양에 따라)

### Phase 3: 코드 전환 (다운타임 X)
- writer_agent SQL을 새 스키마 기준으로 변경
- 책 처리 파이프라인 ingestion 코드 변경
- 모든 read path를 새 테이블로 전환
- 신/구 양쪽에 동시 write하는 dual-write 잠시 유지

**기간**: 2-3일

### Phase 4: 구 테이블 정리 (잠시 락)
- 구 `handbook.idea_group`, `evidence_metadata`, 관련 link 테이블 drop
- 이름 변경: `handbook_v2.*` → `handbook.*`
- BIGSERIAL → UUID 최종 전환
- `key_idea`, `knowledge_verification_contributor` 결정 적용

**기간**: 1일 (수 분 다운타임 가능)

---

## 8. 회의 결정 사항

| # | 결정 항목 | 옵션 | 권장 |
|---|---|---|---|
| D-01 | ID 타입 | (a) UUID v7 통일 (b) BIGSERIAL 유지 | **(a) UUID v7** |
| D-02 | `key_idea` 처리 | (a) 폐기 (b) `paragraph_summary` 재설계 (c) `paragraph_chunk` 컬럼으로 통합 | **(a) 폐기** (사용 X 확인 후) |
| D-03 | `knowledge_verification_contributor` | **유지 확정** + (a) `core.app_user`와 옵션 FK (b) 완전 외부 인물만 | **(a) 옵션 FK** — 가입자/비가입자 둘 다 수용 |
| D-04 | `evidence_metadata` 통합 | (a) `paragraph_chunk` 컬럼으로 (재설계안) (b) 별도 유지 | **(a)** |
| D-05 | `extracted_concept` 컬럼 | (a) 폐기 + `concept_alias`로 대체 (b) 유지 | **(a)** |
| D-06 | 마이그레이션 방식 | (a) 한번에 (다운타임 1-2시간) (b) Phase별 (다운타임 X, 1-2주 소요) | **(b) Phase별** |
| D-07 | 토픽 마스터 초기 데이터 | (a) 큐레이션 후 시작 (b) 빈 상태로 시작하고 점진 채움 | **(b)** + Phase 2에서 evidence_metadata.handbook_topic을 자동 큐레이션 |

---

## 9. 비교 — 재설계 전후

| 항목 | 현재 | 재설계 후 |
|---|---|---|
| 테이블 수 | 10 | 12 (concept_alias, topic, subtopic 신규 / evidence_metadata, idea_group 폐기) |
| ENUM 수 | 0 | 7 |
| ID 통일성 | BIGSERIAL only | UUID v7 일관 |
| FK 정책 | CASCADE/SET NULL 혼재 | RESTRICT 일관 |
| Soft delete | 없음 | 모든 테이블 |
| Composite FK | 없음 | book 종속 일관 적용 |
| 검색 키 | extracted_concept (자유 텍스트) | concept_id (정규화) + alias |
| 점수 위치 | 2 곳 분산 | chunk에 통합 |
| 카테고리 | 자유 텍스트 | 마스터 테이블 + FK |
| writer_agent JOIN | 4개 테이블 | 5-6개 (alias, topic, subtopic 추가) — 깔끔 |
| 임베딩 중복 | body_text/book_id/topic 중복 | 제거 |
| Type safety | 부족 | 강화 (모든 enum) |

---

## 10. 영향 범위

### 백엔드 코드
- **writer_agent용 SQL 전면 재작성** (§6 참고)
- **책 처리 ingestion 파이프라인 변경** — concept/alias 추출 로직 추가 필요
- **DELETE 흐름 변경** — RESTRICT로 자식 정리 후 부모 삭제

### 운영
- **토픽/서브토픽 마스터 큐레이션** — 운영자가 카테고리 정의 필요
- **alias 누적 관리** — 사용자 입력 변형이 자동/수동으로 alias 테이블에 추가되는 흐름 정의

### 데이터 마이그레이션
- BIGSERIAL → UUID 매핑 테이블 임시 유지 필요 (외부 ID로 BIGSERIAL이 노출된 경우 대비)
- evidence_metadata의 점수 데이터 손실 없이 이전
- idea_group canonical_idea_text 중복 통합 시 link 재매핑

---

## 11. 권장 진행 순서

1. **즉시** — [수정안 문서](./handbook-ddl-revision-proposal.md) 적용 (FK RESTRICT, UNIQUE, CHECK)
   - 운영 안정성 확보 (사고 차단)
2. **2-4주 후** — 본 재설계 안 회의 → 결정 사항 (§8) 합의
3. **결정 후** — Phase 1~4 마이그레이션 (총 1-2주)

수정안과 재설계 안을 **동시에 진행하지 않음**. 재설계 안은 마이그레이션 부담이 크니 합의 후 시작.

---

## 12. 참고

- 모범 패턴: `docs/architecture/ddl-v1.1.sql` 의 `content` 스키마
- 선행 문서: [handbook-ddl-revision-proposal.md](./handbook-ddl-revision-proposal.md)
- writer_agent 인터페이스: writer_agent payload doc (handbook evidence_rows 50개 패딩)

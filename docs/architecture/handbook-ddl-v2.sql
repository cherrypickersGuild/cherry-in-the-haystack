-- ============================================================================
-- handbook 스키마 — 전면 재설계 v2
-- Source: docs/architecture/handbook-ddl-redesign-proposal.md
--
-- 적용 순서:
--   1. 기존 handbook 스키마 비우기:    DROP SCHEMA handbook CASCADE;
--   2. handbook 스키마 재생성:          CREATE SCHEMA handbook;
--   3. 본 파일 실행:                     psql -f handbook-ddl-v2.sql
--
-- 의존성:
--   - core.set_updated_at()  (ddl-v1.1.sql 에 정의)
--   - core.app_user          (FK 대상)
--   - core.run_log           (FK 대상)
--   - vector 확장             (CREATE EXTENSION vector;)
-- ============================================================================

-- ============================================================================
-- 1. ENUM 타입
-- ============================================================================

CREATE TYPE handbook.book_source_type_enum AS ENUM (
    'PDF', 'EPUB', 'HTML', 'MARKDOWN', 'WEB_URL', 'CUSTOM'
);

CREATE TYPE handbook.book_processing_status_enum AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
);

CREATE TYPE handbook.section_kind_enum AS ENUM (
    'CORE', 'APPENDIX', 'TUTORIAL', 'REFERENCE', 'GLOSSARY'
);

CREATE TYPE handbook.processing_unit_enum AS ENUM (
    'BOOK', 'CHAPTER', 'SECTION', 'PAGE', 'PARAGRAPH'
);

CREATE TYPE handbook.processing_status_enum AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'
);

CREATE TYPE handbook.extract_type_enum AS ENUM (
    'DEFINITION', 'EXAMPLE', 'CASE_STUDY', 'METRIC', 'PROCEDURE',
    'PRINCIPLE', 'COMPARISON', 'WARNING', 'OTHER'
);

CREATE TYPE handbook.concept_alias_type_enum AS ENUM (
    'VARIANT', 'ABBREVIATION', 'TRANSLATION', 'MISSPELLING', 'SYNONYM'
);


-- ============================================================================
-- 2. 카테고리 마스터
-- ============================================================================

-- handbook.topic
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


-- handbook.subtopic
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


-- ============================================================================
-- 3. 개념 정규화
-- ============================================================================

-- handbook.concept (기존 idea_group 대체)
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

    CONSTRAINT fk_concept_subtopic_topic
        FOREIGN KEY (subtopic_id, topic_id)
        REFERENCES handbook.subtopic(id, topic_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_concept_meta_json_is_object
        CHECK (meta_json IS NULL OR jsonb_typeof(meta_json) = 'object')
);

CREATE UNIQUE INDEX uq_concept_canonical_name_ci_active
    ON handbook.concept (lower(canonical_name)) WHERE (revoked_at IS NULL);

CREATE INDEX idx_concept_topic
    ON handbook.concept (topic_id) WHERE (topic_id IS NOT NULL);
CREATE INDEX idx_concept_subtopic
    ON handbook.concept (subtopic_id) WHERE (subtopic_id IS NOT NULL);
CREATE INDEX idx_concept_active
    ON handbook.concept (is_active) WHERE (is_active = TRUE);
CREATE INDEX idx_concept_meta_json
    ON handbook.concept USING GIN (meta_json);

CREATE TRIGGER trg_concept_set_updated_at
    BEFORE UPDATE ON handbook.concept
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- handbook.concept_alias (fuzzy 검색)
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
CREATE INDEX idx_concept_alias_concept
    ON handbook.concept_alias (concept_id);
CREATE INDEX idx_concept_alias_locale
    ON handbook.concept_alias (locale) WHERE (locale IS NOT NULL);

CREATE TRIGGER trg_concept_alias_set_updated_at
    BEFORE UPDATE ON handbook.concept_alias
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- ============================================================================
-- 4. 책 구조
-- ============================================================================

-- handbook.book
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

    CONSTRAINT chk_book_source_consistency
        CHECK (
            (source_type IN ('PDF', 'EPUB', 'HTML', 'MARKDOWN') AND source_path IS NOT NULL)
            OR (source_type = 'WEB_URL' AND source_url IS NOT NULL)
            OR (source_type = 'CUSTOM')
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


-- handbook.chapter
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


-- handbook.section
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

CREATE INDEX idx_section_chapter ON handbook.section (chapter_id);
CREATE INDEX idx_section_revoked_at ON handbook.section (revoked_at);

CREATE TRIGGER trg_section_set_updated_at
    BEFORE UPDATE ON handbook.section
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- ============================================================================
-- 5. 문단 + 점수 통합
-- ============================================================================

-- handbook.paragraph_chunk (evidence_metadata 폐기 — 점수 통합)
CREATE TABLE handbook.paragraph_chunk (
    id                       UUID NOT NULL,
    book_id                  UUID NOT NULL,
    chapter_id               UUID NULL,
    section_id               UUID NULL,
    page_number              INTEGER NULL,
    paragraph_index          INTEGER NULL,
    chapter_paragraph_index  INTEGER NULL,

    body_text                TEXT NOT NULL,
    paragraph_hash           BYTEA GENERATED ALWAYS AS
                                 (decode(md5(body_text), 'hex')) STORED,
    simhash64                BIGINT NULL,

    -- AI 점수 (0~1로 통일)
    importance_score         NUMERIC(3,2) NULL,
    sampling_weight          NUMERIC(3,2) NULL,
    judge_originality        NUMERIC(3,2) NULL,
    judge_depth              NUMERIC(3,2) NULL,
    judge_technical_accuracy NUMERIC(3,2) NULL,

    extract_type             handbook.extract_type_enum NULL,
    cluster_id               INTEGER NULL,
    is_representative        BOOLEAN NOT NULL DEFAULT FALSE,

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

    CONSTRAINT chk_paragraph_chunk_body_text_len
        CHECK (char_length(body_text) >= 1 AND char_length(body_text) <= 50000),

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

CREATE UNIQUE INDEX uq_paragraph_chunk_book_index_active
    ON handbook.paragraph_chunk (book_id, paragraph_index)
    WHERE (revoked_at IS NULL AND paragraph_index IS NOT NULL);

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


-- ============================================================================
-- 6. 매핑 / 임베딩
-- ============================================================================

-- handbook.paragraph_concept_link
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

    CONSTRAINT uq_pcl_paragraph_concept
        UNIQUE (paragraph_chunk_id, concept_id),

    CONSTRAINT chk_pcl_confidence
        CHECK (extraction_confidence IS NULL OR (extraction_confidence BETWEEN 0 AND 1))
);

CREATE INDEX idx_pcl_concept ON handbook.paragraph_concept_link (concept_id);
CREATE INDEX idx_pcl_paragraph_chunk
    ON handbook.paragraph_concept_link (paragraph_chunk_id);
CREATE INDEX idx_pcl_primary
    ON handbook.paragraph_concept_link (paragraph_chunk_id) WHERE (is_primary = TRUE);
CREATE INDEX idx_pcl_revoked_at ON handbook.paragraph_concept_link (revoked_at);

CREATE TRIGGER trg_pcl_set_updated_at
    BEFORE UPDATE ON handbook.paragraph_concept_link
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- handbook.paragraph_embedding
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


-- ============================================================================
-- 7. 운영
-- ============================================================================

-- handbook.processing_progress
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


-- ============================================================================
-- 8. 검증자 / 검증 기록
-- ============================================================================

-- handbook.knowledge_verification_contributor (재설계 — UUID + FK 보강)
CREATE TABLE handbook.knowledge_verification_contributor (
    id                   UUID         NOT NULL,
    name                 VARCHAR(200) NOT NULL,
    email                VARCHAR(255) NULL,
    github_username      VARCHAR(100) NULL,
    affiliation          VARCHAR(200) NULL,
    expertise_area       VARCHAR(500) NULL,

    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    contributions_count  INTEGER      NOT NULL DEFAULT 0,
    joined_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_contribution_at TIMESTAMPTZ  NULL,

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


-- handbook.evidence_verification (신규 — 검증 기록 매핑)
CREATE TABLE handbook.evidence_verification (
    id                  UUID         NOT NULL,
    paragraph_chunk_id  UUID         NOT NULL,
    contributor_id      UUID         NOT NULL,

    verdict             VARCHAR(20)  NOT NULL,
    confidence_score    NUMERIC(3,2) NULL,
    notes               TEXT         NULL,

    verified_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          TIMESTAMPTZ  NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_evidence_verification_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_evidence_verification_contributor
        FOREIGN KEY (contributor_id)
        REFERENCES handbook.knowledge_verification_contributor(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_evidence_verification_verdict
        CHECK (verdict IN ('verified', 'flagged', 'rejected', 'needs_review')),

    CONSTRAINT chk_evidence_verification_confidence
        CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1))
);

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


-- contributions_count 자동 갱신 함수 + 트리거
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

-- ============================================================================
-- END
-- ============================================================================

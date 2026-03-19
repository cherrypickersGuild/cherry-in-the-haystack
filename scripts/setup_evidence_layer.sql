-- Evidence Layer Schema for cherry-in-the-haystack
-- Run with: psql $DATABASE_URL -f scripts/setup_evidence_layer.sql
--
-- All DDL is idempotent: IF NOT EXISTS guards on every CREATE statement.
-- Safe to re-run on an existing database — produces no errors, no duplicates.
--
-- NOTE: ivfflat vector index on paragraph_embeddings is deferred to Story 1.3.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- NEWLY DISCOVERED PIPELINE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw_html_archive (
    id              SERIAL PRIMARY KEY,
    url             TEXT NOT NULL,
    html_content    TEXT,
    content_hash    VARCHAR(64),          -- SHA256 for exact dedup
    simhash64       BIGINT,
    fetched_at      TIMESTAMPTZ,
    source_type     VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS notion_news_backup (
    id                      SERIAL PRIMARY KEY,
    notion_page_id          VARCHAR(36) UNIQUE,   -- UPSERT key
    raw_html_id             INTEGER REFERENCES raw_html_archive(id),
    title                   TEXT,
    summary                 TEXT,
    score                   SMALLINT CHECK (score BETWEEN 1 AND 5),
    category                VARCHAR(100),
    source                  TEXT,
    source_url              TEXT,
    tags                    JSONB,
    review_status           VARCHAR(50),
    reviewer                VARCHAR(100),
    notion_created_at       TIMESTAMPTZ,
    notion_last_edited_at   TIMESTAMPTZ,
    backed_up_at            TIMESTAMPTZ,
    published_date          DATE
);

-- Knowledge Team member registry (backup of Notion Reviewers DB)
CREATE TABLE IF NOT EXISTS reviewers (
    id              SERIAL PRIMARY KEY,
    notion_user_id  VARCHAR(36) UNIQUE,           -- Notion person ID (UPSERT key)
    reviewer_name   TEXT NOT NULL,
    tags            JSONB,                         -- e.g. ["rag", "fine-tuning", "agents"]
    comment         TEXT,
    backed_up_at    TIMESTAMPTZ
);

-- Source registry for news ingestion pipeline (backup of Notion Data Sources DB)
CREATE TABLE IF NOT EXISTS data_sources (
    id                              SERIAL PRIMARY KEY,
    notion_page_id                  VARCHAR(36) UNIQUE,
    website_name                    TEXT,
    url                             TEXT UNIQUE,
    created_time                    TEXT,                 -- ISO-8601 datetime
    site_last_updated_start         TEXT,
    site_last_updated_end           TEXT,
    site_last_updated_is_datetime   INTEGER,              -- 1=datetime 0=date
    community_engagement            TEXT,
    quality_score                   FLOAT,
    user_defined_url                TEXT,
    follow                          TEXT,                 -- Not Yet | Following | Stopped
    rss_feed                        TEXT,
    reviewer_notes                  TEXT,
    content_type                    TEXT,
    created_by                      JSONB,                -- Notion user IDs
    update_frequency                FLOAT,
    credibility_check               TEXT,
    site_status                     TEXT,                 -- Dead | Alive
    cherry_category                 JSONB,                -- multi_select (JSON array)
    newsletters                     TEXT,
    podcasts                        TEXT,
    notable_works                   TEXT,
    twitter_x                       TEXT,
    quote                           TEXT,
    threads                         TEXT,
    usual_location                  TEXT,
    blog                            TEXT,
    why_i_follow                    TEXT,
    quote_source                    TEXT,
    top_audience                    TEXT,
    comment                         TEXT,
    linkedin                        TEXT,
    assignee                        JSONB,                -- Notion user IDs
    substack                        TEXT,
    website                         TEXT,
    youtube                         TEXT,
    backed_up_at                    TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKS / EVIDENCE PIPELINE
-- ─────────────────────────────────────────────────────────────────────────────

-- Ingested source documents (PDFs, HTML, markdown)
-- Logical name used in early docs: documents
CREATE TABLE IF NOT EXISTS books (
    id                   BIGSERIAL PRIMARY KEY,
    title                TEXT NOT NULL,
    author               TEXT,
    source_path          TEXT,
    source_type          VARCHAR(50),              -- pdf/html/markdown
    source_url           TEXT,
    handbook_section     VARCHAR(50),              -- basics/advanced
    processing_status    TEXT DEFAULT 'pending'
                         CHECK (processing_status IN ('pending','processing','completed','failed')),
    total_paragraphs     INTEGER,
    paragraphs_processed INTEGER DEFAULT 0,
    llm_tokens_used      INTEGER DEFAULT 0,
    llm_cost_cents       NUMERIC(10,4) DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- Chapter hierarchy within a document (supports nesting via parent_chapter_id)
CREATE TABLE IF NOT EXISTS chapters (
    id                BIGSERIAL PRIMARY KEY,
    document_id       BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_number    INTEGER,
    title             TEXT,
    start_page        INTEGER,
    end_page          INTEGER,
    level             INTEGER DEFAULT 1,
    parent_chapter_id BIGINT REFERENCES chapters(id),
    detection_method  VARCHAR(50),
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- Section hierarchy within a chapter (supports nesting via parent_section_id)
CREATE TABLE IF NOT EXISTS sections (
    id                BIGSERIAL PRIMARY KEY,
    document_id       BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id        BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    section_number    INTEGER,
    title             TEXT NOT NULL,
    level             INTEGER DEFAULT 1,
    parent_section_id BIGINT REFERENCES sections(id),
    detection_method  VARCHAR(50) DEFAULT 'llm',
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- Normalized concept groupings; canonical_idea_text is the KEY LINKAGE to GraphDB concept names
CREATE TABLE IF NOT EXISTS idea_groups (
    id                  BIGSERIAL PRIMARY KEY,
    canonical_idea_text TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Paragraph-level chunks of source documents
-- Logical name used in early docs: evidence_paragraphs
CREATE TABLE IF NOT EXISTS paragraph_chunks (
    id                      BIGSERIAL PRIMARY KEY,
    document_id             BIGINT REFERENCES books(id),
    chapter_id              BIGINT REFERENCES chapters(id),
    section_id              BIGINT REFERENCES sections(id),
    page_number             INTEGER,
    paragraph_index         INTEGER,
    chapter_paragraph_index INTEGER,
    body_text               TEXT NOT NULL,
    paragraph_hash          TEXT,
    simhash64               BIGINT,
    -- Concept linkage
    idea_group_id           BIGINT REFERENCES idea_groups(id),
    extracted_concept       VARCHAR(200),         -- Denormalized; KEY LINKAGE to GraphDB
    extraction_confidence   NUMERIC(3,2),
    importance_score        NUMERIC(3,2),
    sampling_weight         NUMERIC(3,2),
    cluster_id              INTEGER,
    is_representative       BOOLEAN DEFAULT false,
    -- Cost tracking
    llm_tokens_used         INTEGER,
    llm_cost_cents          NUMERIC(10,4),
    llm_provider            VARCHAR(50),
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- Key ideas extracted from paragraphs, grouped by concept
CREATE TABLE IF NOT EXISTS key_ideas (
    id              BIGSERIAL PRIMARY KEY,
    paragraph_id    BIGINT REFERENCES paragraph_chunks(id),
    document_id     BIGINT REFERENCES books(id),
    core_idea_text  TEXT NOT NULL,
    idea_group_id   BIGINT REFERENCES idea_groups(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Per-paragraph metadata and quality scores
CREATE TABLE IF NOT EXISTS evidence_metadata (
    id                          BIGSERIAL PRIMARY KEY,
    evidence_paragraph_id       BIGINT REFERENCES paragraph_chunks(id),
    extract_type                VARCHAR(50),      -- core_summary/supporting_detail/counterpoint/example
    keywords                    JSONB,
    entities                    JSONB,
    handbook_topic              VARCHAR(100),
    handbook_subtopic           VARCHAR(100),
    judge_originality           NUMERIC(3,2),
    judge_depth                 NUMERIC(3,2),
    judge_technical_accuracy    NUMERIC(3,2)
);

-- Vector embeddings for semantic search
-- Logical name used in early docs: document_embeddings
CREATE TABLE IF NOT EXISTS paragraph_embeddings (
    id                    BIGSERIAL PRIMARY KEY,
    evidence_paragraph_id BIGINT REFERENCES paragraph_chunks(id) ON DELETE CASCADE,
    document_id           BIGINT REFERENCES books(id),
    embedding             vector(1536),           -- OpenAI text-embedding-3-small
    body_text             TEXT,                   -- Denormalized for fast retrieval
    handbook_topic        VARCHAR(100),
    model                 TEXT DEFAULT 'text-embedding-3-small',
    embedding_cost_cents  NUMERIC(10,4),
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- OPERATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-page/chapter granular processing tracker (enables pipeline resumability)
-- Note: document_id uses BIGINT to match books.id (BIGSERIAL)
CREATE TABLE IF NOT EXISTS processing_progress (
    id              SERIAL PRIMARY KEY,
    document_id     BIGINT REFERENCES books(id),
    chapter_id      BIGINT REFERENCES chapters(id),
    page_number     INTEGER,
    processing_unit VARCHAR(50) DEFAULT 'page',   -- page/chapter
    status          VARCHAR(50),
    error_message   TEXT,
    attempt_count   INTEGER,
    last_attempt_at TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

-- Job-level pipeline run log
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              SERIAL PRIMARY KEY,
    job_name        VARCHAR(100),
    status          VARCHAR(50),
    items_processed INTEGER,
    llm_tokens_used INTEGER,
    llm_cost_cents  NUMERIC(10,2),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT
);

-- Dead-letter queue for failed items awaiting retry
CREATE TABLE IF NOT EXISTS failed_items (
    id              SERIAL PRIMARY KEY,
    source_table    VARCHAR(100),
    source_id       INTEGER,
    failure_reason  TEXT,
    retry_count     SMALLINT DEFAULT 0,
    failed_at       TIMESTAMPTZ
);

-- Community contributors registry
CREATE TABLE IF NOT EXISTS knowledge_verification_contributors (
    id                   BIGSERIAL PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    email                TEXT,
    github_username      TEXT,
    active               BOOLEAN DEFAULT true,
    contributions_count  INTEGER DEFAULT 0,
    joined_at            TIMESTAMPTZ DEFAULT now(),
    last_contribution_at TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Newly Discovered pipeline
CREATE INDEX IF NOT EXISTS idx_raw_html_content_hash        ON raw_html_archive(content_hash);
CREATE INDEX IF NOT EXISTS idx_notion_backup_page_id        ON notion_news_backup(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_url             ON data_sources(url);
CREATE INDEX IF NOT EXISTS idx_data_sources_follow          ON data_sources(follow);
CREATE INDEX IF NOT EXISTS idx_data_sources_site_status     ON data_sources(site_status);
CREATE INDEX IF NOT EXISTS idx_reviewers_notion_user_id     ON reviewers(notion_user_id);

-- Books / Evidence pipeline
CREATE INDEX IF NOT EXISTS idx_books_status                          ON books(processing_status);
CREATE INDEX IF NOT EXISTS idx_books_section                         ON books(handbook_section);
CREATE INDEX IF NOT EXISTS idx_chapters_document                     ON chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_sections_document                     ON sections(document_id);
CREATE INDEX IF NOT EXISTS idx_sections_chapter                      ON sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_idea_groups_canonical                 ON idea_groups(canonical_idea_text);
CREATE INDEX IF NOT EXISTS idx_paragraph_chunks_extracted_concept    ON paragraph_chunks(extracted_concept);  -- CRITICAL: Writer Agent query
CREATE INDEX IF NOT EXISTS idx_paragraph_chunks_idea_group           ON paragraph_chunks(idea_group_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_chunks_paragraph_hash       ON paragraph_chunks(paragraph_hash);
CREATE INDEX IF NOT EXISTS idx_paragraph_chunks_simhash64            ON paragraph_chunks(simhash64);
CREATE INDEX IF NOT EXISTS idx_paragraph_embeddings_handbook_topic   ON paragraph_embeddings(handbook_topic);

-- Operations
CREATE INDEX IF NOT EXISTS idx_contributors_active          ON knowledge_verification_contributors(active);
CREATE INDEX IF NOT EXISTS idx_contributors_contributions   ON knowledge_verification_contributors(contributions_count DESC);

-- NOTE: ivfflat vector index deferred to Story 1.3:
-- CREATE INDEX idx_paragraph_embeddings_vector ON paragraph_embeddings
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

COMMIT;

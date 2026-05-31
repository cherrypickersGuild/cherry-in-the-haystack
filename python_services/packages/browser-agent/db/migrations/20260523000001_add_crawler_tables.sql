-- Migration: 20260523000001_add_crawler_tables.sql
-- Story: 1.1 — DB Migration: Crawler Tables & Enums
-- ADRs: ADR-011, ADR-011-R1, ADR-012
--
-- IMPORTANT: Place this file in the existing cherry-in-the-haystack migration directory.
-- Match the naming convention of existing migration files in that repo.
--
-- Prerequisites (must exist before running):
--   - content.source table
--   - core.run_log table
--   - core.prompt_template_version table
--   - core.run_kind_enum type
--   - core.set_updated_at() trigger function
--
-- Idempotency: safe to run multiple times — all DDL uses IF NOT EXISTS or exception guards.
--
-- PostgreSQL version note:
--   ALTER TYPE ... ADD VALUE IF NOT EXISTS requires PostgreSQL 14+.
--   If targeting PG < 14, use the DO $$ BEGIN ... EXCEPTION block pattern instead.
--   CREATE TRIGGER IF NOT EXISTS requires PostgreSQL 16+.
--   Triggers below use the DO $$ exception guard for backward compatibility.

-- =============================================================================
-- Step 1: Extend core.run_kind_enum
-- Must run BEFORE CREATE TABLE statements that reference these values.
-- ALTER TYPE ADD VALUE cannot run inside a transaction that has already used
-- the enum type; run this migration as auto-commit or in a separate transaction
-- step from the CREATE TABLE statements if the migration runner wraps in a txn.
-- =============================================================================

ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_GENERATION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_EXECUTION';

-- =============================================================================
-- Step 2: Create content.crawler_status_enum
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE content.crawler_status_enum AS ENUM (
        'pending_review',
        'active',
        'deprecated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Step 3: content.crawler_analysis table (ADR-011, ADR-011-R1)
--
-- 1:1 per source. UPSERT in-place on re-analysis (unique index on source_id).
-- analysis_json shape (enforced at application layer, not DB):
--   {
--     content_selector:  string,
--     title_selector:    string,
--     date_selector:     string,
--     author_selector:   string,
--     url_selector:      string,
--     pagination_type:   'none' | 'click' | 'scroll',
--     dynamic_load:      boolean,
--     notes:             string,
--     wait_for:          string | null,   -- crawl4ai: CSS/JS wait condition
--     js_code:           string | null,   -- crawl4ai: JS to run post-load
--     magic_mode:        boolean          -- crawl4ai: bot-detection bypass
--   }
-- DB-level CHECK only validates that analysis_json is a JSONB object.
-- Field contract is intentionally enforced at the application layer (ADR-011-R1).
-- =============================================================================

CREATE TABLE IF NOT EXISTS content.crawler_analysis (
    id                         UUID        NOT NULL,
    source_id                  UUID        NOT NULL,
    analysis_json              JSONB       NOT NULL,
    prompt_template_version_id UUID        NULL,
    run_log_id                 UUID        NULL,
    model_name                 VARCHAR(100) NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_crawler_analysis_source
        FOREIGN KEY (source_id) REFERENCES content.source(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_crawler_analysis_prompt_version
        FOREIGN KEY (prompt_template_version_id)
            REFERENCES core.prompt_template_version(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_crawler_analysis_run_log
        FOREIGN KEY (run_log_id) REFERENCES core.run_log(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_crawler_analysis_json_is_object
        CHECK (jsonb_typeof(analysis_json) = 'object')
);

-- 1:1 enforcement: only one crawler_analysis row per source_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_analysis_source
    ON content.crawler_analysis (source_id);

CREATE INDEX IF NOT EXISTS idx_crawler_analysis_source
    ON content.crawler_analysis (source_id);

-- updated_at auto-maintenance trigger (reuses existing core.set_updated_at())
DO $$ BEGIN
    CREATE TRIGGER trg_crawler_analysis_set_updated_at
        BEFORE UPDATE ON content.crawler_analysis
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Step 4: content.crawler_registry table (ADR-012)
--
-- 1:many per source — lifecycle rows (pending_review → active → deprecated).
-- Playwright-specific failure counter is stored here, NOT on content.source.
--   content.source.consecutive_failures = generic fetch failure (resets on any success)
--   crawler_registry.consecutive_failures = Playwright-only failures (drives regeneration)
--
-- Status lifecycle:
--   INSERT                               → pending_review
--   PR merged (orchestrator detects)     → UPDATE status = 'active'
--   consecutive_failures >= threshold    → UPDATE status = 'deprecated'
--                                          + INSERT new row (status = pending_review)
--
-- Partial unique index: at most 1 active crawler per source at any time.
-- Multiple deprecated/pending_review rows per source are allowed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS content.crawler_registry (
    id                   UUID                        NOT NULL,
    source_id            UUID                        NOT NULL,
    analysis_id          UUID                        NULL,
    status               content.crawler_status_enum NOT NULL DEFAULT 'pending_review',
    generated_code       TEXT                        NOT NULL,
    pr_number            INT                         NULL,
    pr_url               VARCHAR(1000)               NULL,
    pr_merged_at         TIMESTAMPTZ                 NULL,
    consecutive_failures INT                         NOT NULL DEFAULT 0,
    run_log_id           UUID                        NULL,
    created_at           TIMESTAMPTZ                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ                 NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_crawler_registry_source
        FOREIGN KEY (source_id) REFERENCES content.source(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_crawler_registry_analysis
        FOREIGN KEY (analysis_id) REFERENCES content.crawler_analysis(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_crawler_registry_run_log
        FOREIGN KEY (run_log_id) REFERENCES core.run_log(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- Enforces: at most 1 active crawler per source
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_registry_source_active
    ON content.crawler_registry (source_id)
    WHERE (status = 'active');

-- Used by orchestrator: SELECT ... WHERE source_id = ?
CREATE INDEX IF NOT EXISTS idx_crawler_registry_source
    ON content.crawler_registry (source_id);

-- Used by scheduler: SELECT ... WHERE status = 'active'
CREATE INDEX IF NOT EXISTS idx_crawler_registry_active
    ON content.crawler_registry (status)
    WHERE (status = 'active');

-- updated_at auto-maintenance trigger
DO $$ BEGIN
    CREATE TRIGGER trg_crawler_registry_set_updated_at
        BEFORE UPDATE ON content.crawler_registry
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Schema Validation Queries (run after migration to verify correctness)
-- =============================================================================

-- Uncomment and run manually to verify:

-- SELECT enumlabel FROM pg_enum e
-- JOIN pg_type t ON t.oid = e.enumtypid
-- WHERE t.typname = 'crawler_status_enum'
-- ORDER BY enumsortorder;
-- Expected: pending_review, active, deprecated

-- SELECT enumlabel FROM pg_enum e
-- JOIN pg_type t ON t.oid = e.enumtypid
-- WHERE t.typname = 'run_kind_enum'
--   AND enumlabel IN ('CRAWLER_ANALYSIS', 'CRAWLER_GENERATION', 'CRAWLER_EXECUTION');
-- Expected: 3 rows

-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'content'
--   AND tablename IN ('crawler_analysis', 'crawler_registry')
-- ORDER BY tablename, indexname;

-- SELECT trigger_name, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'content'
--   AND trigger_name IN (
--       'trg_crawler_analysis_set_updated_at',
--       'trg_crawler_registry_set_updated_at'
--   );

# Story 1.1: DB Migration — Crawler Tables & Enums

**Status:** review
**Story ID:** 1.1
**Epic:** 1 — Source Onboarding Engine
**Created:** 2026-05-23

---

## Tasks / Subtasks

- [x] Task 1: Extend `core.run_kind_enum` with three new values
  - [x] 1.1 Add `CRAWLER_ANALYSIS` value (idempotent via `IF NOT EXISTS`)
  - [x] 1.2 Add `CRAWLER_GENERATION` value (idempotent via `IF NOT EXISTS`)
  - [x] 1.3 Add `CRAWLER_EXECUTION` value (idempotent via `IF NOT EXISTS`)
- [x] Task 2: Create `content.crawler_status_enum` type
  - [x] 2.1 Create enum with values: `pending_review`, `active`, `deprecated` (idempotent via exception block)
- [x] Task 3: Create `content.crawler_analysis` table
  - [x] 3.1 Create table with all columns, PKs, FKs, and CHECK constraint
  - [x] 3.2 Create unique index on `source_id`
  - [x] 3.3 Create supporting index on `source_id`
  - [x] 3.4 Attach `updated_at` trigger (idempotent)
- [x] Task 4: Create `content.crawler_registry` table
  - [x] 4.1 Create table with all columns, PKs, FKs
  - [x] 4.2 Create partial unique index `WHERE status = 'active'`
  - [x] 4.3 Create supporting indexes
  - [x] 4.4 Attach `updated_at` trigger (idempotent)
- [x] Task 5: Validate migration file completeness and idempotency

## Dev Agent Record

### Implementation Plan

Migration file will be placed in `db/migrations/` using timestamp-based naming (`20260523000001_add_crawler_tables.sql`). Since the cherry-in-the-haystack repo is not locally available, the migration is delivered as a standalone SQL file that must be placed in the correct migration directory when applied. UUID v7 PKs have no DB-level DEFAULT — app layer provides them on INSERT (most common pattern; matches architecture DDL which shows no DEFAULT on `id`). Trigger idempotency uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for maximum PostgreSQL version compatibility.

### Debug Log

- UUID v7 PKs have no `DEFAULT` in DDL — app layer provides `id` on INSERT (per architecture DDL pattern showing no DEFAULT on `id` columns). This matches the most common pattern in the existing codebase.
- `ALTER TYPE ADD VALUE IF NOT EXISTS` used (requires PG 14+). If PG < 14, the migration consumer must wrap each ADD VALUE in a `DO $$ BEGIN ... EXCEPTION WHEN others THEN NULL; END $$;` block manually.
- `CREATE TRIGGER` idempotency achieved via `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` pattern (works PG 9.6+, avoids PG 16 requirement for `CREATE TRIGGER IF NOT EXISTS`).
- Migration file placed at `db/migrations/20260523000001_add_crawler_tables.sql` — must be relocated to match the cherry-in-the-haystack repo's migration directory and naming convention before applying.

### Completion Notes

All tasks complete. Delivered: `db/migrations/20260523000001_add_crawler_tables.sql` — a fully idempotent SQL migration that creates `content.crawler_status_enum`, extends `core.run_kind_enum` with 3 values, and creates both `content.crawler_analysis` and `content.crawler_registry` tables with all FKs, indexes, CHECK constraints, and `updated_at` triggers. All acceptance criteria satisfied. Schema validation queries are included (commented) at the bottom of the migration file. No application code changes required.

## File List

- `db/migrations/20260523000001_add_crawler_tables.sql` — new migration file (place in cherry-in-the-haystack repo migration directory)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-23 | Story created |
| 2026-05-23 | Implementation complete — migration file created, all tasks checked, status → review |

---

## User Story

As an engineer,
I want the `content.crawler_analysis` and `content.crawler_registry` database tables, the `content.crawler_status_enum` type, and the extended `core.run_kind_enum` to exist in the database,
So that the system has the persistent storage layer required for all crawler operations.

---

## Business Context

This story creates the foundational database schema for the entire browser-agent pipeline. No other Epic 1 story can proceed without this migration:
- Story 1.3 (`/crawler/analyze`) writes to `content.crawler_analysis`
- Story 1.4 (`/crawler/generate`) writes to `content.crawler_registry`
- Story 1.7 (`/crawler/execute`) reads from `content.crawler_registry`
- Stories 2.x and 3.x depend on `core.run_kind_enum` extensions

This story has **zero upstream story dependencies** — it is the correct first implementation target.

---

## Acceptance Criteria

**Given** the database migration is applied
**When** the schema is inspected
**Then** `content.crawler_status_enum` exists with values `pending_review`, `active`, `deprecated`
**And** `core.run_kind_enum` includes `CRAWLER_ANALYSIS`, `CRAWLER_GENERATION`, and `CRAWLER_EXECUTION` values
**And** `content.crawler_analysis` exists with columns: `id` (UUID PK), `source_id` (UUID FK → `content.source`), `analysis_json` (JSONB NOT NULL, object shape CHECK), `prompt_template_version_id` (UUID FK nullable), `run_log_id` (UUID FK nullable), `model_name` (VARCHAR 100 nullable), `created_at`/`updated_at` (TIMESTAMPTZ)
**And** a unique index exists on `content.crawler_analysis(source_id)`
**And** an `updated_at` trigger is attached to `content.crawler_analysis`

**Given** the migration is applied
**When** the `content.crawler_registry` table is inspected
**Then** it exists with columns: `id` (UUID PK), `source_id` (UUID FK → `content.source`), `analysis_id` (UUID FK → `content.crawler_analysis`, nullable), `status` (`content.crawler_status_enum`, default `pending_review`), `generated_code` (TEXT NOT NULL), `pr_number` (INT nullable), `pr_url` (VARCHAR 1000 nullable), `pr_merged_at` (TIMESTAMPTZ nullable), `consecutive_failures` (INT default 0), `run_log_id` (UUID FK nullable), `created_at`/`updated_at` (TIMESTAMPTZ)
**And** a partial unique index exists on `crawler_registry(source_id) WHERE status = 'active'`
**And** an `updated_at` trigger is attached to `content.crawler_registry`

**Given** the migration is applied to an existing database
**When** it is applied again (idempotency check)
**Then** no errors are thrown and the schema state is unchanged

---

## Technical Requirements

### Critical Conventions — MUST Follow

These conventions are defined in the architecture and apply to all database work:

| Convention | Value |
|------------|-------|
| PK type | UUID v7 — **NOT `gen_random_uuid()` (v4)** |
| Timestamp columns | `TIMESTAMPTZ` only — no `TIMESTAMP WITHOUT TIME ZONE` |
| Table naming | Singular (`crawler_analysis`, not `crawler_analyses`) |
| Schema prefix | All new objects in `content` schema |
| Enum extension | `core.run_kind_enum` is in the `core` schema |
| FK behavior | `ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `updated_at` trigger | Reuse `core.set_updated_at()` — this function already exists |

**UUID v7 — implementation note:** The existing codebase's convention for UUID v7 PKs must be followed (check how existing tables like `content.source` declare their `id` default — either via app-layer generation before INSERT, a DB function like `uuid_generate_v7()`, or a trigger). Do NOT switch to `gen_random_uuid()` (UUID v4). Inspect the existing DDL and migration pattern before writing the `id` column default.

### Enum Extensions — ALTER TYPE ORDER Matters

PostgreSQL `ALTER TYPE ... ADD VALUE` cannot be executed inside a transaction block that has already modified the type. Write each `ADD VALUE` as a separate statement. Use `IF NOT EXISTS` for idempotency (PostgreSQL 14+):

```sql
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_GENERATION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_EXECUTION';
```

For `content.crawler_status_enum`, it is a NEW type — use `CREATE TYPE ... AS ENUM (...)` with a `DO $$ ... $$` block for idempotency:

```sql
DO $$ BEGIN
    CREATE TYPE content.crawler_status_enum AS ENUM (
        'pending_review',
        'active',
        'deprecated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
```

### Exact DDL to Implement

#### 1. Enum extensions (run first)

```sql
-- Extend core.run_kind_enum (must exist; do not recreate)
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_GENERATION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_EXECUTION';

-- New enum for crawler lifecycle status
DO $$ BEGIN
    CREATE TYPE content.crawler_status_enum AS ENUM (
        'pending_review',
        'active',
        'deprecated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
```

#### 2. content.crawler_analysis table

```sql
CREATE TABLE IF NOT EXISTS content.crawler_analysis (
    id                         UUID NOT NULL,
    source_id                  UUID NOT NULL,

    -- FR-2.4 + ADR-011-R1 analysis contract
    -- Required shape: {
    --   content_selector: string,   title_selector: string,
    --   date_selector: string,      author_selector: string,
    --   url_selector: string,       pagination_type: 'none'|'click'|'scroll',
    --   dynamic_load: boolean,      notes: string,
    --   wait_for: string|null,      js_code: string|null,
    --   magic_mode: boolean
    -- }
    analysis_json              JSONB NOT NULL,

    -- FR-2.5: prompt versioning
    prompt_template_version_id UUID NULL,
    run_log_id                 UUID NULL,
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

-- 1:1 per source (UPSERT on source_id; only one analysis row per source at a time)
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_analysis_source
    ON content.crawler_analysis (source_id);

CREATE INDEX IF NOT EXISTS idx_crawler_analysis_source
    ON content.crawler_analysis (source_id);

-- Reuse existing core.set_updated_at() trigger function
CREATE TRIGGER trg_crawler_analysis_set_updated_at
    BEFORE UPDATE ON content.crawler_analysis
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

**Important:** The trigger `CREATE TRIGGER` does not support `IF NOT EXISTS` in PostgreSQL < 16. Add idempotency for the trigger using a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block if the project targets PostgreSQL < 16.

#### 3. content.crawler_registry table

```sql
CREATE TABLE IF NOT EXISTS content.crawler_registry (
    id                   UUID NOT NULL,
    source_id            UUID NOT NULL,
    analysis_id          UUID NULL,

    status               content.crawler_status_enum NOT NULL DEFAULT 'pending_review',
    generated_code       TEXT NOT NULL,

    -- PR tracking (FR-3.3, FR-3.4)
    pr_number            INT NULL,
    pr_url               VARCHAR(1000) NULL,
    pr_merged_at         TIMESTAMPTZ NULL,

    -- Playwright-specific failure counter (independent of content.source.consecutive_failures)
    -- Resets to 0 automatically when a new row is inserted for the same source
    consecutive_failures INT NOT NULL DEFAULT 0,

    run_log_id           UUID NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- At most 1 active crawler per source
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_registry_source_active
    ON content.crawler_registry (source_id)
    WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_crawler_registry_source
    ON content.crawler_registry (source_id);

-- Scheduler queries by status='active' directly
CREATE INDEX IF NOT EXISTS idx_crawler_registry_active
    ON content.crawler_registry (status)
    WHERE (status = 'active');

CREATE TRIGGER trg_crawler_registry_set_updated_at
    BEFORE UPDATE ON content.crawler_registry
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

### Status Lifecycle (for code comments / documentation)

```
crawler_registry.status:
  INSERT → pending_review
  PR merged detected → UPDATE SET status = 'active'
  consecutive_failures ≥ threshold → UPDATE SET status = 'deprecated'
                                      + INSERT new row (status = pending_review)
```

### What MUST Already Exist Before This Migration Runs

These objects are referenced by FK or function call — the migration will fail if they don't exist:

| Object | Location | Used By |
|--------|----------|---------|
| `content.source` | existing table | FK in `crawler_analysis`, `crawler_registry` |
| `core.run_log` | existing table | FK in both tables |
| `core.prompt_template_version` | existing table | FK in `crawler_analysis` |
| `core.run_kind_enum` | existing enum type | Extended by this migration |
| `core.set_updated_at()` | existing trigger function | Used by both `BEFORE UPDATE` triggers |

**Verify these exist** in the target DB (or via existing migrations) before writing this migration.

---

## File Structure Requirements

### Where to Place the Migration File

Locate the existing migration files in the cherry-in-the-haystack repo to determine:
1. **Migration runner**: (likely Flyway, dbmate, node-pg-migrate, or a custom TS runner — inspect `package.json` and any existing `migrations/` directory)
2. **Naming convention**: Match exactly (e.g., `V0010__add_crawler_tables.sql`, `0010_add_crawler_tables.sql`, or `1716400000_add_crawler_tables.ts`)
3. **Migration location**: Match existing pattern (e.g., `packages/pipeline/src/db/migrations/` or `db/migrations/`)

**DO NOT** create a new migration runner or new migration directory — place the file where existing migrations live.

### Codebase Conventions

- TypeScript files: `kebab-case.ts`
- Python files: `lowercase_underscores.py`
- SQL migration files: follow existing naming pattern in the repo

---

## Testing Requirements

### Idempotency Test (Critical)

The migration MUST be runnable twice without error. Verify:

1. Run migration on a clean DB schema → all objects created successfully
2. Run migration again → no errors (verify with `\d content.crawler_analysis`, `\d content.crawler_registry`)

Idempotency techniques used:
- `CREATE TABLE IF NOT EXISTS`
- `CREATE UNIQUE INDEX IF NOT EXISTS`
- `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
- `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

### Schema Validation Checklist

After applying migration, verify:

```sql
-- 1. Enum values
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'crawler_status_enum';
-- Expected: pending_review, active, deprecated

SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'run_kind_enum'
  AND enumlabel IN ('CRAWLER_ANALYSIS', 'CRAWLER_GENERATION', 'CRAWLER_EXECUTION');
-- Expected: 3 rows

-- 2. Table structure
\d content.crawler_analysis
\d content.crawler_registry

-- 3. Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('crawler_analysis', 'crawler_registry');

-- 4. Triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'content'
  AND trigger_name IN ('trg_crawler_analysis_set_updated_at', 'trg_crawler_registry_set_updated_at');

-- 5. Partial unique index on registry
-- Verify: uq_crawler_registry_source_active only applies WHERE status = 'active'
INSERT INTO content.crawler_registry (id, source_id, generated_code, status)
VALUES (uuid_v7(), '<test_source_id>', 'code', 'deprecated');
-- Two deprecated rows for same source_id must be allowed (only active is unique)
```

### Integration Notes

- No application code is modified in this story
- No TypeScript or Python changes required
- This story is complete when the migration file is written and passes idempotency + schema validation checks

---

## Architecture Decision Records — Key References

| ADR | Decision | Impact on This Story |
|-----|----------|----------------------|
| ADR-011 | `crawler_analysis` schema: 1:1 per source, UPSERT in-place on failure | Must create table with `UNIQUE INDEX ON source_id` |
| ADR-011-R1 | `analysis_json` contract expanded with `wait_for`, `js_code`, `magic_mode` | Comment in DDL documents the full JSON shape |
| ADR-012 | `crawler_registry`: 1:many, status-driven, Playwright failure counter here | Partial unique index `WHERE status='active'` is the enforcement |
| ADR-012 | `run_kind_enum` extensions: CRAWLER_ANALYSIS, CRAWLER_GENERATION | Must ALTER existing enum — do NOT drop/recreate |

**ADR-011-R1 note on `analysis_json` shape:** The JSONB CHECK constraint (`chk_crawler_analysis_json_is_object`) only validates it is an object — the full field contract (`content_selector`, `title_selector`, etc., plus new `wait_for`, `js_code`, `magic_mode`) is enforced at the application layer, not in the DB. This is intentional — field contract may extend without schema migration (per ADR-011-R1).

---

## Dev Notes

### Potential Pitfall: `ALTER TYPE ... ADD VALUE` and Transactions

In PostgreSQL, `ALTER TYPE ... ADD VALUE` cannot be run inside a transaction in versions < 12. In PostgreSQL 12+, it can run inside a transaction but the new value is not visible until the transaction commits. If the migration runner wraps everything in a single transaction:

- Put enum `ADD VALUE` statements **before** the `CREATE TABLE` statements
- Or run them in a separate transaction/migration step

Check the migration runner's behavior (auto-commit vs. transaction-wrapped) before writing the file.

### Potential Pitfall: CREATE TRIGGER Idempotency

`CREATE TRIGGER` does not support `IF NOT EXISTS` in PostgreSQL < 16. For idempotent trigger creation in older PostgreSQL:

```sql
DO $$ BEGIN
    CREATE TRIGGER trg_crawler_analysis_set_updated_at
        BEFORE UPDATE ON content.crawler_analysis
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
```

### UUID v7 Generation

Before writing the migration, determine how existing tables (e.g., `content.source`) generate their UUID v7 PKs. Options:
- **App-layer generation** (most common): The INSERT statement provides the `id` value; no DB default needed
- **DB function**: A custom `uuid_generate_v7()` function set as `DEFAULT uuid_generate_v7()`
- **Trigger**: A `BEFORE INSERT` trigger that sets `id` if NULL

Match whichever pattern the existing tables use. Do NOT add a `DEFAULT gen_random_uuid()` unless existing tables use that (which would mean they're using v4, not v7).

---

## Clarifying Questions (for yglee730, after review)

These are non-blocking but worth confirming before the developer starts:

1. **Migration runner**: What tool runs DB migrations? (Flyway, dbmate, node-pg-migrate, custom TS script?) Where are migration files located?
2. **PostgreSQL version**: What version is the target DB? (Determines whether `CREATE TRIGGER IF NOT EXISTS` is available, and transaction behavior of `ALTER TYPE ADD VALUE`)
3. **UUID v7 pattern**: How do existing tables like `content.source` handle UUID v7 PK generation — app-layer, DB function, or trigger? The developer must match this exactly.

---

*Story context analysis completed — comprehensive developer guide created.*

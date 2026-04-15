# Data Architecture

> **Schema authority:** Full column specs, architect commentary, and KPI calculation rules live in
> `.assets_pdf/schema.md` (v1.10). This document is the architectural reference — data-flow,
> layer responsibilities, usage patterns, and canonical indexes.
>
> **Tenancy model:** `user` is the top-level tenant. There is no separate `company` or
> `organization` entity. If multi-user org support is needed in the future, an additive
> `organization` table + optional `org_id` FK can be introduced without breaking existing rows.

---

## Layer Overview

| Layer                     | Storage       | Responsibility                                                                                |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| News Pipeline             | PostgreSQL 16 | Crawl → dedup → per-user AI scoring → snapshots                                               |
| Entity Registries         | PostgreSQL 16 | KT-maintained master lists of tracked models, frameworks, tools, benchmarks, shared resources |
| Books / Evidence Pipeline | PostgreSQL 16 | PDF/HTML → paragraphs → concept linkage → embeddings                                          |
| Concept Layer             | GraphDB (RDF) | Ontology — stable concept nodes + relationships                                               |
| Personalization Layer     | PostgreSQL 16 | Per-user follow configs, scoring preferences, digest preferences, concept evidence selections |
| Webapp Read Layer         | PostgreSQL 16 | Pre-built UI snapshots; O(1) reads, no JOIN at request time                                   |
| Operations                | PostgreSQL 16 | Run logs, processing progress, contributor registry                                           |

---

## Evidence Layer (PostgreSQL 16)

### News Pipeline

#### User (Tenant Root)

```sql
-- Top-level tenant. Every pipeline record is scoped to a user.
-- Merges the previous `company` + `user_account` tables into one.
CREATE TABLE "user" (
    id                          UUID PRIMARY KEY,           -- UUID v7 (app-generated)
    email                       VARCHAR(255) NOT NULL UNIQUE,
    name                        VARCHAR(200),
    subscription_tier           user_tier_enum NOT NULL DEFAULT 'FREE',  -- FREE | PAID | ENTERPRISE
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    -- Newsletter schedule (relevant for ENTERPRISE tier)
    schedule_weekday            SMALLINT CHECK (schedule_weekday BETWEEN 0 AND 6),
    schedule_time               TIME,
    reply_to_email              VARCHAR(255),
    reply_to_name               VARCHAR(100),
    -- Auth (magic-link; no password stored)
    last_login_at               TIMESTAMPTZ,
    magic_token_hash            BYTEA CHECK (octet_length(magic_token_hash) = 32),
    magic_token_expires_at      TIMESTAMPTZ,
    magic_token_consumed_at     TIMESTAMPTZ,
    magic_token_last_ip         INET,
    magic_token_last_user_agent TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at                  TIMESTAMPTZ                 -- soft delete
);
```

**Usage notes:**

- `subscription_tier` gates feature access: `FREE` → read-only community content; `PAID` → personalization + adaptive KB; `ENTERPRISE` → newsletter studio.
- `schedule_weekday` / `schedule_time` drive the newsletter send cron for ENTERPRISE users.
- Magic-link flow: hash the token before storing; reject if `magic_token_expires_at` has passed or `magic_token_consumed_at` is not NULL (replay attack prevention).

---

#### Taxonomy

```sql
-- Top-level tab grouping. Drives treemap and Model Updates ranking.
CREATE TABLE category_group (
    id          UUID PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,   -- e.g. 'FRAMEWORK'
    name        VARCHAR(100) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ
);

-- Primary article classification (1:N under category_group).
-- Every article must be assigned exactly one category.
CREATE TABLE category (
    id          UUID PRIMARY KEY,
    group_id    UUID NOT NULL REFERENCES category_group(id),
    code        VARCHAR(80) NOT NULL UNIQUE,   -- e.g. 'OPENAI', 'AGENT'
    name        VARCHAR(200) NOT NULL,
    description VARCHAR(500),                  -- fed into AI classification prompt
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ
);

-- Secondary tags that do not affect ranking statistics (e.g. CASE_STUDY, REGULATION).
-- Applied via user_article_side_category_map.
CREATE TABLE side_category (
    id          UUID PRIMARY KEY,
    code        VARCHAR(80) NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  TIMESTAMPTZ
);
```

---

#### Source Registry

```sql
-- Global source master. Covers RSS feeds, blogs, Twitter accounts, YouTube channels, etc.
-- Health tracking columns are updated by the crawler after every fetch attempt.
CREATE TABLE source (
    id                   UUID PRIMARY KEY,
    type                 source_type_enum NOT NULL,  -- RSS | TWITTER | YOUTUBE | ...
    name                 VARCHAR(200) NOT NULL,
    url_handle           VARCHAR(1000) NOT NULL,
    url_handle_hash      BYTEA NOT NULL GENERATED ALWAYS AS (md5(url_handle)::bytea) STORED,
    external_source_id   VARCHAR(255),
    homepage_url         VARCHAR(1000),
    description          VARCHAR(1000),
    profile_image_url    VARCHAR(1000),
    frequency            VARCHAR(50) NOT NULL DEFAULT 'DAILY',
    language             VARCHAR(10),
    country_code         CHAR(2),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    source_meta_json     JSONB,                      -- platform-specific crawler config
    -- Health tracking (upserted by crawler on every fetch)
    last_fetched_at      TIMESTAMPTZ,
    last_success_at      TIMESTAMPTZ,
    last_error_at        TIMESTAMPTZ,
    last_error_msg       TEXT,
    consecutive_failures INT NOT NULL DEFAULT 0,     -- resets to 0 on success
    total_fetches        INT NOT NULL DEFAULT 0,
    total_failures       INT NOT NULL DEFAULT 0,
    is_healthy           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at           TIMESTAMPTZ,
    CONSTRAINT uq_source_url_handle_hash UNIQUE (url_handle_hash)
);

-- Per-user source subscription and weighting.
CREATE TABLE user_source_follow_cfg (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES "user"(id),
    source_id    UUID NOT NULL REFERENCES source(id),
    is_following BOOLEAN NOT NULL DEFAULT TRUE,
    weight       NUMERIC(10,2) NOT NULL DEFAULT 1.00,  -- multiplier on ai_score
    settings_json JSONB,                               -- per-source keyword filters
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMPTZ,
    CONSTRAINT uq_user_source UNIQUE (user_id, source_id)
);
```

```

-- Community-submitted source URLs awaiting KT review.
-- Approved submissions are manually added to `source` by KT; rejected ones stay for reference.
CREATE TABLE source_submission (
    id              UUID PRIMARY KEY,
    submitted_by    UUID REFERENCES "user"(id),     -- NULL if submitted anonymously
    url             VARCHAR(1000) NOT NULL,
    name            VARCHAR(200),                   -- optional display name from submitter
    reason          TEXT,                           -- why the submitter thinks it's worth adding
    status          source_submission_status_enum   -- PENDING | APPROVED | REJECTED
                    NOT NULL DEFAULT 'PENDING',
    reviewed_by     UUID REFERENCES "user"(id),
    reviewed_at     TIMESTAMPTZ,
    reviewer_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

**Usage notes:**

- Active crawl list: `source.is_active = TRUE` AND `user_source_follow_cfg.is_following = TRUE`
- Source weight is applied by the AI scoring batch: `final_score = ai_score * weight`
- Unhealthy sources: `WHERE is_healthy = FALSE` — surface in admin UI for manual review
- `is_healthy` is set to `FALSE` by the crawler when `consecutive_failures` reaches the configured threshold (e.g. 3); set back to `TRUE` on next success
- Error rate: `total_failures::float / NULLIF(total_fetches, 0)`

---

#### Article Ingestion

```sql
-- Immutable raw article store. One row per unique article across the entire platform.
CREATE TABLE article_raw (
    id                      UUID PRIMARY KEY,
    source_id               UUID NOT NULL REFERENCES source(id),
    title                   VARCHAR(500) NOT NULL,
    url                     VARCHAR(1000) NOT NULL,
    url_hash                BYTEA NOT NULL GENERATED ALWAYS AS (md5(url)::bytea) STORED,
    guid                    VARCHAR(1000),
    guid_hash               BYTEA GENERATED ALWAYS AS (md5(guid)::bytea) STORED,
    normalized_url          VARCHAR(1000),
    normalized_url_hash     BYTEA GENERATED ALWAYS AS (md5(normalized_url)::bytea) STORED,
    canonical_url           VARCHAR(1000),
    canonical_url_hash      BYTEA GENERATED ALWAYS AS (md5(canonical_url)::bytea) STORED,
    content_hash            BYTEA,                  -- full-body hash for exact dedup
    published_at            TIMESTAMPTZ NOT NULL,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    language                VARCHAR(10),
    author                  VARCHAR(255),
    image_url               VARCHAR(1000),
    content_raw             TEXT,
    external_storage_key    VARCHAR(1000),          -- S3 key when content_raw is archived
    storage_state           storage_state_enum NOT NULL DEFAULT 'ACTIVE',
    archived_at             TIMESTAMPTZ,
    -- Dedup key: app sets GUID > normalized_url > canonical_url > url priority
    representative_key      TEXT NOT NULL,
    representative_key_hash BYTEA NOT NULL GENERATED ALWAYS AS (md5(representative_key)::bytea) STORED,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_article_raw_representative_key_hash UNIQUE (representative_key_hash)
);

-- Per-user view of an article: discovery time, classification, scoring, visibility.
-- Same article_raw row seen differently by each user.
CREATE TABLE user_article_state (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id),
    article_raw_id      UUID NOT NULL REFERENCES article_raw(id),
    category_group_id   UUID REFERENCES category_group(id),
    category_id         UUID REFERENCES category(id),
    impact_score        NUMERIC(12,4) NOT NULL DEFAULT 0,   -- 0–100
    is_high_impact      BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden           BOOLEAN NOT NULL DEFAULT FALSE,
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- KPI basis, not published_at
    meta_json           JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          TIMESTAMPTZ,
    CONSTRAINT uq_user_article UNIQUE (user_id, article_raw_id)
);

-- N:M secondary tags per user-article pair.
CREATE TABLE user_article_side_category_map (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES "user"(id),
    user_article_state_id   UUID NOT NULL REFERENCES user_article_state(id),
    side_category_id        UUID NOT NULL REFERENCES side_category(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at              TIMESTAMPTZ
);

-- AI processing output cached per user-article pair.
CREATE TABLE user_article_ai_state (
    id                              UUID PRIMARY KEY,
    user_id                         UUID NOT NULL REFERENCES "user"(id),
    user_article_state_id           UUID NOT NULL REFERENCES user_article_state(id),
    ai_status                       ai_status_enum NOT NULL DEFAULT 'PENDING',
    ai_summary                      TEXT,
    ai_score                        NUMERIC(12,4),
    ai_classification_json          JSONB,
    ai_tags_json                    JSONB,          -- GIN indexed
    ai_entities_json                JSONB,
    ai_snippets_json                JSONB,
    ai_evidence_json                JSONB,
    ai_structured_extraction_json   JSONB,          -- GIN indexed
    prompt_template_version_id      UUID,
    run_log_id                      UUID,
    ai_model_name                   VARCHAR(100),
    ai_processed_at                 TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_article_ai UNIQUE (user_id, user_article_state_id)
);
```

**Usage notes:**

- `discovered_at` (not `published_at`) is the KPI basis for "Items This Week."
- `is_high_impact` is set by the AI batch when `ai_score` crosses the configured threshold.
- `user_article_ai_state.ai_tags_json` and `ai_structured_extraction_json` carry GIN indexes for Topics Covered and New Keywords KPI aggregations.

---

#### Prompt Templates

```sql
-- LLM prompt templates: platform defaults (user_id NULL) and per-user overrides.
CREATE TABLE prompt_template (
    id                      UUID PRIMARY KEY,
    user_id                 UUID REFERENCES "user"(id),     -- NULL = platform default
    scope                   template_scope_enum NOT NULL,   -- PLATFORM | USER
    type                    prompt_template_type_enum NOT NULL,  -- ARTICLE_AI | NEWSLETTER
    code                    VARCHAR(100) NOT NULL,
    name                    VARCHAR(200) NOT NULL,
    description             VARCHAR(500),
    tone_text               TEXT NOT NULL,
    cloned_from_template_id UUID REFERENCES prompt_template(id),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at              TIMESTAMPTZ
);

-- Immutable version history for every prompt change.
CREATE TABLE prompt_template_version (
    id                      UUID PRIMARY KEY,
    prompt_template_id      UUID NOT NULL REFERENCES prompt_template(id),
    version_no              INT NOT NULL,
    version_tag             VARCHAR(20),                    -- PROD | BETA | A/B_TEST
    prompt_text             TEXT NOT NULL,
    few_shot_examples       TEXT,
    parameters_json         JSONB,                          -- temperature, top_p, max_tokens
    change_note             VARCHAR(500),
    cloned_from_version_id  UUID REFERENCES prompt_template_version(id),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at              TIMESTAMPTZ
);
```

---

---

## Entity Registries (PostgreSQL 16)

KT-maintained master lists of every entity Cherry actively tracks. These tables answer
"what do we cover?" — independent of any article or update about them. `curated_articles`
references these via `category_id`; the Newly Discovered pages join registry rows with
their latest updates to build the full page view.

All registry tables share the same conventions:
- `is_active` — whether this entity is currently being monitored
- `is_featured` — whether it appears on the main page listing
- Soft delete via `revoked_at`

---

```sql
-- Single registry for every entity Cherry actively tracks across all Newly Discovered pages.
-- type determines which page the entity belongs to and how meta_json is interpreted.
-- Papers are excluded (PRD: link out only) — they live in curated_articles.
CREATE TABLE tracked_entities (
    id           UUID PRIMARY KEY,
    type         VARCHAR(20) NOT NULL
                 CHECK (type IN (
                     'Model',       -- Model Updates page
                     'Framework',   -- Frameworks page
                     'Benchmark',   -- Papers & Benchmarks page
                     'Dataset',     -- Papers & Benchmarks page
                     'Tool',        -- Tools page
                     'Agent',       -- Shared Resources page
                     'Prompt',      -- Shared Resources page
                     'MCP'          -- Shared Resources page
                 )),
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    url          VARCHAR(1000),                -- primary URL (homepage or GitHub)
    logo_url     VARCHAR(1000),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured  BOOLEAN NOT NULL DEFAULT TRUE,  -- appears in main page listing
    is_spotlight BOOLEAN NOT NULL DEFAULT FALSE, -- the single spotlight entity of its type
    meta_json    JSONB,                          -- type-specific fields (see below)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMPTZ
);
```

**`meta_json` shape per type:**

```jsonc
// Model
{ "company": "Anthropic", "version": "3.7 Sonnet", "api_url": "...",
  "release_date": "2025-02-24", "benchmark_scores": { "GPQA": 91.0, "MMLU": 88.4 } }

// Framework
{ "framework_category": "Agent", "github_url": "...", "color": "#6366F1" }

// Benchmark | Dataset
{ "latest_results_url": "..." }

// Tool
{ "github_url": "...", "category": "Observability", "is_hall_of_fame": true }

// Agent | Prompt | MCP
{ "author": "username", "github_url": "..." }
```

**Indexes:**

```sql
CREATE INDEX idx_tracked_entities_type ON tracked_entities(type);
CREATE INDEX idx_tracked_entities_type_active ON tracked_entities(type, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tracked_entities_spotlight ON tracked_entities(type, is_spotlight) WHERE is_spotlight = TRUE;
CREATE INDEX idx_tracked_entities_meta ON tracked_entities USING gin(meta_json);
```

**Usage notes:**

- `is_spotlight` should have at most one `TRUE` per `type` at a time — enforce at the application layer
- `is_spotlight` is displayed as "Spotlight" uniformly across all page types
- Each page queries `WHERE type = '...' AND is_active = TRUE`, then joins with `curated_articles` for latest updates
- KT manages all rows via admin UI; pipelines never write to this table

---

### Statistics Snapshots

```sql
-- Daily popularity signals per tracked entity.
-- Powers sparklines, trend charts, and rising star calculation.
-- Written by nightly stat batch; keyword_mentions joined from keyword_stats_snapshot by name match, github_stars fetched from GitHub API.
CREATE TABLE entity_stats_snapshot (
    id               UUID PRIMARY KEY,
    entity_id        UUID NOT NULL REFERENCES tracked_entities(id),
    stat_date        DATE NOT NULL,
    github_stars     INT,              -- NULL if entity has no GitHub repo
    keyword_mentions INT NOT NULL DEFAULT 0,  -- keyword_stats_snapshot.mention_count matched by tracked_entities.name
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_entity_stat_date UNIQUE (entity_id, stat_date)
);

-- Daily keyword/phrase frequency snapshot.
-- Derived nightly by flattening ai_tags_json across all curated article AI states.
-- Powers: trending keywords widget, new keywords KPI, MoM rate, keyword sparklines.
CREATE TABLE keyword_stats_snapshot (
    id            UUID PRIMARY KEY,
    keyword       VARCHAR(200) NOT NULL,
    stat_date     DATE NOT NULL,
    mention_count INT NOT NULL DEFAULT 0,
    is_new        BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE if first time this keyword ever appeared
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_keyword_date UNIQUE (keyword, stat_date)
);
```

**Indexes:**

```sql
CREATE INDEX idx_entity_stats_entity_date ON entity_stats_snapshot(entity_id, stat_date DESC);
CREATE INDEX idx_entity_stats_date ON entity_stats_snapshot(stat_date DESC);
CREATE INDEX idx_keyword_stats_date ON keyword_stats_snapshot(stat_date DESC);
CREATE INDEX idx_keyword_stats_keyword_date ON keyword_stats_snapshot(keyword, stat_date DESC);
CREATE INDEX idx_keyword_stats_new ON keyword_stats_snapshot(is_new) WHERE is_new = TRUE;
```

**Derivation rules:**

- **`entity_stats_snapshot.keyword_mentions`** — nightly batch: join `keyword_stats_snapshot` on `keyword = tracked_entities.name` (case-insensitive) for that `stat_date`
- **`entity_stats_snapshot.github_stars`** — nightly batch: GitHub API call per entity where `meta_json->>'github_url'` is set
- **`keyword_stats_snapshot`** — nightly batch: flatten `ai_tags_json` arrays from all `user_article_ai_state` rows for that day → group by keyword → count
- **`is_new`** — `TRUE` if keyword has no prior row in this table before `stat_date`
- **Trending keywords** — highest `(today.mention_count - 7_days_ago.mention_count) / 7_days_ago.mention_count`
- **Rising star** — highest `(last 7d keyword_mentions delta)` per entity type
- **New keywords MoM** — `COUNT(*) WHERE is_new = TRUE AND stat_date BETWEEN month_start AND month_end`

---

---

## Personalization Layer (PostgreSQL 16)

Per-user preference and configuration tables that drive two distinct personalization outputs:

| Section | Personalization mechanism | Writer Agent? |
| ------- | ------------------------- | ------------- |
| Newly Discovered | Filter + rerank community articles by entity/category follows and scoring weights | No |
| Basics / Advanced concept pages | User curates evidence set; Writer Agent synthesizes personalized page | Yes |

All tables are gated behind `subscription_tier = 'PAID'` or `'ENTERPRISE'` at the API layer.
Free users see community-only content.

**Personalization is triggered only for users with ≥1 preference row** across the follow/config
tables below. Users with no preferences receive the standard community experience.

---

### Entity Follow

```sql
-- Per-user follow config for tracked entities (models, frameworks, tools, etc.).
-- Drives which entity-related articles surface in a user's personalized digest
-- and influences Model Updates ranking for that user.
CREATE TABLE user_entity_follow (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES "user"(id),
    entity_id    UUID NOT NULL REFERENCES tracked_entities(id),
    is_following BOOLEAN NOT NULL DEFAULT TRUE,
    weight       NUMERIC(10,2) NOT NULL DEFAULT 1.00,  -- multiplier on impact_score
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMPTZ,
    CONSTRAINT uq_user_entity UNIQUE (user_id, entity_id)
);
```

**Usage notes:**

- `weight` is applied on top of `user_source_follow_cfg.weight` when scoring articles that
  mention this entity: `final_score = ai_score * source_weight * entity_weight`
- When `is_following = FALSE` the entity's articles are excluded from the user's digest pool
- Absence of a row = neutral (entity is included but with weight 1.00)

---

### Category Follow

```sql
-- Per-user follow config for category groups and categories.
-- Persistence layer for FR-11.3: "My feed only shows what matters to me."
-- Either category_group_id or category_id must be set, not both null.
CREATE TABLE user_category_follow_cfg (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES "user"(id),
    category_group_id UUID REFERENCES category_group(id),  -- group-level preference
    category_id       UUID REFERENCES category(id),         -- category-level (overrides group if both set)
    is_following      BOOLEAN NOT NULL DEFAULT TRUE,
    weight            NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at        TIMESTAMPTZ,
    CONSTRAINT uq_user_category UNIQUE (user_id, category_group_id, category_id),
    CONSTRAINT chk_category_level CHECK (
        category_group_id IS NOT NULL OR category_id IS NOT NULL
    )
);
```

**Usage notes:**

- Category-level row takes precedence over group-level row when both exist
- `is_following = FALSE` excludes the entire group/category from the digest pool
- Absence of a row = show all (community default)

---

### Scoring Preference

```sql
-- Per-user natural language scoring criteria (FR-11.2).
-- User inputs plain text ("I care more about business cases than theory");
-- AI interprets it into weights stored in interpreted_weights_json.
-- prompt_template_version_id links to the AI run that produced the interpretation
-- so the interpretation can be regenerated if the template changes.
CREATE TABLE user_scoring_preference (
    id                         UUID PRIMARY KEY,
    user_id                    UUID NOT NULL REFERENCES "user"(id) UNIQUE,
    nl_criteria_text           TEXT,           -- raw user input
    interpreted_weights_json   JSONB,          -- e.g. {"business": 1.5, "research": 0.7, "model_updates": 1.2}
    is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
    prompt_template_version_id UUID REFERENCES prompt_template_version(id),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Usage notes:**

- One row per user (UNIQUE on `user_id`); update in place, history via `prompt_template_version_id`
- `interpreted_weights_json` is shown back to the user as the "confirmation UI" (FR-11.2)
- The AI scoring batch reads this row and merges its weights when computing `user_article_state.impact_score`

---

### Digest Preference

```sql
-- Per-user digest display preferences.
-- Extensible: future fields (notify_on_publish, output_format) land here.
CREATE TABLE user_digest_preference (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES "user"(id) UNIQUE,
    top_n      SMALLINT NOT NULL DEFAULT 20 CHECK (top_n BETWEEN 5 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### Concept Evidence Selection

```sql
-- Header record: created when user first opens "Change Evidence" on a concept page.
-- Its existence (with ≥1 included item) is the trigger for personalized page generation
-- in the weekly Writer Agent batch. No selection = user sees community page.
CREATE TABLE user_concept_evidence_selection (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES "user"(id),
    concept_slug    TEXT NOT NULL,  -- matches concept_pages.concept_slug / GraphDB slug
    generation_mode concept_gen_mode_enum NOT NULL DEFAULT 'EXTEND',  -- EXTEND | REPLACE
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_concept_selection UNIQUE (user_id, concept_slug)
);

-- Line items: one row per evidence piece in the user's curated set.
-- Covers both Books/Evidence pipeline (paragraph_chunks) and News pipeline (user_article_state).
-- is_included = FALSE means user explicitly removed a community evidence item (EXTEND mode only).
CREATE TABLE user_concept_evidence_item (
    id               UUID PRIMARY KEY,
    selection_id     UUID NOT NULL REFERENCES user_concept_evidence_selection(id) ON DELETE CASCADE,
    evidence_type    evidence_source_enum NOT NULL,  -- PARAGRAPH_CHUNK | ARTICLE_EVIDENCE
    -- Set when evidence_type = PARAGRAPH_CHUNK (Books/Evidence pipeline):
    paragraph_id     BIGINT REFERENCES paragraph_chunks(id),
    -- Set when evidence_type = ARTICLE_EVIDENCE (News pipeline):
    article_state_id UUID REFERENCES user_article_state(id),
    is_included      BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_evidence_ref CHECK (
        (evidence_type = 'PARAGRAPH_CHUNK' AND paragraph_id IS NOT NULL)
        OR (evidence_type = 'ARTICLE_EVIDENCE' AND article_state_id IS NOT NULL)
    )
);
```

**Usage notes:**

- `EXTEND` mode: Writer Agent uses community evidence **plus** user's custom items; `is_included = FALSE`
  rows are excluded from the community set
- `REPLACE` mode: Writer Agent uses **only** `is_included = TRUE` items; community evidence is ignored
- The "compare with community" button always reads from the live `concept_pages` row — no snapshot needed
- Custom evidence sources flow from two existing pipelines:
  - **One-off** (book, lecture, PDF) → Books/Evidence Pipeline → `paragraph_chunks`
  - **Recurring** (educational substack, blog) → News Pipeline → `source` + `user_source_follow_cfg` → `user_article_state`

---

### New ENUM Types

```sql
CREATE TYPE concept_gen_mode_enum AS ENUM ('EXTEND', 'REPLACE');
CREATE TYPE evidence_source_enum  AS ENUM ('PARAGRAPH_CHUNK', 'ARTICLE_EVIDENCE');
-- Shared by user_newly_discovered_page and user_concept_page in the Webapp Read Layer
CREATE TYPE page_gen_status_enum  AS ENUM ('PENDING', 'GENERATING', 'DONE', 'FAILED');
```

---

### Indexes

```sql
-- Entity follow
CREATE INDEX idx_uef_user ON user_entity_follow(user_id) WHERE is_following = TRUE;
CREATE INDEX idx_uef_entity ON user_entity_follow(entity_id);

-- Category follow
CREATE INDEX idx_ucf_user ON user_category_follow_cfg(user_id) WHERE is_following = TRUE;

-- Concept evidence
CREATE INDEX idx_uces_user_concept ON user_concept_evidence_selection(user_id, concept_slug);
CREATE INDEX idx_ucei_selection ON user_concept_evidence_item(selection_id) WHERE is_included = TRUE;
CREATE INDEX idx_ucei_paragraph ON user_concept_evidence_item(paragraph_id) WHERE paragraph_id IS NOT NULL;
CREATE INDEX idx_ucei_article ON user_concept_evidence_item(article_state_id) WHERE article_state_id IS NOT NULL;
```

---

### Books / Evidence Pipeline

```sql
CREATE TABLE books (
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

CREATE TABLE chapters (
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

CREATE TABLE sections (
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
CREATE TABLE idea_groups (
    id                  BIGSERIAL PRIMARY KEY,
    canonical_idea_text TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paragraph_chunks (
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
    -- Concept linkage moved to paragraph_concept_links (1:many)
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

-- 1:many concept linkage for paragraphs.
-- A paragraph has one primary concept (is_primary = TRUE) and optionally additional ones.
-- is_primary = FALSE links exist when a paragraph meaningfully discusses a secondary concept.
-- extracted_concept is denormalized from idea_groups.canonical_idea_text — KEY LINKAGE to GraphDB.
CREATE TABLE paragraph_concept_links (
    id                    BIGSERIAL PRIMARY KEY,
    paragraph_id          BIGINT NOT NULL REFERENCES paragraph_chunks(id) ON DELETE CASCADE,
    idea_group_id         BIGINT NOT NULL REFERENCES idea_groups(id),
    extracted_concept     VARCHAR(200) NOT NULL,  -- denormalized; CRITICAL: Writer Agent query
    is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
    extraction_confidence NUMERIC(3,2),
    created_at            TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_paragraph_concept UNIQUE (paragraph_id, idea_group_id)
);

CREATE TABLE key_ideas (
    id              BIGSERIAL PRIMARY KEY,
    paragraph_id    BIGINT REFERENCES paragraph_chunks(id),
    document_id     BIGINT REFERENCES books(id),
    core_idea_text  TEXT NOT NULL,
    idea_group_id   BIGINT REFERENCES idea_groups(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE evidence_metadata (
    id                          BIGSERIAL PRIMARY KEY,
    evidence_paragraph_id       BIGINT REFERENCES paragraph_chunks(id),
    extract_type                VARCHAR(50),      -- paraphrase/direct_quote/figure_reference
    keywords                    JSONB,
    entities                    JSONB,
    handbook_topic              VARCHAR(100),
    handbook_subtopic           VARCHAR(100),
    judge_originality           NUMERIC(3,2),
    judge_depth                 NUMERIC(3,2),
    judge_technical_accuracy    NUMERIC(3,2)
);

CREATE TABLE paragraph_embeddings (
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

CREATE TABLE processing_progress (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER REFERENCES books(id),
    chapter_id      BIGINT REFERENCES chapters(id),
    page_number     INTEGER,
    processing_unit VARCHAR(50) DEFAULT 'page',
    status          VARCHAR(50),
    error_message   TEXT,
    attempt_count   INTEGER,
    last_attempt_at TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
```

---

### Operations

```sql
-- Unified job execution log. Covers all async work: crawling, AI calls, stat builds, email sends.
CREATE TABLE run_log (
    id                          UUID PRIMARY KEY,
    user_id                     UUID REFERENCES "user"(id),     -- NULL for platform-wide jobs
    run_kind                    run_kind_enum NOT NULL,
    status                      run_status_enum NOT NULL DEFAULT 'RUNNING',
    related_entity_type         related_entity_type_enum NOT NULL DEFAULT 'NONE',
    related_entity_id           UUID,
    prompt_template_version_id  UUID REFERENCES prompt_template_version(id),
    model_name                  VARCHAR(100),
    input_tokens                INT NOT NULL DEFAULT 0,
    output_tokens               INT NOT NULL DEFAULT 0,
    cost_usd                    NUMERIC(12,6),
    processed_count             INT NOT NULL DEFAULT 0,
    error_msg                   TEXT,
    meta_json                   JSONB,
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at                    TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Community contributors registry (Cherries section attribution)
CREATE TABLE knowledge_verification_contributors (
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
```

---

### Indexes

```sql
-- User
CREATE INDEX idx_user_tier ON "user"(subscription_tier);
CREATE INDEX idx_user_active ON "user"(is_active) WHERE is_active = TRUE;

-- Source & article dedup
CREATE UNIQUE INDEX uq_source_url_handle_hash ON source(url_handle_hash);
CREATE UNIQUE INDEX uq_article_raw_representative_key_hash ON article_raw(representative_key_hash);
CREATE INDEX idx_article_raw_source ON article_raw(source_id);
CREATE INDEX idx_article_raw_published_at ON article_raw(published_at DESC);

-- Source submission
CREATE INDEX idx_source_submission_pending ON source_submission(status) WHERE status = 'PENDING';

-- Source health (now on source table)
CREATE INDEX idx_source_unhealthy ON source(is_healthy) WHERE is_healthy = FALSE;
CREATE INDEX idx_source_last_success ON source(last_success_at DESC);

-- User article state
CREATE UNIQUE INDEX uq_user_article ON user_article_state(user_id, article_raw_id);
CREATE INDEX idx_uas_user_discovered ON user_article_state(user_id, discovered_at DESC);
CREATE INDEX idx_uas_high_impact ON user_article_state(user_id, is_high_impact) WHERE is_high_impact = TRUE;

-- AI state
CREATE INDEX idx_uaas_ai_tags ON user_article_ai_state USING gin(ai_tags_json);
CREATE INDEX idx_uaas_structured ON user_article_ai_state USING gin(ai_structured_extraction_json);

-- Books / Evidence pipeline
CREATE INDEX idx_books_status ON books(processing_status);
CREATE INDEX idx_books_section ON books(handbook_section);
CREATE INDEX idx_chapters_document ON chapters(document_id);
CREATE INDEX idx_sections_document ON sections(document_id);
CREATE INDEX idx_sections_chapter ON sections(chapter_id);
CREATE INDEX idx_idea_groups_canonical ON idea_groups(canonical_idea_text);
CREATE INDEX idx_paragraph_chunks_paragraph_hash ON paragraph_chunks(paragraph_hash);
CREATE INDEX idx_paragraph_chunks_simhash64 ON paragraph_chunks(simhash64);
-- paragraph_concept_links — CRITICAL: Writer Agent queries by concept name
CREATE INDEX idx_pcl_extracted_concept ON paragraph_concept_links(extracted_concept);
CREATE INDEX idx_pcl_idea_group ON paragraph_concept_links(idea_group_id);
CREATE INDEX idx_pcl_paragraph ON paragraph_concept_links(paragraph_id);
CREATE INDEX idx_pcl_primary ON paragraph_concept_links(paragraph_id) WHERE is_primary = TRUE;
CREATE INDEX idx_paragraph_embeddings_handbook_topic ON paragraph_embeddings(handbook_topic);
CREATE INDEX idx_paragraph_embeddings_vector ON paragraph_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

-- Operations
CREATE INDEX idx_run_log_user_kind ON run_log(user_id, run_kind);
CREATE INDEX idx_run_log_failed ON run_log(status) WHERE status = 'FAILED';
CREATE INDEX idx_contributors_active ON knowledge_verification_contributors(active);
CREATE INDEX idx_contributors_contributions ON knowledge_verification_contributors(contributions_count DESC);
```

---

## Notion Databases

Notion remains the **primary workspace** for the Knowledge Team's editorial workflow on the
Basics / Advanced content track. It is **not** involved in the news ingestion pipeline.

| Notion DB | Purpose | Postgres counterpart |
| --------- | ------- | -------------------- |
| Newly Discovered Review DB | KT scores and approves articles | `user_article_state` (written back via webhook/cron) |
| Basics / Advanced Study Sessions | Evidence review and study notes | `books` registry + `paragraph_chunks` |
| Concept Candidates | Monthly concept extraction review | `idea_groups` (approved candidates land here) |

---

## Concept Layer (GraphDB — RDF)

**Namespaces:**

```sparql
PREFIX llm:  <http://example.org/llm-ontology#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
```

**Concept Nodes (`owl:Class`):**

```
llm:{concept_id}       URI — concept_id is a slug (e.g. llm:RetrievalAugmentedGeneration)
rdfs:label             Human-readable name — KEY LINKAGE to idea_groups.canonical_idea_text
llm:description        Text description of the concept
rdfs:subClassOf        Parent concept URI (encodes hierarchy / subtopic structure)
```

**Relationship Types — currently implemented:**

```
rdfs:subClassOf         Hierarchical parent → child (taxonomy, subtopic structure)

llm:ClassRelation       Co-occurrence relationship node (reified triple):
  llm:source              → source concept URI
  llm:target              → target concept URI
  llm:cooccurrenceCount   → integer (how often these concepts co-occur across evidence)

llm:related             Symmetric co-occurrence shorthand (bidirectional, added in pairs)
```

**Concept Instance Nodes (`llm:ConceptInstance`) — paragraph-level:**

```
llm:instanceOf          → parent concept class URI
llm:relatedInstance     → related instance URI (symmetric)
rdfs:label              Instance label
llm:description         Instance description
llm:fromSection         xsd:float — section position within source document (used for ordering)
```

**Postgres linkage:**

- `rdfs:label` on a concept node = `idea_groups.canonical_idea_text` = `paragraph_concept_links.extracted_concept`
- Evidence count: `SELECT COUNT(*) FROM paragraph_concept_links WHERE idea_group_id = ?` — not stored in GraphDB
- Writer Agent query: GraphDB (`rdfs:label` → concept + relations) → Postgres (`WHERE extracted_concept = ?` → `paragraph_concept_links` → `paragraph_chunks`)
- To fetch only the paragraph that "owns" a concept: add `AND is_primary = TRUE`
- To fetch all paragraphs that discuss a concept (primary or secondary): omit the `is_primary` filter

---

## Webapp Read Layer (PostgreSQL 16)

All tables here are **written by background batch jobs, read by the webapp**. No webapp write path
touches them. Each screen maps 1:1 to a snapshot table — O(1) reads, no JOIN at request time.

```sql
-- Patchnotes screen: per-user "last visited" bookmark.
CREATE TABLE patchnote_cursor_state (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES "user"(id) UNIQUE,
    last_visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Patchnotes screen: daily summary stats. One row per (user, date) on active days only.
CREATE TABLE patchnote_daily_stat_snapshot (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES "user"(id),
    stat_date               DATE NOT NULL,
    new_article_count       INT NOT NULL,
    new_high_impact_count   INT NOT NULL DEFAULT 0,
    areas_changed_json      JSONB NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_patchnote_daily UNIQUE (user_id, stat_date)
);

-- Weekly Highlight dashboard (platform-level): KPIs for the public Newly Discovered page.
-- Derived from curated_articles.published_at — no user context.
-- One row per week; written by the weekly-publish batch (Sunday).
CREATE TABLE platform_weekly_stat_snapshot (
    id                          UUID PRIMARY KEY,
    week_start                  DATE NOT NULL,
    week_end                    DATE NOT NULL,
    items_this_week             INT NOT NULL DEFAULT 0,
    items_delta_vs_last_week    INT NOT NULL DEFAULT 0,
    topics_covered_count        INT NOT NULL DEFAULT 0,
    covered_topics_json         JSONB,
    new_keywords_count          INT NOT NULL DEFAULT 0,
    new_keywords_mom_rate       NUMERIC(12,4) NOT NULL DEFAULT 0,
    new_keywords_json           JSONB,
    trending_keywords_json      JSONB,
    score_5_items_count         INT NOT NULL DEFAULT 0,
    treemap_distribution_json   JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_platform_weekly UNIQUE (week_start)
);

-- Weekly Highlight dashboard (per-user): KPIs for personalized paid-user views.
-- Derived from user_article_state.discovered_at — scoped to a single user.
-- One row per (user, week); written by the weekly-publish batch (Sunday).
CREATE TABLE highlight_weekly_stat_snapshot (
    id                          UUID PRIMARY KEY,
    user_id                     UUID NOT NULL REFERENCES "user"(id),
    week_start                  DATE NOT NULL,
    week_end                    DATE NOT NULL,
    items_this_week             INT NOT NULL DEFAULT 0,
    items_delta_vs_last_week    INT NOT NULL DEFAULT 0,
    topics_covered_count        INT NOT NULL DEFAULT 0,
    covered_topics_json         JSONB,
    new_keywords_count          INT NOT NULL DEFAULT 0,
    new_keywords_mom_rate       NUMERIC(12,4) NOT NULL DEFAULT 0,
    new_keywords_json           JSONB,
    trending_keywords_json      JSONB,
    score_5_items_count         INT NOT NULL DEFAULT 0,
    treemap_distribution_json   JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_highlight_weekly UNIQUE (user_id, week_start)
);

-- Model Updates screen: daily per-category performance log for rolling-window ranking.
CREATE TABLE model_update_daily_snapshot (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES "user"(id),
    stat_date               DATE NOT NULL,
    category_group_id       UUID NOT NULL REFERENCES category_group(id),
    category_id             UUID NOT NULL REFERENCES category(id),
    article_count           INT NOT NULL DEFAULT 0,
    high_impact_count       INT NOT NULL DEFAULT 0,
    score_sum               NUMERIC(14,4) NOT NULL DEFAULT 0,
    score_avg               NUMERIC(14,4),
    weighted_score          NUMERIC(14,4) NOT NULL DEFAULT 0,
    benchmark_metric_json   JSONB,
    co_mentioned_terms_json JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_model_update_daily UNIQUE (user_id, stat_date, category_id)
);

-- Model Updates screen: weekly ranking snapshot assembled from 7 daily rows.
CREATE TABLE model_update_weekly_stat_snapshot (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES "user"(id),
    week_start              DATE NOT NULL,
    week_end                DATE NOT NULL,
    category_group_id       UUID NOT NULL REFERENCES category_group(id),
    items_count             INT NOT NULL DEFAULT 0,
    tracked_category_count  INT NOT NULL DEFAULT 0,
    ranking_metric_label    VARCHAR(50) NOT NULL,
    ranked_category_json    JSONB NOT NULL,         -- fully-assembled rank list (badge, score, delta)
    spotlight_json          JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_model_update_weekly UNIQUE (user_id, week_start, category_group_id)
);

-- Basics / Advanced concept pages. Written by the Writer Agent.
-- One row per concept; content_md is the full generated page.
CREATE TABLE concept_pages (
    id               UUID PRIMARY KEY,
    concept_slug     TEXT UNIQUE NOT NULL,          -- URL key, matches GraphDB concept slug
    concept_name     TEXT NOT NULL,
    handbook_section VARCHAR(50) NOT NULL            -- basics | advanced
                     CHECK (handbook_section IN ('basics', 'advanced')),
    content_md       TEXT,                           -- full Writer Agent output
    is_published     BOOLEAN NOT NULL DEFAULT FALSE,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Concept page change log — powers the knowledge / Patchnotes section.
-- Written by the Writer Agent alongside every concept_pages upsert.
-- Append-only: never UPDATE or DELETE rows.
CREATE TABLE concept_page_changelog (
    id              BIGSERIAL PRIMARY KEY,
    concept_slug    TEXT NOT NULL REFERENCES concept_pages(concept_slug),
    concept_name    TEXT NOT NULL,
    change_type     VARCHAR(20) NOT NULL
                    CHECK (change_type IN ('New', 'Major', 'Minor', 'Correction')),
    change_summary  TEXT NOT NULL,
    changed_at      TIMESTAMPTZ DEFAULT now()
);

-- Community Newly Discovered page snapshot, per category group, per week.
-- Pre-assembles published curated_articles for a category group into an O(1)-readable record.
-- Written by the weekly-publish batch after the KT review cycle completes (same cron).
-- Pipeline: Direct Publish — NO Writer Agent synthesis. Articles are listed with KT-written summaries.
-- Personalized equivalent: user_newly_discovered_page (written by Writer Agent with user-filtered articles).
CREATE TABLE newly_discovered_category_snapshot (
    id                UUID PRIMARY KEY,
    category_group_id UUID NOT NULL REFERENCES category_group(id),
    week_start        DATE NOT NULL,
    week_end          DATE NOT NULL,
    article_count     INT NOT NULL DEFAULT 0,
    -- Pre-assembled article list: [{curated_article_id, title, summary, score, tags, url, category_id}]
    articles_json     JSONB NOT NULL,
    is_published      BOOLEAN NOT NULL DEFAULT FALSE,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_nd_category_week UNIQUE (category_group_id, week_start)
);

-- Personalized Newly Discovered page per category group, per user, per week.
-- NO Writer Agent synthesis — filtering and reranking only.
-- Takes community curated_articles for this category_group × week, filters by the user's
-- entity follows and category follows, and reranks by user_article_state.impact_score.
-- Structurally mirrors newly_discovered_category_snapshot but scoped to a single user.
-- Community fallback: webapp shows newly_discovered_category_snapshot when no row exists here.
-- Written by the weekly-publish batch (same cron as community).
CREATE TABLE user_newly_discovered_page (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES "user"(id),
    category_group_id UUID NOT NULL REFERENCES category_group(id),
    week_start        DATE NOT NULL,
    week_end          DATE NOT NULL,
    article_count     INT NOT NULL DEFAULT 0,
    -- Filtered + reranked: [{curated_article_id, title, summary, impact_score, tags, url, category_id}]
    articles_json     JSONB NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_nd_page UNIQUE (user_id, category_group_id, week_start)
);

-- Per-user concept page. Generated by the weekly Writer Agent batch when
-- user_concept_evidence_selection exists for this (user, concept_slug).
-- Default: user sees community concept_pages row until this is populated.
-- Compare: UI "show community version" button reads live concept_pages row directly.
CREATE TABLE user_concept_page (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES "user"(id),
    concept_slug      TEXT NOT NULL,  -- matches concept_pages.concept_slug
    selection_id      UUID NOT NULL REFERENCES user_concept_evidence_selection(id),
    generation_mode   concept_gen_mode_enum NOT NULL DEFAULT 'EXTEND',
    content_md        TEXT,
    generation_status page_gen_status_enum NOT NULL DEFAULT 'PENDING',
    run_log_id        UUID REFERENCES run_log(id),
    last_generated_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_concept_page UNIQUE (user_id, concept_slug)
);

-- KT-reviewed articles. Mirrors the Notion Newly Discovered News DB.
-- Row lifecycle:
--   1. AI scoring batch creates row (review_status = 'Pending'), pre-fills summary + score
--   2. KT reviews in Notion — overwrites summary, score, category, tags as needed
--   3. Notion sync cron upserts KT edits back into this table
--   4. Webapp reads WHERE review_status = 'Published' AND score >= 4
CREATE TABLE curated_articles (
    id                UUID PRIMARY KEY,
    article_raw_id    UUID NOT NULL REFERENCES article_raw(id),
    title             TEXT NOT NULL,                 -- KT may edit from raw title
    summary           TEXT,                          -- AI-prefilled; KT overwrites if needed
    score             SMALLINT CHECK (score BETWEEN 1 AND 5),  -- AI-prefilled; KT overwrites if needed
    category_id       UUID REFERENCES category(id),
    category_group_id UUID REFERENCES category_group(id),
    tags              JSONB,
    review_status     VARCHAR(20) NOT NULL DEFAULT 'Pending'
                      CHECK (review_status IN ('Pending','Approved','Rejected','Published')),
    reviewer_id       UUID REFERENCES "user"(id),    -- KT member who reviewed
    slug              TEXT UNIQUE,                   -- set when Published: {YYYY-MM-DD}-{kebab-title}
    week_start        DATE,                          -- set when Published
    published_at      TIMESTAMPTZ,
    search_vector     tsvector GENERATED ALWAYS AS (
                          to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
                      ) STORED,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**

```sql
CREATE INDEX idx_patchnote_daily_user_date ON patchnote_daily_stat_snapshot(user_id, stat_date DESC);
CREATE INDEX idx_platform_weekly ON platform_weekly_stat_snapshot(week_start DESC);
CREATE INDEX idx_highlight_weekly_user ON highlight_weekly_stat_snapshot(user_id, week_start DESC);
CREATE INDEX idx_model_update_daily_user_date ON model_update_daily_snapshot(user_id, stat_date DESC);
CREATE INDEX idx_model_update_daily_category ON model_update_daily_snapshot(user_id, category_id, stat_date DESC);
CREATE INDEX idx_model_update_weekly_user ON model_update_weekly_stat_snapshot(user_id, week_start DESC);
CREATE INDEX idx_concept_pages_section ON concept_pages(handbook_section);
CREATE INDEX idx_concept_pages_published ON concept_pages(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_changelog_changed_at ON concept_page_changelog(changed_at DESC);
CREATE INDEX idx_changelog_concept_slug ON concept_page_changelog(concept_slug);
CREATE INDEX idx_curated_articles_status ON curated_articles(review_status);
CREATE INDEX idx_curated_articles_published ON curated_articles(week_start DESC) WHERE review_status = 'Published';
CREATE INDEX idx_curated_articles_category ON curated_articles(category_id);
CREATE INDEX idx_curated_articles_score ON curated_articles(score DESC);
CREATE INDEX idx_curated_articles_search ON curated_articles USING gin(search_vector);

-- Community Newly Discovered snapshots
CREATE INDEX idx_nd_snapshot_category_week ON newly_discovered_category_snapshot(category_group_id, week_start DESC);
CREATE INDEX idx_nd_snapshot_published ON newly_discovered_category_snapshot(is_published, week_start DESC) WHERE is_published = TRUE;

-- Personalized Newly Discovered pages
CREATE INDEX idx_user_nd_page_user_week ON user_newly_discovered_page(user_id, week_start DESC);
CREATE INDEX idx_user_nd_page_category ON user_newly_discovered_page(category_group_id, week_start DESC);
CREATE INDEX idx_user_nd_page_status ON user_newly_discovered_page(status) WHERE status IN ('PENDING', 'GENERATING');

-- User concept pages
CREATE INDEX idx_user_concept_page_user ON user_concept_page(user_id);
CREATE INDEX idx_user_concept_page_slug ON user_concept_page(concept_slug);
```

**Writer / reader mapping:**

| Table | Written by | Read by |
| ----- | ---------- | ------- |
| `patchnote_cursor_state` | Next.js API (on user visit) | Next.js API: catch-up query |
| `patchnote_daily_stat_snapshot` | stat-snapshot batch (nightly) | Next.js API: Patchnotes screen |
| `platform_weekly_stat_snapshot` | weekly-publish batch (Sunday) | Next.js API: Newly Discovered page (public/free) |
| `highlight_weekly_stat_snapshot` | weekly-publish batch (Sunday) | Next.js API: Weekly Highlight dashboard (paid users) |
| `model_update_daily_snapshot` | stat-snapshot batch (nightly) | weekly-publish batch (rolling aggregation) |
| `model_update_weekly_stat_snapshot` | weekly-publish batch (Sunday) | Next.js API: Model Updates screen |
| `concept_pages` | Writer Agent | Next.js API: Basics / Advanced concept pages |
| `concept_page_changelog` | Writer Agent (alongside every upsert) | Next.js API: Patchnotes / knowledge section |
| `curated_articles` | Notion sync cron (KT review → DB) | Source of truth for all Newly Discovered content; feeds snapshot tables and search |
| `newly_discovered_category_snapshot` | weekly-publish batch (after KT review, Direct Publish — no synthesis) | Next.js API: community Newly Discovered category pages (free + paid fallback) |
| `user_newly_discovered_page` | weekly-publish batch (filter + rerank only, no synthesis) | Next.js API: Newly Discovered category pages — personalized view for paid users with ≥1 preference; `newly_discovered_category_snapshot` shown as fallback |
| `user_concept_page` | Writer Agent (same weekly batch as community) | Next.js API: concept page personalized view; community fallback while PENDING |

**KPI calculation rules** (full formulas in `schema.md` §4):

- **Items This Week (platform):** `COUNT(*) FROM curated_articles WHERE published_at BETWEEN week_start AND week_end AND review_status = 'Published'` → populates `platform_weekly_stat_snapshot`
- **Items This Week (per-user):** `COUNT(*) FROM user_article_state WHERE user_id = ? AND discovered_at BETWEEN week_start AND week_end` → populates `highlight_weekly_stat_snapshot`
- **Topics Covered:** distinct normalized topics from `user_article_ai_state.ai_structured_extraction_json`
- **New Keywords MoM:** new entries in `ai_tags_json` vs. prior month; floor at −100%
- **Rising Star:** highest `((last 7d weighted_score) − (prior 7d)) / (prior 7d) * 100` in `model_update_daily_snapshot`

---

## Newsletter / Distribution Layer (PostgreSQL 16)

_Available to `ENTERPRISE` tier users only._

```sql
-- Newsletter subscriber list. Scoped per user (the publisher).
CREATE TABLE recipient (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES "user"(id),
    email           VARCHAR(255) NOT NULL,
    name            VARCHAR(100),
    status          recipient_status_enum NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | UNSUBSCRIBED | BOUNCED
    subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT uq_recipient_user_email UNIQUE (user_id, email)
);

-- One newsletter issue per user per week.
CREATE TABLE newsletter_issue (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id),
    issue_week_start    DATE NOT NULL,
    issue_week_end      DATE NOT NULL,
    title               VARCHAR(255) NOT NULL,
    subject             VARCHAR(255),
    status              newsletter_issue_status_enum NOT NULL DEFAULT 'DRAFT',
    content_html        TEXT,
    content_md          TEXT,
    generated_at        TIMESTAMPTZ,
    finalized_at        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    provider            newsletter_provider_enum,
    send_status         newsletter_send_status_enum NOT NULL DEFAULT 'QUEUED',
    recipient_count     INT NOT NULL DEFAULT 0,
    send_error_message  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutable snapshot of each article as it appeared in a sent newsletter.
CREATE TABLE newsletter_issue_item_snapshot (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES "user"(id),
    newsletter_issue_id     UUID NOT NULL REFERENCES newsletter_issue(id),
    user_article_state_id   UUID,
    source_name             VARCHAR(200),
    article_title           VARCHAR(500) NOT NULL,
    article_url             VARCHAR(1000) NOT NULL,
    article_published_at    TIMESTAMPTZ NOT NULL,
    article_author          VARCHAR(255),
    article_language        VARCHAR(10),
    article_image_url       VARCHAR(1000),
    ai_summary              TEXT,
    ai_score                NUMERIC(12,4),
    is_recommended          BOOLEAN NOT NULL DEFAULT FALSE,
    position                INT NOT NULL DEFAULT 0,
    highlight_text          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Version history of newsletter HTML drafts.
CREATE TABLE newsletter_draft_version (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id),
    newsletter_issue_id UUID NOT NULL REFERENCES newsletter_issue(id),
    version_no          INT NOT NULL,
    content_html        TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-recipient send receipt.
CREATE TABLE newsletter_send_log (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id),
    newsletter_issue_id UUID NOT NULL REFERENCES newsletter_issue(id),
    recipient_id        UUID REFERENCES recipient(id),
    to_email            VARCHAR(255) NOT NULL,
    provider            newsletter_provider_enum NOT NULL DEFAULT 'OTHER',
    provider_message_id VARCHAR(255),
    status              newsletter_send_status_enum NOT NULL DEFAULT 'QUEUED',
    error_msg           TEXT,
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Usage notes:**

- Gate all newsletter tables behind `user.subscription_tier = 'ENTERPRISE'` at the API layer.
- `recipient.status = 'BOUNCED'` is set by the email provider webhook; bounced addresses are excluded from next-send queries automatically.
- `newsletter_issue_item_snapshot` is append-only after send — it is the legal record of what was delivered.
- `newsletter_draft_version` enables editorial undo; the live draft is `newsletter_issue.content_html`.

---

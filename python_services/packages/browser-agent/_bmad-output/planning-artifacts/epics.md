---
stepsCompleted: [1, 2, 3, 4]
revisedDate: '2026-05-23'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-browser-agent-2026-05-23/prd.md
  - _bmad-output/planning-artifacts/prds/prd-browser-agent-2026-05-23/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - cherry-in-the-haystack/docs/architecture/ddl-v1.1.sql
  - cherry-in-the-haystack/docs/architecture/data-architecture.md
  - cherry-in-the-haystack/docs/architecture/technology-stack-details.md
  - cherry-in-the-haystack/docs/architecture/api-contracts.md
  - cherry-in-the-haystack/docs/architecture/implementation-patterns.md
  - cherry-in-the-haystack/docs/architecture/architecture-decision-records-adrs.md
---

# browser-agent - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for browser-agent, decomposing the requirements from the PRD and Architecture decisions into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1.1: Each config entry declares `url`, `source_name`, `source_type` (must map to a valid `content.source_type_enum` value), and optional behavior flags. All crawls run on a fixed daily schedule.
FR-1.2: A `browser_use_only: true` flag disables Playwright generation for a source. Defaults to `true` for LinkedIn; defaults to `false` for all other sources.
FR-1.3: Per-source validation overrides (minimum content length, recency window in days) are configurable in the same config entry.
FR-1.4: A daily sync job reads URL entries from the Notion Source Registry DBs (LinkedIn DB and Custom Crawl DB) and upserts new sources into the YAML config file, then opens a PR with the change.
FR-1.5: Adding a new entry (via YAML edit or Notion sync) triggers first-run AI page analysis on the next daily cycle.
FR-1.6: Removing an entry stops scheduling for that source; existing DB records are retained.
FR-2.1: browser-use loads and renders the target URL. The AI identifies: the primary content area, pagination or load-more interactions, key field locations (title, body, date, author, URL), and any dynamic load patterns.
FR-2.2: Analysis output is stored as structured JSON in the database (`content.crawler_analysis` table), linked to the corresponding `content.source` record.
FR-2.3: Analysis is not re-triggered unless a crawler failure event fires.
FR-2.4: Analysis output JSON must include at minimum: `content_selector`, `title_selector`, `date_selector`, `author_selector`, `url_selector`, `pagination_type` (none/click/scroll), `dynamic_load` (boolean), and `notes`.
FR-2.5: The prompt used for analysis is versioned; prompt version is stored alongside the analysis record via `prompt_template_version_id` FK.
FR-3.1: From the structured analysis, the AI generates a Python crawl4ai crawler script (using `JsonCssExtractionStrategy`) that extracts: `title`, `body`, `published_at`, `author`, `url`, and `canonical_url`. The TypeScript scheduler invokes this via `POST /crawler/execute`.
FR-3.2: Generated code is stored in the database (`content.crawler_registry` table) as the canonical status and metadata record.
FR-3.3: A PR is automatically opened targeting `python_services/crawlers/generated/`. The merged file in the codebase is the executable source of truth; the DB record tracks status (active/deprecated/pending-review).
FR-3.4: The PR description includes: source name, analysis summary, key selectors used, and generation timestamp.
FR-3.5: A crawler is activated only after the PR is manually reviewed and merged (status set to `active`).
FR-3.6: `browser_use_only: true` sources skip crawl4ai crawler generation entirely.
FR-4.1: The TypeScript scheduler invokes all active (`status = 'active'`) crawlers once per day.
FR-4.2: Crawler output is normalized to the `content.article_raw` schema before DB insert.
FR-4.3: Dedup logic (`representative_key_hash`, `content_hash`) is applied before insert, identical to existing pipeline behavior.
FR-4.4: Articles that pass dedup flow downstream to the existing AI scoring → Notion write pipeline without modification.
FR-4.5: Sources configured with `browser_use_only: true` skip scheduled Playwright crawling and go directly to browser-use fallback (F-6).
FR-5.1: Each crawl run is validated on: `title` non-empty; `body` length above minimum threshold; `published_at` parseable and within configured recency window (default: same-day or within 24h); `url` present and valid.
FR-5.2: Validation failures are logged with structured error codes: `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL`.
FR-5.3: Partial run: valid articles pass through. Only a full-run failure (zero valid articles returned) triggers fallback.
FR-5.4: Per-source thresholds (from FR-1.3) override package-level defaults where specified.
FR-6.1: Fallback activates on full-run validation failure from a Playwright crawler, or on every run for `browser_use_only: true` sources.
FR-6.2: browser-use loads and visually reads the page; the AI structures extracted content into the `content.article_raw` schema, including `title`, `body`, `published_at`, `author`, and `url`.
FR-6.3: Fallback output passes through the same validation (FR-5) → dedup (FR-4.3) → pipeline flow as a normal crawl.
FR-6.4: Every fallback invocation is logged with: source name, timestamp, triggering error code, and whether collection succeeded.
FR-6.5: LinkedIn uses the fallback path exclusively on every scheduled run (never F-3 or F-4).
FR-6.6: Threads uses the standard crawl4ai crawler generation path; fallback applies on failure like any other source.
FR-7.1: A fallback event for a Playwright-managed source increments `crawler_registry.consecutive_failures`. Regeneration is queued only when the counter reaches a configurable threshold (default: 3 consecutive daily failures).
FR-7.2: Regeneration re-runs browser-use page analysis (F-2) against the current page structure.
FR-7.3: From the new analysis, the AI generates an updated Python crawl4ai crawler (F-3) and opens a new PR.
FR-7.4: The existing broken crawler is marked `status: deprecated` in `crawler_registry` and does not run again until replaced.
FR-7.5: The source continues via fallback (F-6) until the regenerated PR is merged and activated.
FR-7.6: Regeneration fires once per fallback event and does not retry if the regenerated crawler also fails validation.
FR-8.1: Articles inserted to `content.article_raw` flow to Notion via the existing Notion write logic.
FR-8.2: Notion DB schema, write logic, and daily backup cron are unchanged.

### NonFunctional Requirements

NFR-1: browser-use invoked ≤1× per source per stable period. Never invoked on routine scheduled runs (Playwright path only). Exception: LinkedIn runs browser-use on every daily cycle — accepted ongoing cost (~$0.10/run/source).
NFR-2: Playwright failures surface within one scheduled cycle via structured logs. Fallback fires before the next cycle. Per-source `consecutive_failures` count and `last_success_at` timestamp must be queryable.
NFR-3: crawl4ai execution latency: ≤5 min per source per run (via `POST /crawler/execute`).
NFR-4: Generated crawler code must be human-readable Python. A reviewer should be able to assess correctness in <10 min.
NFR-5: No credentials or secrets embedded in generated crawler files. Authentication configs use existing env var patterns only.
NFR-6: LinkedIn and Threads access via browser-use should be reviewed against each platform's ToS prior to production use.

### Additional Requirements

- **DB Schema — `content.crawler_analysis` table** (ADR-011): Create with UUID v7 PK, `source_id` FK to `content.source`, `analysis_json` JSONB (object shape check), `prompt_template_version_id` FK (nullable), `run_log_id` FK (nullable), `model_name`, `created_at`/`updated_at` TIMESTAMPTZ, unique index on `source_id`, `updated_at` trigger. 1:1 per source; UPDATE in-place on re-analysis.
- **DB Schema — `content.crawler_registry` table + enum** (ADR-012): Create `content.crawler_status_enum` ('pending_review','active','deprecated'). Create `crawler_registry` with UUID v7 PK, `source_id` FK, `analysis_id` FK (nullable), `status` enum, `generated_code` TEXT, `pr_number`, `pr_url`, `pr_merged_at`, `consecutive_failures` (Playwright-specific, separate from `content.source.consecutive_failures`), `run_log_id` FK, partial unique index on `source_id WHERE status='active'`. Status lifecycle: INSERT as `pending_review` → PR merged → `active` → consecutive failures ≥ threshold → `deprecated` + new `pending_review` row.
- **DB Migration — `core.run_kind_enum` extension** (ADR-012): `ALTER TYPE core.run_kind_enum ADD VALUE 'CRAWLER_ANALYSIS'` and `ADD VALUE 'CRAWLER_GENERATION'`.
- **Python FastAPI service extension** (ADR-013-R1): Add `python_services/api/routers/crawler.py` with three endpoints: `POST /crawler/analyze` (60s timeout, browser-use, unchanged); `POST /crawler/generate` (30s timeout, generates Python crawl4ai script from `analysis_json`); `POST /crawler/execute` (30s timeout, request: `{source_id}`, response: `{items, source_id}` — loads active `crawler_registry.generated_code` and runs `AsyncWebCrawler`). `BrowserConfig` singleton at app startup (ADR-013-R1); `CrawlerRunConfig` per request.
- **TypeScript orchestrator flow** (ADR-013): Check DB for existing `crawler_analysis` before calling Python; check for existing `active`/`pending_review` registry entry before calling generate. PR merge detection → UPDATE `crawler_registry.status = 'active'`.
- **`GitHubCommitter` interface extension** (ADR-014-R1): Add `createPullRequest(params: {branch, title, body, files})` method using Octokit. Bot account: `handbook-bot`. Head branch: `feat/crawler/{source_name_kebab}`. Base branch: `feature/browser-crawl-agent`. Generated file path: `python_services/crawlers/generated/{source_name_kebab}.py` (Python crawl4ai script — changed from `.ts`). Duplicate PR handling: close existing PR via Octokit → deprecate existing registry row → new `pending_review` row + new PR. Interface signature unchanged; only `files[].path` value changes.
- **Notion Source Registry sync** (ADR-015): Two target DBs — LinkedIn DB (`342f199edf7c803ebb2cfcb30bd492e3`, URL property: `Linkedin`) and Custom Crawl DB (`340f199edf7c80cabc78f94853d2c426`, URL property: `URL`). Config-driven via `NOTION_SOURCE_DB_CONFIGS` array. Validate `source_type` maps to `content.source_type_enum` and `browser_use_only` is a checkbox (boolean).
- **Codebase conventions**: TypeScript files `kebab-case.ts`, Python files `lowercase_underscores.py`. New cron job: `packages/pipeline/src/jobs/browser-crawl.ts`. Generated crawler files: `python_services/crawlers/generated/{source_name_kebab}.py`. All jobs must be idempotent (UPSERT, not blind INSERT). No hardcoded credentials — env vars only. Follows ADR-006 split: TypeScript = orchestration, Python = LLM/browser-use/crawl4ai.
- **Article normalization**: `representative_key` must follow existing dedup priority (GUID > normalized_url > canonical_url > url). Crawled articles insert into `content.article_raw` with all required fields populated.
- **Run logging**: All crawler operations (analysis, generation, scheduled crawl, fallback) must write to `core.run_log` with appropriate `run_kind` values.

### UX Design Requirements

No UX Design document — this is a backend/infrastructure package with no end-user-facing UI changes. All output surfaces through the existing Notion pipeline.

### FR Coverage Map

FR-1.1: Epic 1 — YAML config schema with required fields
FR-1.2: Epic 1 — browser_use_only flag handling
FR-1.3: Epic 1 — Per-source validation override config
FR-1.4: Epic 4 — Notion sync daily job
FR-1.5: Epic 1 — First-run analysis trigger on new entry
FR-1.6: Epic 1 — Entry removal stops scheduling
FR-2.1: Epic 1 — browser-use AI page analysis
FR-2.2: Epic 1 — crawler_analysis table storage
FR-2.3: Epic 1 — Analysis not re-triggered unless failure
FR-2.4: Epic 1 — Analysis JSON field contract
FR-2.5: Epic 1 — Prompt version stored with analysis
FR-3.1: Epic 1 — AI generates Python crawl4ai crawler script; Story 1.7 — `/crawler/execute` runs it
FR-3.2: Epic 1 — crawler_registry storage
FR-3.3: Epic 1 — PR auto-opened to feature/browser-crawl-agent (python_services/crawlers/generated/*.py)
FR-3.4: Epic 1 — PR description content
FR-3.5: Epic 1 — PR merge activates crawler
FR-3.6: Epic 1 — browser_use_only sources skip generation
FR-4.1: Epic 2 — Daily TypeScript scheduler invocation
FR-4.2: Epic 2 — Normalize output to article_raw schema
FR-4.3: Epic 2 — Dedup logic (representative_key_hash, content_hash)
FR-4.4: Epic 2 — Pipeline handoff to AI scoring → Notion
FR-4.5: Epic 2 — browser_use_only skip scheduled crawling
FR-5.1: Epic 2 — Validation rules (title, body, date, url)
FR-5.2: Epic 2 — Structured error codes
FR-5.3: Epic 2 — Partial pass / full-failure trigger logic
FR-5.4: Epic 2 — Per-source threshold overrides
FR-6.1: Epic 3 — Fallback trigger conditions
FR-6.2: Epic 3 — browser-use vision collection → article_raw
FR-6.3: Epic 3 — Fallback through same validation/dedup/pipeline
FR-6.4: Epic 3 — Fallback event logging
FR-6.5: Epic 3 — LinkedIn daily browser-use collection
FR-6.6: Epic 3 — Threads on standard path + fallback on failure
FR-7.1: Epic 3 — Consecutive-failure counter + threshold
FR-7.2: Epic 3 — Re-run browser-use analysis
FR-7.3: Epic 3 — Generate updated crawler + new PR
FR-7.4: Epic 3 — Deprecate broken crawler
FR-7.5: Epic 3 — Continue via fallback during review window
FR-7.6: Epic 3 — Single-shot regeneration, no retry loop
FR-8.1: Epic 2 — Articles flow to Notion via existing logic
FR-8.2: Epic 2 — Existing Notion pipeline unchanged

## Epic List

### Epic 1: Source Onboarding Engine
The engineering team can configure any free-form web source in a YAML file and the system automatically runs browser-use page analysis, generates a Python crawl4ai crawler script, and opens a PR — ready for review and merge. Establishes the full foundation: DB schema (crawler_analysis, crawler_registry, enum extensions), Python FastAPI crawler router (analyze + generate + execute), GitHubCommitter extension, YAML config loader, and TypeScript orchestrator.
**FRs covered:** FR-1.1, FR-1.2, FR-1.3, FR-1.5, FR-1.6, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6

### Epic 2: Scheduled Crawling & Pipeline Integration
Merged crawl4ai crawlers run automatically every day via `POST /crawler/execute`, articles are validated and deduplicated, and all valid content flows into the existing AI scoring → Notion write pipeline — new source content appears in Notion without any manual step after a PR is merged.
**FRs covered:** FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-8.1, FR-8.2

### Epic 3: Fallback Collection & Self-Healing
LinkedIn and all browser_use_only sources are collected via browser-use on every run. When a crawl4ai crawler fails repeatedly, the system automatically re-analyzes the target page, generates a replacement Python crawl4ai crawler, and opens a new PR — zero data loss during the review window. All failure and recovery events are logged.
**FRs covered:** FR-6.1, FR-6.2, FR-6.3, FR-6.4, FR-6.5, FR-6.6, FR-7.1, FR-7.2, FR-7.3, FR-7.4, FR-7.5, FR-7.6

### Epic 4: Notion Source Registry Sync
The engineering team can add new sources to the pipeline by entering them in the Notion Source Registry — the daily sync job reads both Notion DBs (LinkedIn + Custom Crawl), upserts new sources into the YAML config, and opens a PR. No direct YAML editing required.
**FRs covered:** FR-1.4

---

## Epic 1: Source Onboarding Engine

The engineering team can configure any free-form web source in a YAML file and the system automatically runs browser-use page analysis, generates a Python crawl4ai crawler script, and opens a PR — ready for review and merge. Establishes the full foundation: DB schema, Python FastAPI crawler router, GitHubCommitter extension, YAML config loader, and TypeScript orchestrator.

### Story 1.1: DB Migration — Crawler Tables & Enums

As an engineer,
I want the `content.crawler_analysis` and `content.crawler_registry` database tables, the `content.crawler_status_enum` type, and the extended `core.run_kind_enum` to exist in the database,
So that the system has the persistent storage layer required for all crawler operations.

**Acceptance Criteria:**

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

### Story 1.2: YAML Source Config Schema & Loader

As an engineer,
I want to declare free-form web sources in a YAML config file with `url`, `source_name`, `source_type`, and optional flags,
So that I can onboard any target site without writing code and the system knows exactly how to handle each source.

**Acceptance Criteria:**

**Given** a valid YAML config file with a source entry containing `url`, `source_name`, and `source_type`
**When** the TypeScript config loader parses the file
**Then** a typed `SourceConfig` object is returned with all declared fields correctly typed
**And** `browser_use_only` defaults to `false` for non-LinkedIn sources when not specified
**And** `browser_use_only` defaults to `true` for any source with `source_type: LINKEDIN`

**Given** a source entry with `browser_use_only: true`
**When** the config is loaded
**Then** the loaded config correctly reflects `browserUseOnly: true`

**Given** a source entry with optional per-source overrides (`min_body_length`, `recency_window_days`, `consecutive_failures_threshold`)
**When** the config is loaded
**Then** the overrides are accessible on the typed config object
**And** missing override fields fall back to package-level defaults (`consecutive_failures_threshold` defaults to 3)

**Given** a YAML config file with an invalid `source_type` value (not in `content.source_type_enum`)
**When** the config loader parses the file
**Then** a validation error is thrown listing the invalid value and the set of allowed values

**Given** a config entry missing a required field (`url`, `source_name`, or `source_type`)
**When** the config loader parses the file
**Then** a descriptive validation error is thrown identifying the missing field

---

### Story 1.3: Python /crawler/analyze Endpoint

As an engineer,
I want a `POST /crawler/analyze` endpoint that uses browser-use to analyze any target URL and stores the structured result in `crawler_analysis`,
So that the system can understand a page's content structure once and reuse that knowledge for Playwright code generation.

**Acceptance Criteria:**

**Given** a valid `POST /crawler/analyze` request with `source_id` and `url`
**When** the endpoint is called and no existing `crawler_analysis` row exists for `source_id`
**Then** browser-use loads and renders the target URL
**And** the AI identifies: primary content area, pagination/load-more patterns, and field locations for title, body, date, author, and URL
**And** the result is stored as a new `crawler_analysis` row (UPSERT on `source_id`)
**And** the response contains `analysis_id` and `analysis_json` with all required fields: `content_selector`, `title_selector`, `date_selector`, `author_selector`, `url_selector`, `pagination_type` (none/click/scroll), `dynamic_load` (boolean), `notes`
**And** `analysis_json` also includes crawl4ai execution hints: `wait_for` (CSS/JS condition or null), `js_code` (JS snippet or null), `magic_mode` (boolean) — derived by browser-use during the same analysis pass (ADR-011-R1)
**And** a `core.run_log` entry is written with `run_kind = 'CRAWLER_ANALYSIS'` and the final status

**Given** a `POST /crawler/analyze` request for a `source_id` that already has a `crawler_analysis` row
**When** the endpoint is called
**Then** the endpoint returns the existing `analysis_id` and `analysis_json` without invoking browser-use
**And** no new `run_log` entry is written (NFR-1 cost guard)

**Given** browser-use fails to load or analyze the target URL
**When** the endpoint is called
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** the `run_log` entry is written with `status = 'FAILED'`
**And** no partial `crawler_analysis` row is written

**Given** the endpoint request
**When** it does not complete within 60 seconds
**Then** the request times out with a 422 error response

**Given** a stored `crawler_analysis` row
**When** it is inspected
**Then** `prompt_template_version_id` links to the exact prompt version used during analysis (FR-2.5)

---

### Story 1.4: Python /crawler/generate Endpoint

As an engineer,
I want a `POST /crawler/generate` endpoint that takes a page analysis result and generates a Python crawl4ai crawler script,
So that I receive production-ready, human-readable crawler code without writing it manually.

**Acceptance Criteria:**

**Given** a valid `POST /crawler/generate` request with `source_id`, `analysis_id`, and `source_name`
**When** the endpoint is called
**Then** the endpoint loads `analysis_json` from `crawler_analysis` for the given `analysis_id`
**And** maps the selector fields to a `JsonCssExtractionStrategy` schema (baseSelector, fields for title/url/date/author/content)
**And** renders a Python crawl4ai script from template, populating `wait_for`, `js_code`, and `magic_mode` from `analysis_json` (ADR-013-R1)
**And** the generated script is stored as a new `content.crawler_registry` row with `status = 'pending_review'` and `generated_code = <Python script>`
**And** the response contains `registry_id` and `generated_code`
**And** a `core.run_log` entry is written with `run_kind = 'CRAWLER_GENERATION'`

**Given** the generated Python crawl4ai script
**When** it is reviewed
**Then** it contains a `EXTRACTION_SCHEMA` dict and a `CRAWL_CONFIG = CrawlerRunConfig(...)` object as the top-level exports
**And** it contains no hardcoded credentials or secrets — all auth uses env var references (NFR-5)
**And** the code is human-readable Python that a reviewer can assess for correctness in under 10 minutes (NFR-4)

**Given** the analysis_json has `wait_for = null` and `js_code = null`
**When** the script is generated
**Then** those parameters are omitted from `CrawlerRunConfig` (not set to `None` explicitly)

**Given** the endpoint cannot generate a valid script from the analysis input
**When** the endpoint is called
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** the `run_log` entry is written with `status = 'FAILED'`
**And** no `crawler_registry` row is written

**Given** the endpoint request
**When** it does not complete within 30 seconds
**Then** the request times out with a 422 error response

---

### Story 1.5: GitHubCommitter.createPullRequest() Extension

As an engineer,
I want the pipeline's GitHub integration to support opening pull requests with generated crawler code,
So that generated crawlers are automatically submitted for review without any manual git operations.

**Acceptance Criteria:**

**Given** a call to `GitHubCommitter.createPullRequest()` with a branch name, title, body, and file list
**When** the method executes
**Then** a new branch `feat/crawler/{source_name_kebab}` is created from `feature/browser-crawl-agent`
**And** the provided files are committed to the new branch using the `handbook-bot` account
**And** a PR is opened targeting `feature/browser-crawl-agent` as the base
**And** the method returns `{ prNumber, prUrl }`
**And** the generated file is placed at `python_services/crawlers/generated/{source_name_kebab}.py` (ADR-014-R1)

**Given** a `source_id` that already has a `pending_review` entry in `crawler_registry`
**When** `createPullRequest()` is called for the same source
**Then** the existing PR is closed via Octokit (`pulls.update({ state: 'closed' })`)
**And** the existing `crawler_registry` row is updated to `status = 'deprecated'`
**And** a new `pending_review` row is inserted and a new PR is opened

**Given** the GitHub API returns a non-2xx response
**When** `createPullRequest()` is called
**Then** a descriptive error is thrown with the status code and GitHub error message
**And** no partial state is left (no half-committed branches or orphaned registry rows)

**Given** the PR description
**When** it is inspected
**Then** it includes: source name, analysis summary, key selectors used, generation timestamp, and crawl4ai config summary (`wait_for`, `magic_mode`) (FR-3.4, ADR-014-R1)

---

### Story 1.6: Source Onboarding Orchestrator

As an engineer,
I want a daily orchestration job that reads the YAML config, detects new sources, and automatically runs the full analysis → generation → PR pipeline for each new entry,
So that adding a URL to the config file is everything I need to do to onboard a new source.

**Acceptance Criteria:**

**Given** the daily orchestrator runs and the YAML config contains a source with no existing `crawler_analysis` record
**When** the orchestrator executes
**Then** it calls `POST /crawler/analyze` for that source
**And** on success, calls `POST /crawler/generate`
**And** on success, calls `GitHubCommitter.createPullRequest()` with the generated code
**And** the new `crawler_registry` row references the correct `analysis_id`

**Given** the daily orchestrator runs and a source already has a `crawler_analysis` record and an `active` or `pending_review` `crawler_registry` entry
**When** the orchestrator executes
**Then** neither `/crawler/analyze` nor `/crawler/generate` is called for that source (NFR-1 cost guard)

**Given** a source with `browser_use_only: true` in the config
**When** the orchestrator runs
**Then** `/crawler/analyze` and `/crawler/generate` are not called for that source (FR-3.6)
**And** no `crawler_registry` row is created for that source

**Given** a `crawler_registry` row with `status = 'pending_review'` and `pr_number` set, and the PR has been merged on GitHub
**When** the orchestrator runs its PR status check
**Then** the `crawler_registry` row is updated to `status = 'active'` and `pr_merged_at` is set

**Given** a source entry is removed from the YAML config
**When** the orchestrator runs
**Then** the source is not scheduled for analysis or generation
**And** existing `crawler_analysis` and `crawler_registry` DB records are retained (FR-1.6)

**Given** a new source entry is added to the YAML config
**When** the orchestrator runs on the next daily cycle
**Then** the analysis → generation → PR pipeline fires for that source (FR-1.5)

---

### Story 1.7: Python /crawler/execute Endpoint

As an engineer,
I want a `POST /crawler/execute` endpoint that runs the active crawl4ai crawler for a source and returns structured article data,
So that the TypeScript scheduler can collect content from any source via a single HTTP call without managing browser lifecycle directly.

**Acceptance Criteria:**

**Given** a valid `POST /crawler/execute` request with `source_id`
**When** the endpoint is called and an `active` `crawler_registry` row exists for that source
**Then** the endpoint loads `generated_code` from the active `crawler_registry` row
**And** dynamically imports `CRAWL_CONFIG` from the generated Python module
**And** runs `AsyncWebCrawler(config=app.state.browser_config).arun(url, config=CRAWL_CONFIG)`
**And** returns `{ "source_id": string, "items": CrawledItem[] }` where each item contains `title`, `body`, `published_at`, `author`, `url`, `canonical_url`

**Given** the FastAPI app starts up
**When** the lifespan context manager executes
**Then** a single `BrowserConfig(headless=True)` instance is created and attached to `app.state.browser_config`
**And** this instance is reused across all `/crawler/execute` requests (no per-request browser spawn)

**Given** a `POST /crawler/execute` request
**When** no `active` `crawler_registry` row exists for the `source_id`
**Then** a 422 response is returned: `{"error": "NO_ACTIVE_CRAWLER", "detail": "..."}`

**Given** crawl4ai fails to load the page or extraction returns zero items
**When** the endpoint processes the result
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** no partial results are returned

**Given** the endpoint request
**When** it does not complete within 30 seconds
**Then** the request times out with a 422 error response (NFR-3)

**Given** the generated Python module has `magic=True` in `CRAWL_CONFIG`
**When** the endpoint runs the crawler
**Then** crawl4ai's stealth mode is active for that request (bot-detection bypass)

**Given** the endpoint executes (success or failure)
**When** the run completes
**Then** a `core.run_log` entry is written with `run_kind = 'CRAWLER_EXECUTION'` and the final status

---

## Epic 2: Scheduled Crawling & Pipeline Integration

Merged crawl4ai crawlers run automatically every day via `POST /crawler/execute`, articles are validated and deduplicated, and all valid content flows into the existing AI scoring → Notion write pipeline — new source content appears in Notion without any manual step after a PR is merged.

### Story 2.1: crawl4ai Crawler Execution Runner

As an engineer,
I want the TypeScript scheduler to invoke `POST /crawler/execute` for all active crawlers once per day,
So that articles from merged crawl4ai crawlers are automatically collected without managing browser lifecycle in TypeScript.

**Acceptance Criteria:**

**Given** the daily scheduler job runs
**When** it queries `content.crawler_registry WHERE status = 'active'`
**Then** for each active crawler, the scheduler calls `POST :8000/crawler/execute` with `{ source_id }`
**And** the response `{ items: CrawledItem[] }` provides the raw output (title, body, published_at, author, url, canonical_url) per article

**Given** a source with `browser_use_only: true` in the config
**When** the scheduler runs
**Then** `POST /crawler/execute` is not called for that source (FR-4.5)
**And** the source is routed to the browser-use fallback path (handled in Epic 3)

**Given** `/crawler/execute` returns a successful response
**When** its per-source elapsed time is measured
**Then** the full round-trip completes within 5 minutes (NFR-3)

**Given** `/crawler/execute` returns a 422 error or network timeout
**When** the scheduler encounters it
**Then** the failure is logged with the source name and error detail
**And** execution continues for all remaining active crawlers (one failure does not halt the batch)
**And** the failure is treated as a full-run failure for that source (triggers fallback in Epic 3)

---

### Story 2.2: Article Validation Service

As an engineer,
I want crawled articles to pass through a validation gate before entering the pipeline,
So that only well-formed, timely content reaches the database and downstream processes.

**Acceptance Criteria:**

**Given** a crawled article from any source
**When** the validation service evaluates it
**Then** it checks: `title` is non-empty; `body` length is above the configured minimum threshold; `published_at` is parseable as a valid date and falls within the recency window (default: within 24h); `url` is present and a valid URL

**Given** an article that fails one or more validation checks
**When** it is processed
**Then** a structured log entry is written with the source name, article URL, and one or more of the error codes: `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL`
**And** the invalid article is discarded and not inserted into `content.article_raw`

**Given** a crawl run that returns a mix of valid and invalid articles
**When** validation completes
**Then** valid articles pass through to the dedup/insert step (FR-5.3)
**And** only a run where zero articles pass validation is treated as a full-run failure (FR-5.3)

**Given** a source config entry with per-source overrides (`min_body_length`, `recency_window_days`)
**When** validation runs for that source
**Then** the per-source values are used instead of the package-level defaults (FR-5.4)

---

### Story 2.3: Dedup & Pipeline Handoff

As an engineer,
I want validated articles to be deduplicated and inserted into `content.article_raw`, then flow into the existing AI scoring and Notion write pipeline unchanged,
So that collected content reaches Notion without any modifications to the existing pipeline.

**Acceptance Criteria:**

**Given** a validated article from a Playwright crawler
**When** the dedup check runs
**Then** `representative_key` is constructed following the existing priority order: GUID > normalized_url > canonical_url > url
**And** `representative_key_hash` is checked against `content.article_raw` for duplicate detection
**And** `content_hash` (body hash) is also checked as a secondary dedup signal
**And** a duplicate article is silently skipped without error

**Given** a non-duplicate validated article
**When** it is inserted
**Then** a new row is written to `content.article_raw` with all required fields populated: `source_id`, `title`, `url`, `published_at`, `author`, `content_raw`, `canonical_url`, `representative_key`, and hash-generated columns
**And** the insert is idempotent (safe to re-run on the same article)

**Given** a newly inserted `article_raw` row
**When** the existing pipeline processes it
**Then** it flows through AI scoring → Notion write exactly as articles from RSS/Twitter sources do, with no modifications to those pipeline stages (FR-8.1, FR-8.2)

**Given** the daily crawler job completes
**When** its outcome is checked
**Then** per-source `consecutive_failures` and `last_success_at` on `content.source` are updated to reflect the run result (NFR-2)

---

## Epic 3: Fallback Collection & Self-Healing

LinkedIn and all `browser_use_only` sources are collected via browser-use on every run. When a crawl4ai crawler fails repeatedly, the system automatically re-analyzes the target page, generates a replacement Python crawl4ai crawler, and opens a new PR — zero data loss during the review window. All failure and recovery events are logged.

### Story 3.1: browser-use Fallback Collection

As an engineer,
I want the system to collect articles via browser-use vision when a crawl4ai crawler produces zero valid articles, and to run browser-use on every cycle for `browser_use_only` sources,
So that LinkedIn and other browser_use_only sources are always collected, and no data is lost when a crawl4ai crawler breaks.

**Acceptance Criteria:**

**Given** a crawl4ai crawler run (`POST /crawler/execute`) that results in a full-run validation failure (zero valid articles)
**When** the fallback logic evaluates the result
**Then** browser-use is invoked for that source to visually read the page and extract content
**And** the extracted content is structured into the `content.article_raw` schema fields: `title`, `body`, `published_at`, `author`, `url`

**Given** a source configured with `browser_use_only: true` (including LinkedIn)
**When** the daily scheduler runs
**Then** browser-use is invoked directly for that source on every cycle without attempting Playwright execution (FR-6.1, FR-6.5)

**Given** fallback browser-use collection succeeds
**When** the output is processed
**Then** it passes through the same validation (Story 2.2) → dedup (Story 2.3) → pipeline flow as a normal Playwright crawl (FR-6.3)

**Given** any fallback invocation (success or failure)
**When** the run completes
**Then** a structured log entry is written containing: source name, timestamp, triggering error code (or `browser_use_only` marker), and whether collection succeeded (FR-6.4)

**Given** a Threads source that fails crawl4ai execution validation
**When** fallback runs
**Then** it is treated identically to any other non-browser_use_only source — fallback fires, and the crawl4ai failure counter increments (FR-6.6)

**Given** fallback collection itself fails to produce any articles
**When** the run completes
**Then** the failure is logged with the source name and error detail
**And** `content.source.consecutive_failures` is incremented and `last_error_at` is updated

---

### Story 3.2: crawl4ai Failure Counter & Regeneration Trigger

As an engineer,
I want the system to track consecutive crawl4ai crawler failures per source and queue regeneration after a configurable threshold,
So that persistent breakages are detected automatically without requiring manual monitoring.

**Acceptance Criteria:**

**Given** a crawl4ai crawler run (`POST /crawler/execute`) for a source that results in a full-run failure triggering fallback
**When** the fallback completes
**Then** `content.crawler_registry.consecutive_failures` is incremented for the active crawler row
**And** this counter is independent of `content.source.consecutive_failures` (which resets on any success including fallback)

**Given** `crawler_registry.consecutive_failures` reaches the threshold configured for that source (`consecutive_failures_threshold` in YAML config, default: 3)
**When** the threshold is crossed
**Then** the active crawler row is updated to `status = 'deprecated'`
**And** a regeneration job is queued for that source
**And** the deprecated crawler is no longer invoked via `/crawler/execute` in future scheduler runs

**Given** a single transient crawl4ai failure (count below threshold)
**When** the next run succeeds
**Then** `crawler_registry.consecutive_failures` is reset to 0 for that source's active crawler row
**And** no regeneration is triggered

**Given** a source with `browser_use_only: true`
**When** the scheduler runs
**Then** `crawler_registry.consecutive_failures` is never incremented for that source (it has no crawl4ai crawler to track)

---

### Story 3.3: Auto-Regeneration Pipeline

As an engineer,
I want the system to automatically re-analyze a broken source and open a new generated Python crawl4ai crawler PR when the failure threshold is reached,
So that broken crawlers are replaced without any manual intervention — the source continues collecting via fallback until the new PR is merged.

**Acceptance Criteria:**

**Given** a regeneration job is queued for a source (consecutive_failures ≥ threshold)
**When** regeneration executes
**Then** `POST /crawler/analyze` is called against the current live page — forcing a fresh analysis even if a prior `crawler_analysis` record exists (overwrite/update in place)
**And** on success, `POST /crawler/generate` is called with the new analysis (generates updated Python crawl4ai script)
**And** on success, `GitHubCommitter.createPullRequest()` opens a new PR with the regenerated `.py` file at `python_services/crawlers/generated/{source_name_kebab}.py`
**And** the new `crawler_registry` row has `status = 'pending_review'` and references the updated `analysis_id`

**Given** the deprecated broken crawler row
**When** regeneration completes
**Then** it remains in `crawler_registry` with `status = 'deprecated'` and is not invoked via `/crawler/execute` by the scheduler (FR-7.4)

**Given** the source is in the regeneration-pending state (old crawler deprecated, new PR open)
**When** the daily scheduler runs
**Then** browser-use fallback continues to collect for that source every cycle (FR-7.5)
**And** the source's articles still flow through the pipeline during the PR review window

**Given** regeneration fires for a source
**When** it is triggered
**Then** regeneration fires exactly once per failure threshold crossing — it does not retry automatically if the regenerated crawler also fails validation after merge (FR-7.6)

**Given** the new regenerated PR is merged
**When** the orchestrator's PR status check runs (Story 1.6)
**Then** the new `crawler_registry` row is updated to `status = 'active'`
**And** Playwright execution resumes for that source in the next daily cycle

---

## Epic 4: Notion Source Registry Sync

The engineering team can add new sources to the pipeline by entering them in the Notion Source Registry — the daily sync job reads both Notion DBs (LinkedIn + Custom Crawl), upserts new sources into the YAML config, and opens a PR. No direct YAML editing required.

### Story 4.1: Notion Source Registry Sync Job

As an engineer,
I want a daily job that reads the Notion Source Registry DBs and automatically upserts new sources into the YAML config and opens a PR,
So that I can onboard sources by adding them to Notion without ever touching the YAML file directly.

**Acceptance Criteria:**

**Given** the daily Notion sync job runs
**When** it queries both configured Notion DBs (LinkedIn DB `342f199edf7c803ebb2cfcb30bd492e3` and Custom Crawl DB `340f199edf7c80cabc78f94853d2c426`)
**Then** it reads each page's URL property (`Linkedin` for LinkedIn DB, `URL` for Custom Crawl DB), `Name`, `source_type`, and `browser_use_only` fields using the `NOTION_SOURCE_DB_CONFIGS` array
**And** for each Notion entry whose URL does not already exist in the YAML config, a new source entry is appended

**Given** the sync job identifies one or more new sources
**When** the YAML config is updated
**Then** `GitHubCommitter.commitFiles()` opens a PR with the updated config file
**And** the PR description lists the newly added source names and their Notion DB origin

**Given** a Notion entry whose URL already exists in the YAML config
**When** the sync job processes it
**Then** the existing YAML entry is left unchanged (upsert inserts only, no overwrite of existing sources — FR-1.4)

**Given** a Notion entry with a `source_type` value that does not match any value in `content.source_type_enum`
**When** the sync job encounters it
**Then** that entry is skipped and a warning is logged identifying the source name and invalid type value
**And** all other valid entries in the same sync run are still processed

**Given** a Notion entry with a `browser_use_only` property
**When** it is read
**Then** the checkbox value is parsed as a boolean and correctly reflected in the YAML entry

**Given** the Notion API returns a rate-limit (429) or transient server error (500)
**When** the sync job encounters it
**Then** it retries with exponential backoff per the existing `NotionClient` error handling pattern
**And** a failed sync run is logged but does not affect the existing YAML config or any other pipeline jobs

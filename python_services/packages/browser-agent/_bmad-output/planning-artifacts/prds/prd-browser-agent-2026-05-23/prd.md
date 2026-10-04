---
title: "Intelligent Web Crawling Package — News Collector Extension"
status: final
created: 2026-05-23
updated: 2026-05-23
project: browser-agent
---

# Intelligent Web Crawling Package

## Problem

The Cherry in the Haystack news-collector pipeline handles structured sources (RSS, Twitter/X, Reddit, LinkedIn, YouTube) via fixed, per-source fetchers. A growing, high-value category of sources — personal blogs, company tech blogs, newsletters, GitHub Trending, Product Hunt, Threads, and other independent sites — lacks standardized feeds or APIs. Each has a unique HTML structure that changes without notice.

Adding any of these sources today requires manual per-source engineering. When a page structure changes, the scraper silently breaks. There is no systematic, cost-efficient way to onboard and maintain free-form page sources at scale.

## Operator Context

**Single operator type: Cherry in the Haystack engineering team.**

The team adds new target sites by editing a config file, monitors collection health through pipeline logs, and reviews and merges AI-generated crawler PRs before they activate in production. No end-user surface is changed by this package.

---

## Goals

| # | Goal | Signal |
|---|------|--------|
| G-1 | Onboard any free-form web source without manual per-source coding | New source added via config file; first articles collected within one scheduled cycle |
| G-2 | Minimize LLM token cost for ongoing collection | browser-use invoked ≤ 1× per source per stable period; never on routine scheduled runs |
| G-3 | Self-heal when target page structure changes | Fallback fires automatically on failure; regenerated crawler PR opened without operator action |
| G-4 | Output fully compatible with existing pipeline | 100% of collected articles pass existing dedup + AI scoring + Notion flow unchanged |

## Scope

### In Scope (v1)
- Free-form web page sources: personal blogs, company tech blogs, newsletter web pages, GitHub Trending, Product Hunt, Threads, and any operator-added independent sites
- Config-file-based site onboarding
- AI-driven Playwright crawler generation and auto-regeneration
- browser-use fallback for failed Playwright crawls
- LinkedIn: browser-use only (no Playwright generation)
- PR-based deployment gate for all generated crawlers

### Out of Scope (v1)
- Event-triggered invocation (schedule-based only; event-driven is a future phase)
- Modifications to existing RSS / Twitter / Reddit / YouTube fetchers
- Auto-merging generated crawler PRs
- Newsletter email ingestion (web page only) [ASSUMPTION]
- Any end-user-facing changes

---

## Features

### F-1 · Site Registry & Configuration

The package is driven by a YAML config file checked into the repository. Sources can be added by editing the YAML directly, or by entering a URL into the Notion Source Registry, which is automatically reflected in the YAML config on the next sync.

- **FR-1.1** Each config entry declares: `url`, `source_name`, `source_type` (must map to a valid `content.source_type_enum` value), and optional behavior flags. All crawls run on a fixed daily schedule.
- **FR-1.2** A `browser_use_only: true` flag disables Playwright generation for a source. Defaults to `true` for LinkedIn; defaults to `false` for all other sources.
- **FR-1.3** Per-source validation overrides (minimum content length, recency window in days) are configurable in the same config entry. [ASSUMPTION]
- **FR-1.4** A daily sync job reads URL entries from the Notion Source Registry DB and upserts new sources into the YAML config file, then opens a PR with the change. [ASSUMPTION: Notion DB property for URLs is `Source URL`; other required fields use defaults if absent]
- **FR-1.5** Adding a new entry (via YAML edit or Notion sync) triggers first-run AI page analysis on the next daily cycle.
- **FR-1.6** Removing an entry stops scheduling for that source; existing DB records are retained.

---

### F-2 · AI Page Analysis (browser-use)

One-time structural analysis of a target page using the `browser-use` Python library. Invoked on first encounter and on crawler failure — never on routine scheduled runs.

- **FR-2.1** browser-use loads and renders the target URL. The AI identifies: the primary content area, pagination or load-more interactions, key field locations (title, body, date, author, URL), and any dynamic load patterns.
- **FR-2.2** Analysis output is stored as structured JSON in the database, linked to the corresponding `content.source` record. [ASSUMPTION: new `crawler_analysis` table needed — schema to be defined with architecture team; see OQ-1]
- **FR-2.3** Analysis is not re-triggered unless a crawler failure event fires (FR-7).
- **FR-2.4** Analysis output JSON must include at minimum: `content_selector` (CSS/XPath for body), `title_selector`, `date_selector`, `author_selector`, `url_selector`, `pagination_type` (none / click / scroll), `dynamic_load` (boolean), and `notes` (free text for edge cases). This contract is the primary input to Playwright code generation (F-3).
- **FR-2.5** The prompt used for analysis is versioned; prompt version is stored alongside the analysis record to support future comparisons.

---

### F-3 · crawl4ai Crawler Generation

The AI generates a Python crawl4ai crawler script from the browser-use analysis output. [**Revised per ADR-013-R1, ADR-014-R1** — original design used TypeScript Playwright; execution layer changed to Python crawl4ai]

- **FR-3.1** From the structured analysis (FR-2.2), the AI generates a Python crawl4ai crawler script (using `JsonCssExtractionStrategy`) that extracts: `title`, `body`, `published_at`, `author`, `url`, and `canonical_url`. The TypeScript scheduler invokes this via `POST /crawler/execute`. `summary` and `why_it_matters` are generated downstream by the AI scoring step and are out of scope for the crawler output contract.
- **FR-3.2** Generated code is stored in the database (`crawler_registry` table) as the canonical status and metadata record. [ASSUMPTION: new table; schema TBD — see OQ-1]
- **FR-3.3** A PR is automatically opened targeting `python_services/crawlers/generated/`. The merged file in the codebase is the executable source of truth; the DB record tracks status (active / deprecated / pending-review). [**Revised per ADR-014-R1** — original path was `packages/pipeline/src/newly-discovered/sources/generated/`]
- **FR-3.4** The PR description includes: source name, analysis summary, key selectors used, and generation timestamp.
- **FR-3.5** A crawler is activated only after the PR is manually reviewed and merged.
- **FR-3.6** `browser_use_only: true` sources skip this step entirely.

---

### F-4 · Scheduled Crawling & Pipeline Integration

TypeScript-orchestrated scheduled execution of active (merged) crawl4ai crawlers via `POST /crawler/execute`.

- **FR-4.1** The scheduler invokes all active crawlers once per day.
- **FR-4.2** Crawler output is normalized to the `content.article_raw` schema before DB insert.
- **FR-4.3** Dedup logic (`representative_key_hash`, `content_hash`) is applied before insert, identical to existing pipeline behavior.
- **FR-4.4** Articles that pass dedup flow downstream to the existing AI scoring → Notion write pipeline without modification.
- **FR-4.5** Sources configured with `browser_use_only: true` skip this step and go directly to F-6.

---

### F-5 · Data Validation

Quality gate between raw crawl output and pipeline handoff.

- **FR-5.1** Each crawl run is validated on: `title` non-empty; `body` length above minimum threshold; `published_at` parseable and within the configured recency window (default: same-day or within 24 h); `url` present and valid.
- **FR-5.2** Validation failures are logged with structured error codes: `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL`.
- **FR-5.3** Partial run: valid articles pass through. Only a full-run failure (zero valid articles returned) triggers fallback.
- **FR-5.4** Per-source thresholds (from FR-1.3) override package-level defaults where specified.

---

### F-6 · Fallback — browser-use Vision Collection

When a Playwright crawler fails validation, browser-use re-collects via vision/OCR.

- **FR-6.1** Fallback activates on full-run validation failure from a Playwright crawler, or on every run for `browser_use_only: true` sources.
- **FR-6.2** browser-use loads and visually reads the page; the AI structures extracted content into the `content.article_raw` schema, including `title`, `body`, `published_at`, `author`, and `url`. `summary` and `why_it_matters` are generated by the downstream AI scoring step, not by the fallback collector.
- **FR-6.3** Fallback output passes through the same validation (FR-5) → dedup (FR-4.3) → pipeline flow as a normal crawl.
- **FR-6.4** Every fallback invocation is logged with: source name, timestamp, triggering error code, and whether collection succeeded.
- **FR-6.5** LinkedIn uses this path exclusively on every scheduled run (never F-3 or F-4).
- **FR-6.6** Threads uses the standard Playwright generation path; fallback applies on failure like any other source. [ASSUMPTION]

---

### F-7 · Crawler Auto-Regeneration

Self-healing: when fallback fires on a non-`browser_use_only` source, the broken crawl4ai crawler is automatically regenerated.

- **FR-7.1** A fallback event for a crawl4ai-managed source increments `crawler_registry.consecutive_failures`. Regeneration is queued only when the counter reaches a configurable threshold (default: 3; overridable per source via `consecutive_failures_threshold` in YAML config). Single transient failures do not trigger regeneration.
- **FR-7.2** Regeneration re-runs browser-use page analysis (F-2) against the current page structure.
- **FR-7.3** From the new analysis, the AI generates an updated Python crawl4ai crawler (F-3) and opens a new PR.
- **FR-7.4** The existing broken crawler is marked `status: deprecated` in `crawler_registry` and does not run again until replaced.
- **FR-7.5** The source continues via fallback (F-6) until the regenerated PR is merged and activated. **Note:** The original design intent was fully automatic self-healing ("works from next run"). The PR gate is a deliberate safety override — generated code is not auto-trusted in production. The fallback ensures zero data loss during the review window.
- **FR-7.6** Regeneration fires once per fallback event and does not retry if the regenerated crawler also fails validation. [ASSUMPTION: loop prevention — further escalation path TBD; see OQ-5]

---

### F-8 · Notion Output

No changes to the existing Notion write pipeline.

- **FR-8.1** Articles inserted to `content.article_raw` flow to Notion via the existing Notion write logic.
- **FR-8.2** Notion DB schema, write logic, and daily backup cron are unchanged.

---

## Non-Functional Requirements

| ID | Area | Requirement |
|----|------|-------------|
| NFR-1 | **Cost** | browser-use invoked ≤ 1× per source per stable period. Never invoked on routine scheduled runs (crawl4ai execution path only). **Exception: LinkedIn runs browser-use on every daily cycle** — this is an accepted ongoing cost (~$0.10/run/source) with no crawl4ai alternative. |
| NFR-2 | **Reliability** | crawl4ai failures surface within one scheduled cycle via structured logs. Fallback fires before the next cycle. Per-source consecutive-failure count and last-success timestamp must be queryable. [ASSUMPTION: plugs into existing pipeline monitoring — see OQ-4] |
| NFR-3 | **Crawl latency** | crawl4ai execution path (via `POST /crawler/execute`): ≤ 5 min per source per run. [**Revised per ADR-013-R1**] |
| NFR-4 | **PR reviewability** | Generated crawler code must be human-readable Python. A reviewer should be able to assess correctness in < 10 min. [**Revised per ADR-014-R1**] |
| NFR-5 | **Security** | No credentials or secrets embedded in generated crawler files. Authentication configs use existing env var patterns only. |
| NFR-6 | **Compliance** | LinkedIn and Threads access via browser-use should be reviewed against each platform's ToS prior to production use. [NOTE FOR PM] |

---

## Open Questions

| # | Question | Owner | Phase-blocker? |
|---|----------|-------|----------------|
| OQ-1 | Schema for `crawler_registry` and `crawler_analysis` tables — fields, indexes, FK to `content.source` | Architecture | **Yes** — required before implementation |
| OQ-2 | Threads classification confirmed? Playwright generation attempted, fallback on failure — or browser-use only? | Product | No — assumed Playwright; `browser_use_only: true` covers the fallback case |
| OQ-3 | PR target: `main` branch, or a dedicated `generated-crawlers` branch with a separate merge policy? | Engineering | No — assumed `main` |
| OQ-4 | Existing pipeline monitoring: does this package need new alerting infrastructure, or does it plug into what's already there? | Engineering | No |
| OQ-5 | Regeneration loop: what happens if the regenerated crawler also fails validation? Manual escalation? Permanent fallback? | Engineering | No |
| OQ-6 | LinkedIn and Threads ToS review for browser-use-based visual collection | **Legal / PM — owner must be assigned before Epic 3 sprint begins** | No — required before production launch |
| OQ-7 | Notion Source Registry: which Notion DB is used, and what are the exact property names for URL, source name, source type, and `browser_use_only` flag? | Product / Engineering | **Yes** — needed before Notion sync implementation |

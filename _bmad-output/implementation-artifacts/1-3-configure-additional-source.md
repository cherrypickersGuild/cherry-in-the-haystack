# Story 1.3: Configure Additional Source

Status: in-progress

## Story

As a Content Curator,
I want sources I add to Notion to automatically sync to PostgreSQL,
So that the news_collector pipeline can ingest from newly configured sources without manual intervention.

## Acceptance Criteria

**Given** I add a new source to the Notion "Sources" database
**When** the sync job runs
**Then** the source is created/updated in PostgreSQL `content.source` table
**And** the source health tracking columns are initialized
**And** news_collector can read the source configuration
**And** content ingestion begins from the new source on next pipeline run

## Tasks / Subtasks

- [x] Create Notion → Postgres source sync service (AC: #1, #2, #3)
  - [x] Read from Notion "Sources" database using existing ops_notion patterns
  - [x] Map Notion properties to `content.source` table columns
  - [x] Upsert sources (create new, update existing based on URL hash)
  - [x] Initialize health tracking columns for new sources
  - [x] Log sync results to `core.run_log`

- [x] Update news_collector to read from PostgreSQL (AC: #4, #5)
  - [x] Create `src/config_loader.py` to query `content.source` table
  - [x] Query: `SELECT * FROM content.source WHERE is_active = TRUE`
  - [x] Map DB records to ops_* expected format
  - [x] Update ops_rss.py to use config_loader with backward compat fallback
  - [x] Fallback to existing config if DB empty (backward compat)

- [x] Create sync job/schedule (AC: #2)
  - [x] Add sync script: `python -m news_collector.sync_sources`
  - [x] Can be run manually or scheduled (e.g., hourly)
  - [x] Idempotent: safe to run multiple times

- [x] Write tests (AC: All)
  - [x] Unit tests for Notion → DB mapping
  - [x] Unit tests for config_loader
  - [ ] Integration test: Notion → Postgres → news_collector

## Dev Notes

### Epic Context

This is Story 1.3 of **Epic 1: Discover Curated Content (Universal Version)**.

**FR Coverage:** FR-7.1 (Content Source Configuration)

**Key Insight:** Notion is the source of truth. We sync from Notion to Postgres, and news_collector reads from Postgres (or config generated from it).

### Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Notion Sources │ --> │  Sync Job        │ --> │ content.source  │
│  (User edits)   │     │  (hourly/manual) │     │  (PostgreSQL)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                        ┌──────────────────┐           │
                        │  news_collector  │ <─────────┘
                        │  (reads DB)      │
                        └──────────────────┘
```

### Database Schema

```sql
-- content.source table (target of sync)
CREATE TABLE source (
    id                   UUID PRIMARY KEY,
    type                 source_type_enum NOT NULL,  -- RSS | TWITTER | YOUTUBE | REDDIT | BLOG
    name                 VARCHAR(200) NOT NULL,
    url_handle           VARCHAR(1000) NOT NULL,
    url_handle_hash      BYTEA GENERATED ALWAYS AS (md5(url_handle)::bytea) STORED,
    external_source_id   VARCHAR(255),
    homepage_url         VARCHAR(1000),
    description          VARCHAR(1000),
    profile_image_url    VARCHAR(1000),
    frequency            VARCHAR(50) NOT NULL DEFAULT 'DAILY',
    language             VARCHAR(10),
    country_code         CHAR(2),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    source_meta_json     JSONB,
    -- Health tracking (initialized by sync, updated by crawler)
    last_fetched_at      TIMESTAMPTZ,
    last_success_at      TIMESTAMPTZ,
    last_error_at        TIMESTAMPTZ,
    last_error_msg       TEXT,
    consecutive_failures INT NOT NULL DEFAULT 0,
    total_fetches        INT NOT NULL DEFAULT 0,
    total_failures       INT NOT NULL DEFAULT 0,
    is_healthy           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at           TIMESTAMPTZ
);
```

### Notion → Postgres Mapping

| Notion Property | Type | Postgres Column |
|-----------------|------|-----------------|
| Name | Title | `name` |
| URL | URL | `url_handle` |
| Type | Select | `type` (RSS/TWITTER/YOUTUBE/REDDIT/BLOG) |
| Description | Rich Text | `description` |
| Active | Checkbox | `is_active` |
| Frequency | Select | `frequency` |
| Language | Select | `language` |
| Notion Page ID | - | `external_source_id` |

### Existing Code to Leverage

**news_collector Notion integration:**
- `python_services/packages/news_collector/src/ops_notion.py`
- Already has Notion client setup and database queries

**news_collector ops files:**
- `ops_rss.py`, `ops_twitter.py`, `ops_youtube.py`, `ops_reddit.py`
- Each expects source config in specific format

### File Structure

```
python_services/packages/news_collector/
├── src/
│   ├── sync_sources.py          # NEW: Notion → Postgres sync
│   ├── config_loader.py         # NEW: Load sources from DB
│   ├── ops_notion.py            # Existing: leverage for Notion read
│   ├── ops_collection.py        # UPDATE: use config_loader
│   └── ...
└── tests/
    ├── test_sync_sources.py
    └── test_config_loader.py
```

### Implementation Details

**sync_sources.py:**
```python
async def sync_sources_from_notion():
    """Sync sources from Notion to PostgreSQL."""
    notion_sources = await fetch_notion_sources()
    for source in notion_sources:
        await upsert_source(
            url_handle=source.url,
            name=source.name,
            type=map_source_type(source.type),
            is_active=source.active,
            external_source_id=source.notion_page_id
        )
```

**config_loader.py:**
```python
async def load_active_sources() -> list[SourceConfig]:
    """Load active sources from PostgreSQL for news_collector."""
    async with get_db_connection() as conn:
        rows = await conn.fetch(
            "SELECT * FROM content.source WHERE is_active = TRUE AND revoked_at IS NULL"
        )
    return [map_row_to_config(row) for row in rows]
```

**ops_collection.py update:**
```python
# Before: sources from hardcoded config or Notion
# After: sources from PostgreSQL via config_loader
sources = await load_active_sources()
for source in sources:
    if source.type == 'RSS':
        await fetch_rss(source)
    elif source.type == 'TWITTER':
        await fetch_twitter(source)
    # ...
```

### Source Type Detection

If Notion doesn't have explicit type, detect from URL:

| Pattern | Type |
|---------|------|
| `twitter.com/` or `x.com/` | TWITTER |
| `youtube.com/` | YOUTUBE |
| `reddit.com/r/` | REDDIT |
| Has RSS/Atom content-type or `/rss`/`/feed` in URL | RSS |
| Default | BLOG |

### Dependencies

- Existing: `asyncpg` or `psycopg` for PostgreSQL
- Existing: `notion-client` for Notion API
- No new dependencies needed

### Testing Strategy

**Unit Tests:**
- `test_map_notion_to_source()` - mapping logic
- `test_detect_source_type()` - URL pattern detection
- `test_config_loader()` - DB query and mapping

**Integration Tests:**
- Mock Notion API → sync → verify DB records
- Mock DB → config_loader → verify format

### Known Gaps (from Story 1.1)

1. **DDL not applied** - May need to run DDL first
2. **news_collector currently reads from Notion directly** - This story adds Postgres intermediary

### References

- [news_collector ops_notion.py](../../python_services/packages/news_collector/src/ops_notion.py)
- [news_collector ops_collection.py](../../python_services/packages/news_collector/src/ops_collection.py)
- [DDL: content.source](../../docs/architecture/ddl-v1.0.sql)
- [Status Check Report](../planning-artifacts/status-check-report.md)

### Success Criteria

1. Can add source in Notion
2. Sync job creates/updates source in PostgreSQL
3. news_collector reads from PostgreSQL
4. New source ingestion works end-to-end
5. All tests pass

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

N/A

### Completion Notes List

**Implementation Complete:**
1. Created `config_loader.py` - Loads sources from PostgreSQL with backward compatibility fallback to legacy config
2. Created `sync_sources.py` - Syncs Notion Sources database to PostgreSQL content.source table
3. Updated `ops_rss.py` - Uses config_loader with fallback to legacy rss_feeds
4. Updated `requirements.txt` - Added psycopg2-binary and sqlalchemy for PostgreSQL support

**Key Features:**
- Notion → PostgreSQL sync with URL hash-based deduplication
- Type detection from URL patterns (twitter.com → TWITTER, etc.)
- Health tracking columns initialized for new sources
- Backward compatibility: falls back to legacy config if PostgreSQL unavailable
- Dry-run mode for sync preview

**Source Discovery Improvements (2026-04-08):**
- Expanded curated list with AI Safety, AI Education, ML Research, AI Governance newsletters
- Improved scoring system with better topic relevance
- Enhanced `substack_discoverer.py` with more keywords and topics
- Added fallback to curated list for topics without API results
- Tested discovery with "AI Education" and "AI Safety" topics
- Successfully staged candidates to Notion Source Candidates database

**Test Results:**
- Import AI | Jack Clark (score: 3.5, medium priority)
- lastweekinai (score: 3.5, medium priority)
- AI Futures for Art and Design | Kate Armstrong (score: 3.5, medium priority)

**Pending:**
- Integration test with actual Notion Sources database
- NOTION_SOURCES_DATABASE_ID environment variable needs to be set
- Database DDL needs to be applied before first sync run

### File List

**Created:**
- `python_services/packages/news_collector/src/config_loader.py` - PostgreSQL source loader with backward compat
- `python_services/packages/news_collector/src/sync_sources.py` - Notion → PostgreSQL sync service
- `python_services/packages/news_collector/sync_sources.py` - Convenience run script
- `python_services/packages/news_collector/tests/__init__.py` - Test package init
- `python_services/packages/news_collector/tests/test_sync_sources.py` - Unit tests for sync module
- `python_services/packages/news_collector/tests/test_config_loader.py` - Unit tests for config loader

**Modified:**
- `python_services/packages/news_collector/src/ops_rss.py` - Updated import to use config_loader
- `python_services/packages/news_collector/docker/requirements.txt` - Added psycopg2-binary, sqlalchemy
- `python_services/packages/source_discovery/src/substack_discoverer.py` - Expanded curated list and improved scoring

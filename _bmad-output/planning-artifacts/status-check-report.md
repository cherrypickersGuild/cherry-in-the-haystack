# Status Check Report

**Generated:** 2026-04-07
**Story:** 1.1 - Status Check
**Epic:** Epic 1 - Discover Curated Content (Universal Version)

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Database Schema (DDL) | ✅ Complete | 7 schemas, 50+ tables defined |
| Docker Infrastructure | ✅ Running | PostgreSQL, GraphDB, Redis configured |
| Python Services | 🟡 Partial | `news_collector`, `text_extract_ideas`, agents working |
| TypeScript Pipeline | ❌ Missing | `packages/pipeline/` empty - not needed if Python used |
| Notion Integration | ✅ Working | Full sync with databases |
| PostgreSQL Sync | ❌ Missing | Python services → DDL tables sync needed |

**Overall Health:** 🟡 **PARTIAL** - Core infrastructure exists, gaps in PostgreSQL alignment

---

## 1. Database Schema

**DDL Location:** `docs/architecture/ddl-v1.0.sql`
**Database:** `cherry_platform` (PostgreSQL 16 + pgvector)

### Schema Overview

| Schema | Purpose | Table Count | Status |
|--------|---------|-------------|--------|
| `core` | User accounts, prompt templates, run logs | 3 | ✅ Defined |
| `personal` | User preferences, follows, custom concepts | 5 | ✅ Defined |
| `content` | Sources, articles, entities, categories | 10 | ✅ Defined |
| `handbook` | Books, chapters, paragraphs, embeddings | 8 | ✅ Defined |
| `concept` | Concept pages, changelogs | 2 | ✅ Defined |
| `snapshot` | Statistics and pre-built views | 8 | ✅ Defined |
| `publishing` | Newsletters, recipients, send logs | 4 | ✅ Defined |

### Key Tables by Epic

#### Epic 1: Discover Curated Content (FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3, FR-5.1, FR-7.1, FR-9.1)

| Table | Purpose | FR Coverage |
|-------|---------|-------------|
| `content.source` | Content source configuration | FR-7.1 |
| `content.source_submission` | Community URL submissions | FR-6.1 |
| `content.article_raw` | Fetched articles with deduplication | FR-1.1, FR-9.1 |
| `content.tracked_entity` | Global entity registry (models, frameworks, tools) | FR-2.3 |
| `content.entity_category` | Page-scoped categories | FR-4.1 |
| `content.tracked_entity_placement` | Canonical page/category mapping | FR-4.1 |
| `content.side_category` | Side categories for articles | FR-4.1 |
| `content.user_article_state` | User-article relationships (final confirmed entity) | FR-2.2 |
| `content.user_article_ai_state` | AI draft snapshot (representative entity, score, summary) | FR-2.1, FR-2.3 |
| `content.curated_article` | Published articles with review status | FR-2.2, FR-5.1 |
| `core.run_log` | Pipeline execution tracking | FR-5.1 |

#### Epic 2: Learn Structured Concepts (FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-7.2, FR-8.1)

| Table | Purpose | FR Coverage |
|-------|---------|-------------|
| `handbook.book` | Curated source metadata | FR-7.2 |
| `handbook.chapter` | Chapter/section hierarchy | FR-3.3 |
| `handbook.section` | LLM-detected sections | FR-3.3 |
| `handbook.paragraph_chunk` | Evidence paragraphs with deduplication | FR-3.3, FR-9.1 |
| `handbook.idea_group` | Deduplicated concept groups | FR-3.2 |
| `handbook.key_idea` | Extracted concepts | FR-3.2 |
| `handbook.paragraph_concept_link` | Paragraph → concept links | FR-3.2 |
| `handbook.evidence_metadata` | LLM quality assessment | FR-2.3 |
| `handbook.paragraph_embedding` | Vector embeddings (pgvector) | FR-9.1 |
| `handbook.processing_progress` | Pipeline progress tracking | FR-5.1 |
| `handbook.knowledge_verification_contributor` | Knowledge Team members | FR-3.3 |
| `concept.page` | Generated concept pages | FR-4.2 |
| `concept.changelog` | Concept page changes | FR-8.1 |

#### Epic 3: Web Platform (FR-5.2, FR-6.1, FR-8.1)

| Table | Purpose | FR Coverage |
|-------|---------|-------------|
| `snapshot.platform_weekly_stat` | Platform-level weekly statistics | FR-5.2 |
| `snapshot.entity_stat` | Entity-level statistics | FR-5.2 |
| `snapshot.entity_page_weekly_list` | Weekly article lists per page | FR-5.2 |
| `snapshot.keyword_daily_stat` | Keyword mentions | FR-5.2 |

### DDL Applied Status

| Status | Notes |
|--------|-------|
| ❌ **NOT APPLIED** | DDL exists but not run against PostgreSQL |
| 📝 Action Required | Run DDL to create schemas and tables |

---

## 2. Pipeline Jobs

### Existing Python Services

| Service | Location | Function | Epic |
|---------|----------|----------|------|
| **news_collector** | `python_services/packages/news_collector/` | Source fetch, deduplication, AI scoring, summarization, Notion sync | Epic 1 |
| **text_extract_ideas** | `python_services/packages/text_extract_ideas/` | PDF parsing, hierarchy detection, idea extraction | Epic 2 |
| **news_agent** | `python_services/packages/agent/news_agent/` | FastAPI server, news processing | Epic 1 |
| **writer_agent** | `python_services/packages/agent/writer_agent/` | Knowledge graph → Markdown generation | Epic 2 |
| **idea_to_graph_ontology** | `python_services/packages/idea_to_graph_ontology/` | Ontology extraction | Epic 2 |

### news_collector Pipeline (Epic 1)

**Implemented Flows:**

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Source Fetch    │ -> │ Deduplicate  │ -> │ AI Score    │ -> │ Notion Sync  │
│ (RSS/Twitter/   │    │ (Milvus/     │    │ (LLM        │    │ (ToRead DB)  │
│  YouTube/Reddit)│    │  ChromaDB)   │    │  Relevance) │    │              │
└─────────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

**Files:**
- `src/ops_rss.py` - RSS feed fetching
- `src/ops_twitter.py` - Twitter API integration
- `src/ops_youtube.py` - YouTube API integration
- `src/ops_reddit.py` - Reddit API integration
- `src/ops_collection.py` - Collection orchestration
- `src/llm_agent.py` - LLM scoring & summarization
- `src/ops_notion.py` - Notion database management
- `src/ops_milvus.py` - Vector DB deduplication

**Status:** ✅ Working, writes to Notion only

**Gap:** Does NOT write to PostgreSQL `content.*` tables (needs sync service)

---

### text_extract_ideas Pipeline (Epic 2)

**Implemented Flow:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF/HTML Input  │ -> │ Hierarchy Detect │ -> │ Idea Extract    │
│                 │    │ (TOC + LLM)       │    │ (Concept Nouns) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              |                         |
                              v                         v
                       ┌──────────────┐           ┌─────────────┐
                       │ Chapters/    │           │ Key Ideas   │
                       │ Sections     │           │ (grouped)   │
                       └──────────────┘           └─────────────┘
```

**Files:**
- `src/workflow/workflow.py` - Pipeline orchestration
- `src/workflow/nodes/detect_structure.py` - PDF hierarchy detection
- `src/workflow/nodes/extract_text.py` - Text extraction
- `src/workflow/nodes/process_section.py` - Section processing
- `src/utils/pdf/parser.py` - PDF parsing utilities
- `src/utils/pdf/hierarchy_detector.py` - TOC & pattern detection
- `src/prompts/extraction.py` - LLM prompts for idea extraction

**Status:** ✅ Working, writes to local PostgreSQL

**Gap:** Schema mismatch with DDL (uses `books`/`chapters` vs `handbook.book`/`handbook.chapter`)

---

### Expected vs Actual Jobs

| Expected Job | Status | Notes |
|--------------|--------|-------|
| source-fetch | ✅ `news_collector` | Implemented in Python |
| article-ai-process | ✅ `llm_agent.py` | Implemented in Python |
| deduplication | ✅ `ops_milvus.py` | Implemented in Python |
| weekly-publish | 🟡 `ops_collection.py` | To Notion only, needs GitHub sync |
| newly-discovered-build | ❌ Missing | Needs implementation |
| embedding-build | 🟡 `embedding_openai.py` | Exists, needs DDL integration |
| writer-agent | ✅ `writer_agent/` | Implemented in Python |

---

## 3. Infrastructure Components

### Docker Services

| Service | Status | Health Check | Port | Purpose |
|---------|--------|--------------|------|---------|
| **PostgreSQL** | ✅ Configured | `pg_isready` | 5432 | Primary database (DDL not applied) |
| **GraphDB** | ✅ Configured | HTTP `/rest/repositories` | 7200 | Knowledge graph (Concept/Evidence layers) |
| **Redis** | ✅ Configured | `redis-cli ping` | 6379 | Caching layer |

**Volumes:**
- `postgres_data` - PostgreSQL persistence
- `graphdb_data` - GraphDB persistence
- `redis_data` - Redis persistence

**Status:** All services configured, ready to run

---

## 4. Environment Configuration

### Required Variables (from `.env.example`)

| Variable | Purpose | Status | Critical For |
|----------|---------|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection | 🟡 Needs DDL applied | All pipelines |
| `NOTION_API_TOKEN` | Notion integration | ✅ Used by news_collector | Epic 1 |
| `ANTHROPIC_API_KEY` | Claude API | ✅ Used by llm_agent | Epic 1, 2 |
| `GITHUB_TOKEN` | GitHub commits | 🟡 Not yet used | Epic 1 |
| `SLACK_WEBHOOK_URL` | Pipeline alerts | 🟡 Not yet used | Monitoring |
| `TWITTER_BEARER_TOKEN` | Twitter API | ✅ Used by ops_twitter | Epic 1 |
| `REDDIT_CLIENT_ID` | Reddit API | ✅ Used by ops_reddit | Epic 1 |
| `REDDIT_CLIENT_SECRET` | Reddit API | ✅ Used by ops_reddit | Epic 1 |

### Additional Variables (from Python services)

| Variable | Purpose | Used By |
|----------|---------|---------|
| `NOTION_TOKEN` | Notion API key (same as NOTION_API_TOKEN) | news_collector |
| `NOTION_ENTRY_PAGE_ID` | Notion root page ID | news_collector |
| `OPENAI_API_KEY` | OpenAI embeddings | news_collector |
| `MILVUS_*` | Milvus vector DB config | news_collector |

---

## 5. Gaps & Issues

### Critical Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **DDL not applied to PostgreSQL** | Tables don't exist, can't sync data | 🔴 HIGH |
| 2 | **Notion → PostgreSQL sync missing** | Python services write to Notion only, webapp can't read from DB | 🔴 HIGH |
| 3 | **text_extract_ideas schema mismatch** | Uses different table names than DDL | 🟠 MEDIUM |
| 4 | **No raw HTML storage** | DDL supports `external_storage_key`, not implemented | 🟠 MEDIUM |
| 5 | **No TypeScript pipeline** | `packages/pipeline/` empty (may not be needed if Python used) | 🟡 LOW |

### Schema Inconsistencies

| Service | Current Schema | DDL Schema | Gap |
|---------|---------------|------------|-----|
| text_extract_ideas | `books` | `handbook.book` | Table name + 8 missing columns |
| text_extract_ideas | `paragraph_chunks` | `handbook.paragraph_chunk` | Table name + 9 missing columns |
| text_extract_ideas | *(none)* | `handbook.paragraph_embedding` | Missing table |
| news_collector | *(none)* | `content.article_raw` | No PostgreSQL write |

### Missing Infrastructure Components

| Component | Purpose | Status |
|-----------|---------|--------|
| DDL Migration Scripts | Apply schema to PostgreSQL | ❌ Missing |
| Notion → PostgreSQL Sync Service | Sync Notion ToRead DB to content.* tables | ❌ Missing |
| GitHub Actions Workflows | Weekly publish automation | ❌ Missing |
| Snapshot Build Jobs | Generate `snapshot.*` tables | ❌ Missing |

---

## 6. Recommendations

### Immediate (Epic 1 - This Week)

1. **Apply DDL to PostgreSQL**
   ```bash
   psql -U cherry -d cherry_db -f docs/architecture/ddl-v1.0.sql
   ```

2. **Create Notion → PostgreSQL Sync Service**
   - Read from Notion ToRead database
   - Write to `content.article_raw`, `content.user_article_ai_state`
   - Store raw HTML in `content.article_raw.content_raw`

3. **Align text_extract_ideas Schema**
   - Update SQLAlchemy models to match DDL
   - Run migration to rename tables to `handbook.*`
   - Add missing columns for embeddings, deduplication

### Short-term (Epic 2 - Next Sprint)

4. **Implement Vector Embeddings**
   - Generate embeddings for `handbook.paragraph_chunk`
   - Store in `handbook.paragraph_embedding` (pgvector)
   - Enable deduplication via `paragraph_hash` + `simhash64`

5. **Complete Writer Agent Integration**
   - Connect GraphDB → Writer Agent → Markdown
   - Generate `concept.page` content
   - Auto-create `concept.changelog` entries

### Long-term (Epic 3+)

6. **Build Snapshot Generation**
   - Weekly `snapshot.platform_weekly_stat` job
   - Per-user `snapshot.user_weekly_stat` job
   - Enable O(1) reads for webapp

7. **Implement GitHub Actions**
   - Weekly publish workflow
   - Automated deployment on Notion approval

---

## 7. Next Steps for Story 1.1

Based on this status check, **Story 1.1 is complete** (report generated).

**Recommended next story:**

- **Option A:** Story 1.2 (Daily Publication Pipeline) - Implement Notion → PostgreSQL sync
- **Option B:** Story 1.3 (Discover & Configure Additional Source) - Add new sources to pipeline
- **Option C:** Story 2.1 (Epic 2 Status Check) - Audit knowledge graph infrastructure

---

## Appendix: File Inventory

### Python Services (Existing)

```
python_services/
├── packages/
│   ├── news_collector/          # Epic 1: Content pipeline
│   │   ├── src/
│   │   │   ├── ops_rss.py       # RSS fetching
│   │   │   ├── ops_twitter.py   # Twitter API
│   │   │   ├── ops_youtube.py   # YouTube API
│   │   │   ├── ops_reddit.py    # Reddit API
│   │   │   ├── ops_collection.py# Orchestration
│   │   │   ├── llm_agent.py     # AI scoring
│   │   │   ├── ops_notion.py    # Notion sync
│   │   │   └── ops_milvus.py    # Vector DB dedup
│   │   └── dags/
│   │       ├── collect_weekly.py
│   │       ├── journal_daily.py
│   │       └── sync_dist.py
│   ├── text_extract_ideas/      # Epic 2: Evidence pipeline
│   │   ├── src/
│   │   │   ├── workflow/
│   │   │   ├── db/models.py     # SQLAlchemy models (⚠️ schema mismatch)
│   │   │   ├── utils/pdf/       # PDF parsing
│   │   │   └── prompts/         # LLM prompts
│   │   └── run_pipeline.py
│   ├── agent/
│   │   ├── news_agent/          # FastAPI news server
│   │   └── writer_agent/        # Knowledge graph → Markdown
│   └── idea_to_graph_ontology/  # Ontology extraction
└── api.py                       # Main API entry point
```

### TypeScript (Missing/Empty)

```
packages/pipeline/               # ❌ Empty - not needed if Python used
└── src/
    └── index.ts                 # Empty export
```

### Documentation (Existing)

```
docs/
├── PRD/
│   ├── index.md
│   ├── functional-requirements.md
│   └── non-functional-requirements.md
├── architecture/
│   ├── ddl-v1.0.sql            # ✅ Complete DDL
│   ├── epic-to-architecture-mapping.md
│   └── index.md
├── epics.md                     # ✅ All 7 epics defined
└── ux-design-specification.md
```

---

**Report End**

# Architecture

## Executive Summary

cherry-in-the-haystack builds **Cherry for AI Engineers** through a two-layer knowledge architecture: Evidence Layer (PostgreSQL for source paragraphs with `extracted_concept` linkage) + Concept Layer (GraphDB for normalized concept ontology). Three pipelines operate in parallel: (1) **Newly Discovered** — custom news ingestion pipeline scores content → Notion serves as the primary Knowledge Team review workspace → daily Postgres backup → weekly GitHub publication; (2) **Basics/Advanced** — source documents chunk into evidence paragraphs → concept extraction and graph normalization → Writer Agent synthesizes four-section handbook pages; (3) **Newsletter Studio** (future Phase 2, not in current epics). The web application and data pipeline are built in TypeScript with Next.js. AI/LLM-specific modules (concept extraction, Writer Agent synthesis) use Python. Pipeline scheduling uses cron with no external orchestration dependency. Content is served through the Next.js web application. The architecture prioritizes automation, cost tracking per LLM call, weekly update velocity, and zero-hallucination synthesis (all claims trace to evidence).

---

## Project Initialization

**First Implementation Story: Handbook Foundation Setup (Story 1.1)**

This project is brownfield — the existing `dev/` packages must be preserved and adapted, not replaced.

### Next.js Application Setup

```bash
# Web application + API backend
pnpm create next-app apps/web --typescript --app --tailwind --eslint
cd apps/web
pnpm add @prisma/client notion-client
pnpm add -D prisma typescript @types/node
```

### TypeScript Pipeline Package Setup

```bash
# Data pipeline scripts (cron jobs)
mkdir -p packages/pipeline/src/jobs
cd packages/pipeline
pnpm init
pnpm add tsx typescript notion-client @anthropic-ai/sdk openai
pnpm add -D @types/node
```

### Python AI Modules Setup

```bash
# LLM-specific modules (concept extraction, Writer Agent)
poetry init
poetry add psycopg[binary] loguru tenacity anthropic openai
poetry add --group dev ruff mypy pytest pytest-cov
```

### Brownfield Adaptation Note

- `dev/packages/ontology/` → Adapt to `handbook/db_connection/graph_db.py`
- `dev/packages/pdf_knowledge_extractor/` → Adapt to `handbook/pipeline/evidence_ingestion/document_chunker.py`
- `dev/apps/agent/writer_agent/` → Adapt to `handbook/pipeline/writer_agent/`
- `dev/apps/api/` → Legacy reference only; the news ingestion pipeline is rebuilt from scratch in `packages/pipeline/`

**Starter-Provided Architectural Decisions:**

| Component | Decision | Version |
|---|---|---|
| Web Framework | Next.js (App Router) | latest |
| Frontend Language | TypeScript | 5.9+ |
| Pipeline Language | TypeScript | 5.9+ |
| AI/LLM Language | Python | 3.10+ |
| Deployment Target | AWS / Oracle | — |

---

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
|---|---|---|---|---|
| Web Language | TypeScript | 5.9+ | All | Type-safe; Next.js native; shared types across frontend and pipeline |
| AI/LLM Language | Python | 3.10+ | Epics 1, 3, 4 | Best ecosystem for LLM SDKs, embeddings, and PDF parsing |
| Web Framework | Next.js (App Router) | latest | Phase 2 | Full-stack TypeScript; API routes + SSR; single deployment unit |
| Package Manager | pnpm | latest | All TS | Workspace support; fast; disk-efficient |
| Python Deps | Poetry | 1.8+ | Epics 1, 3, 4 | Lock files; dev/prod dependency separation |
| Python Linting | Ruff | latest | Epics 1, 3, 4 | Single tool replacing flake8, black, isort |
| Python Logging | Loguru | latest | Epics 1, 3, 4 | Structured logging, superior to stdlib |
| Python Types | mypy | latest | Epics 1, 3, 4 | Static type checking for pipeline reliability |
| Python Testing | pytest + pytest-cov | latest | Epics 1, 3, 4 | Standard Python testing, coverage reporting |
| Pipeline Scheduling | Cron (system cron / node-cron) | — | Epics 2, 3, 4 | No external orchestration service; simple, reliable scheduling |
| Primary Database | PostgreSQL 16 (Amazon RDS db.t3.small) | 16 | Epics 1, 2, 3, 4 | Evidence Layer; ~$25/month; point-in-time recovery |
| PostgreSQL Driver (Python) | psycopg3 | latest | Epics 1, 3, 4 | Modern async-capable Postgres adapter with type hints |
| PostgreSQL Driver (TS) | Prisma or postgres.js | latest | Phase 2 | Type-safe ORM / query builder for Next.js API routes |
| Graph Database | GraphDB (RDF, self-hosted) | latest | Epics 1, 3, 4 | Free open-source; RDF standard; no production licensing cost |
| Vector Store | pgvector (PostgreSQL extension) | latest | Epics 1, 3 | No separate infrastructure; sufficient for ~100K vectors |
| Content Deployment | Next.js webapp (AWS / Oracle) | — | Epics 1, 4 | Full-stack TypeScript; content served from database via API routes |
| CI/CD | GitHub Actions | — | Epics 1, 5 | Existing infrastructure; build, test, and deploy pipeline |
| Local Dev | Docker Compose | — | Epic 1 | PostgreSQL 16 + pgvector + GraphDB; 30-min onboarding target |
| Review Workspace | Notion API v2 (source of truth) | v2 | Epics 1, 2 | KT already uses Notion; eliminates custom review UI |
| LLM — Synthesis | Claude 3.5 Sonnet | claude-3-5-sonnet-latest | Epics 3, 4 | 200K context; superior concept extraction and prose quality |
| LLM — Embeddings | OpenAI text-embedding-3-small | 1536 dims | Epics 1, 3 | $0.02/1M tokens; sufficient quality for semantic search |
| LLM — Fallback | Gemini Flash | latest | Epics 3, 4 | When Claude unavailable after 2 retries; cost-effective |
| Python Retry | tenacity | latest | Epics 1, 3, 4 | Exponential backoff with jitter for external API calls |
| Content Format | Markdown | — | Epics 2, 4, 5 | Supports frontmatter metadata; rendered by Next.js webapp |
| Notion Client (TS) | notion-client (official SDK) | latest | Epics 1, 2 | Official SDK; handles auth and pagination |
| GitHub Automation | Octokit or GitHub API | latest | Epics 2, 4 | Bot account atomic commits; TypeScript native |

---

## Project Structure

```
cherry-in-the-haystack/
│
├── apps/
│   └── web/                            # Next.js application (TypeScript)
│       ├── app/
│       │   ├── (public)/               # Public routes — no auth required
│       │   │   ├── basics/[slug]/
│       │   │   ├── advanced/[slug]/
│       │   │   └── newly-discovered/
│       │   ├── (dashboard)/            # Authenticated routes (Phase 2)
│       │   └── api/                    # Next.js API routes
│       │       ├── content/
│       │       ├── users/
│       │       └── newsletter/
│       ├── components/
│       ├── lib/
│       │   ├── db.ts                   # Postgres client (Prisma / postgres.js)
│       │   └── notion.ts               # Notion client wrapper
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── pipeline/                       # TypeScript data pipeline scripts
│       ├── src/
│       │   ├── jobs/                   # Cron job entry points
│       │   │   ├── news-ingestion.ts   # Fetch + score → Notion DB
│       │   │   ├── notion-backup.ts    # Daily 00:00 UTC: Notion → Postgres
│       │   │   ├── weekly-publish.ts   # Sunday 00:00 UTC: Notion approved → GitHub
│       │   │   └── writer-agent.ts     # Monthly: invoke Python Writer Agent
│       │   ├── newly-discovered/
│       │   │   ├── category-matcher.ts # LLM classification → category + topics
│       │   │   ├── format-dispatcher.ts # Handlebars/template → category markdown
│       │   │   └── sources/            # Source-specific fetchers
│       │   ├── publication/
│       │   │   ├── github-committer.ts # Octokit atomic commits to main
│       │   │   └── templates/          # Handlebars templates per category
│       │   └── integrations/
│       │       ├── notion-client.ts    # Notion API v2 wrapper
│       │       └── github-client.ts    # Octokit wrapper
│       ├── package.json
│       └── tsconfig.json
│
├── handbook/                           # Python AI/LLM modules
│   ├── config/
│   │   └── logging_config.py           # Loguru setup, log format, levels
│   ├── db_connection/
│   │   ├── postgres.py                 # psycopg3, connection pool (max 20), context manager
│   │   ├── graph_db.py                 # GraphDB SPARQL queries, concept CRUD
│   │   └── vector_db.py                # pgvector, cosine similarity search, batch insert
│   └── pipeline/
│       ├── evidence_ingestion/
│       │   ├── document_chunker.py     # PDF/HTML/markdown → paragraphs
│       │   ├── concept_extractor.py    # Claude → extracted_concept per paragraph
│       │   ├── concept_matcher.py      # GraphDB similarity match / create new concept
│       │   ├── graph_updater.py        # Create concept nodes, add relations
│       │   └── deduplication.py        # simhash64 + vector cosine for near-dupes
│       └── writer_agent/
│           ├── graph_query.py          # Two-step query: GraphDB + Postgres
│           ├── page_synthesizer.py     # Claude 3.5 Sonnet, four-section format
│           ├── synthesis_prompts.py    # Prompt templates per section type
│           ├── patchnote_aggregator.py # Track all page changes in patchnote.md
│           └── image_generation/
│               ├── image_agent.py      # Custom Agent for diagram planning
│               ├── mcp_client.py       # MCP Server communication
│               └── markdown_inserter.py # Insert image refs into Markdown
│
│
├── dev/                                # EXISTING — prototype packages (reference only)
│   ├── packages/
│   │   ├── ontology/                   # GraphDB prototype → adapt to handbook/db_connection/graph_db.py
│   │   └── pdf_knowledge_extractor/    # PDF extraction → adapt to handbook/pipeline/evidence_ingestion/
│   └── apps/
│       ├── agent/writer_agent/         # Writer Agent prototype → adapt to handbook/pipeline/writer_agent/
│       └── api/                        # Legacy pipeline reference (do not reuse directly)
│
├── scripts/
│   ├── setup_evidence_layer.sql        # Postgres schema migration
│   ├── setup_graph_db.py               # GraphDB schema + sample concepts
│   ├── setup_local.sh                  # Docker up + migrations + seed
│   └── backup_databases.py             # GraphDB weekly export to S3
│
├── templates/                          # Community contribution templates
│   ├── basics-template.md
│   ├── advanced-template.md
│   └── newly-discovered-template.md
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                      # PR: ruff, mypy, tsc, pytest, markdown-lint
│   │   ├── deploy.yml                  # main push: Next.js build → deploy to AWS/Oracle
│   │   └── link-check.yml             # Weekly: validate all external URLs
│   ├── ISSUE_TEMPLATE/
│   │   ├── report-error.md
│   │   └── submit-source.md
│   └── pull_request_template.md
│
├── tests/                              # pytest test suite (Python)
│   ├── unit/
│   └── integration/
│
├── docker-compose.yml                  # Postgres 16 + pgvector + GraphDB
├── package.json                        # pnpm workspace root
├── pnpm-workspace.yaml                 # Declares apps/* and packages/*
├── pyproject.toml                      # Python deps (Poetry) + Ruff + mypy config
├── .env.example                        # Required env var template
├── README.md
├── CONTRIBUTING.md
└── STYLE_GUIDE.md
```

---

## Epic to Architecture Mapping

| Epic | Goal | Primary Components |
|---|---|---|
| **Epic 1: Foundation & Core Infrastructure** | Databases, tooling, CI/CD, brownfield adaptation | `handbook/` Python setup, `scripts/setup_evidence_layer.sql`, `scripts/setup_graph_db.py`, `handbook/db_connection/`, `docker-compose.yml`, `.github/workflows/ci.yml` + `deploy.yml`, `pnpm-workspace.yaml` |
| **Epic 2: Newly Discovered Pipeline** | News ingestion → Notion → Postgres backup → GitHub weekly | `packages/pipeline/src/jobs/news-ingestion.ts`, `packages/pipeline/src/integrations/notion-client.ts`, `packages/pipeline/src/jobs/notion-backup.ts`, `packages/pipeline/src/newly-discovered/`, `packages/pipeline/src/jobs/weekly-publish.ts`, `packages/pipeline/src/publication/` |
| **Epic 3: Evidence Ingestion & Knowledge Graph** | Documents → Evidence Layer → Concept Layer | `handbook/pipeline/evidence_ingestion/`, `handbook/db_connection/graph_db.py`, `handbook/db_connection/vector_db.py` |
| **Epic 4: Writer Agent & Publication** | Knowledge graph → synthesis → webapp content | `handbook/pipeline/writer_agent/`, `packages/pipeline/src/jobs/writer-agent.ts`, `.github/workflows/deploy.yml` |
| **Epic 5: Community & Quality Operations** | PR workflow, link validation, backup | `.github/` (PR template, issue templates, CODEOWNERS), `.github/workflows/link-check.yml`, `CONTRIBUTING.md`, `STYLE_GUIDE.md`, `templates/`, `scripts/backup_databases.py` |

---

## Technology Stack Details

### Core Technologies

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Language | TypeScript | 5.9+ | Web app, API routes, data pipeline scripts |
| Language | Python | 3.10+ | AI/LLM agent modules (concept extraction, Writer Agent) |
| Web Framework | Next.js (App Router) | latest | Frontend + API backend |
| Evidence Layer | PostgreSQL | 16 (RDS db.t3.small) | Paragraphs, backups, pipeline runs |
| Concept Layer | GraphDB | latest | Normalized concept ontology, typed relations |
| Vector Search | pgvector | latest | Semantic search on Basics/Advanced only |
| LLM Synthesis | Claude 3.5 Sonnet | claude-3-5-sonnet-latest | Concept extraction + page synthesis |
| LLM Embeddings | OpenAI text-embedding-3-small | 1536 dims | Paragraph vectorization |
| Review Workspace | Notion | API v2 | Knowledge Team workflow (source of truth) |
| Scheduling | Cron (system cron / node-cron) | — | Pipeline job scheduling |
| CI/CD | GitHub Actions | — | Build, test, deploy |
| Deployment | AWS / Oracle | — | Webapp and database hosting |

### Integration Points

| Integration | Direction | Protocol | Rate Limits | Error Handling |
|---|---|---|---|---|
| Notion API | Read + Write | REST (notion-client SDK) | 3 req/sec | Exponential backoff on 429, retry on 500 |
| Claude API | Write (prompts) | REST (anthropic SDK) | Tier-dependent | Retry 2x → fallback Gemini Flash |
| OpenAI API | Write (embeddings) | REST (openai SDK) | Batch: 2048/req | Retry 3x with tenacity |
| GitHub API | Write (commits) | REST (Octokit) | 5000 req/hr | Retry on 422; atomic commits |
| Amazon RDS | Read + Write | psycopg3 / Prisma (SSL) | Max 20 pool | Connection retry; dead-letter queue |
| GraphDB | Read + Write | SPARQL/HTTP | — | Retry 3x; sub-500ms target |
| AWS S3 | Write (backups) | boto3 | — | Retry; verify upload |
| Slack Webhook | Write (alerts) | HTTP | — | Fire-and-forget; log failures |
| SMTP | Write (email alerts) | SMTP | — | Retry 3x |
| MCP Server | Read (images) | MCP protocol | — | Retry 3x; log failures |

---

## Novel Pattern Designs

### Novel Pattern 1: Two-Layer Knowledge Architecture

**Purpose:** Separates the stable, normalized concept ontology (GraphDB) from the high-volume, source-attached evidence text (Postgres). Enables clean graph traversal without polluting the concept layer with raw paragraphs.

**Core Challenge:** Knowledge from different sources describes the same concept with different words. Without normalization, the graph fragments into thousands of near-duplicate concept nodes.

**Solution:**
- Evidence Layer (Postgres): Stores raw paragraph text with an `extracted_concept` field — a normalized noun phrase (e.g., `"Retrieval-Augmented Generation"`)
- Concept Layer (GraphDB): Stores only concept metadata and typed relations. No evidence text.
- Linkage: Loose coupling via the `extracted_concept` string field (no foreign key). Writer Agent queries GraphDB for concept, then queries Postgres `WHERE extracted_concept = 'RAG'`.

**Component Responsibilities:**

| Component | Responsibility |
|---|---|
| `concept_extractor.py` | Claude extracts one normalized noun phrase per paragraph |
| `concept_matcher.py` | GraphDB semantic similarity → if match (≥0.90): use existing name; if new: create concept |
| `graph_updater.py` | Create/update concept nodes in GraphDB; maintain `evidence_count` |
| `graph_query.py` | Two-step query: GraphDB (concept + relations) → Postgres (evidence by `extracted_concept`) |

**Data Flow:**
```
Document
  → document_chunker.py (paragraph text)
  → evidence_paragraphs table (stored)
  → concept_extractor.py (Claude → "Retrieval-Augmented Generation")
  → concept_matcher.py (GraphDB: find_similar_concepts("RAG", threshold=0.90))
    ├── Match found → update extracted_concept to canonical name
    └── No match → create new concept node in GraphDB
  → evidence_paragraphs.extracted_concept = "Retrieval-Augmented Generation"
```

**Writer Agent Query Pattern:**
```python
# Step 1: GraphDB for concept + all typed relations
concept = graph_db.load_concept("Retrieval-Augmented Generation")
relations = graph_db.get_relations(concept.concept_id)
# returns: {prerequisites: [...], related: [...], subtopics: [...], extends: [...], contradicts: [...]}

# Step 2: Postgres for evidence paragraphs (via extracted_concept field)
evidence = postgres.query(
    """SELECT ep.*, em.extract_type, em.keywords, em.entities
       FROM evidence_paragraphs ep
       LEFT JOIN evidence_metadata em ON em.evidence_paragraph_id = ep.id
       WHERE ep.extracted_concept = %s
       ORDER BY ep.importance_score DESC""",
    [concept.concept_name]
)

# Step 3: Claude synthesizes
page = page_synthesizer.generate(concept, relations, evidence)
```

**Affects Epics:** Epic 1 (database setup), Epic 3 (ingestion pipeline), Epic 4 (Writer Agent)

---

### Novel Pattern 2: Notion as Primary Workspace

**Purpose:** Knowledge Team uses Notion as their native review environment. The system treats Notion as source of truth for Newly Discovered content — no custom backend review UI needed.

**Core Challenge:** Building a custom review UI would double development scope. The team already works in Notion daily.

**Solution:** News ingestion pipeline writes directly to Notion. Postgres gets a daily one-way backup for analytics, historical record, and data independence.

**Critical Rules (agents MUST follow):**
- Notion is always source of truth for Newly Discovered content
- Postgres `notion_news_backup` is read-only analytics — **never write to Postgres expecting it to update Notion**
- Data flow is ONE-WAY: Notion → Postgres (never reverse)
- Weekly publish reads from Notion (not Postgres) to get latest approved status

**Data Flow:**
```
News ingestion + dedup + AI scoring 1-5
  → notion-client.ts → Notion DB (primary)
        ↓
  Knowledge Team review (Wednesday weekly)
  - Validate summaries
  - Confirm/correct scores
  - Map to ontology (LLM-assisted)
  - Status: Pending → Approved | Rejected
        ↓
  notion-backup.ts (cron: daily 00:00 UTC)
  → notion_news_backup table (Postgres)  ← ONE-WAY ONLY
        ↓
  weekly-publish.ts (cron: Sunday 00:00 UTC)
  → Query Notion for status="Approved" since last publish
  → format-dispatcher.ts → category-specific markdown
  → github-committer.ts → atomic commit to main
  → GitHub Actions → Next.js webapp deployment
```

**Notion DB Schema (properties per page):**
```
Title         (text)
Summary       (text)
Score         (number 1-5)
Category      (select: Model Updates | Frameworks | Productivity Tools | Business Cases | How People Use AI)
Source        (text)
SourceURL     (url)
Tags          (multi-select)
ReviewStatus  (select: Pending | In Review | Approved | Rejected)
Reviewer      (person)
PublishedDate (date — set by bot after GitHub commit)
```

**Affects Epics:** Epic 1 (Notion integration setup), Epic 2 (full Newly Discovered pipeline)

---

### Novel Pattern 3: Writer Agent Four-Section Synthesis

**Purpose:** Writer Agent generates Concept Pages with a consistent four-section format (Overview → Cherries → Related Concepts → Progressive References) with MECE organization throughout. All claims trace to ingested source material — no hallucinations.

**Core Challenge:** AI synthesis without guardrails produces inconsistent structure and hallucinated claims. Multiple AI agents must produce structurally identical pages.

**Component Responsibilities:**

| Component | Responsibility |
|---|---|
| `graph_query.py` | Load concept + all relations + evidence; return `ConceptQueryResult` dataclass |
| `page_synthesizer.py` | Claude 3.5 Sonnet (200K context); structured output → Markdown |
| `synthesis_prompts.py` | Prompt templates; includes no-hallucination rule |
| `patchnote_aggregator.py` | Prepend change entry to `patchnote.md`; categorize as New/Major/Minor/Correction |

**No-Hallucination Rule (in synthesis prompt):**
```
CRITICAL: Only state facts that are directly supported by the provided evidence paragraphs.
For every claim, cite the source. Format: "[excerpt]" — [Source Title] ([paraphrase|direct|figure])
If the evidence does not support a claim, omit it.
```

**Output Format (Markdown with YAML frontmatter):**
```markdown
---
title: "Retrieval-Augmented Generation"
date: 2025-01-01
last_updated: 2025-01-01
category: basics
tags: [rag, embeddings, vector-search]
contributors: [github_username1, github_username2]
---

# Retrieval-Augmented Generation

## 1. Overview
## 2. Cherries
## 3. Related Concepts (Co-occurring) / Subtopics (Child Concepts) / Prerequisite Concepts
## 4. Progressive References (MECE Learning Path)
📚 Start Here → 📖 Next → 🎓 Deep Dive → 💡 Practical Implementation
```

**Affects Epics:** Epic 4 (Writer Agent synthesis, image generation, publication)

---

## Implementation Patterns

These patterns ensure consistent implementation across all AI dev agents working on this codebase:

### Naming Patterns

| Item | Convention | Example |
|---|---|---|
| TypeScript files | `kebab-case.ts` | `notion-client.ts`, `category-matcher.ts` |
| TypeScript functions | `camelCase` | `fetchApprovedItems()`, `commitToGitHub()` |
| TypeScript interfaces | `PascalCase` with `I` prefix optional | `NotionPage`, `ConceptQueryResult` |
| TypeScript constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `NOTION_RATE_LIMIT` |
| Python files | `lowercase_underscores.py` | `concept_matcher.py` |
| Python functions/variables | `snake_case` | `extract_concept()`, `paragraph_text` |
| Python constants | `UPPER_SNAKE_CASE` | `MAX_POOL_SIZE = 20` |
| Python classes | `PascalCase` | `ConceptQueryResult`, `GraphDBClient` |
| Python data models | `@dataclass` with type hints | `@dataclass class Concept:` |
| Test files (Python) | `test_{module_name}.py` | `test_concept_matcher.py` |
| Test files (TS) | `{module}.test.ts` | `notion-client.test.ts` |
| Markdown content files | `lowercase-with-hyphens.md` | `retrieval-augmented-generation.md` |
| Newly Discovered files | `{YYYY-MM-DD}-{slug}.md` | `2025-01-15-llama-4-release.md` |
| Cron job files | `{action}.ts` in `jobs/` | `news-ingestion.ts`, `notion-backup.ts` |
| Database tables | `snake_case` plural | `evidence_paragraphs`, `pipeline_runs` |
| Database columns | `snake_case` | `extracted_concept`, `importance_score` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `NOTION_API_TOKEN` |
| GitHub bot commits | `handbook-bot` account | `"Weekly publish: 12 items (2025-01-15)"` |

### Structure Patterns

- **Test organization:** `tests/unit/` and `tests/integration/` for Python; co-located `*.test.ts` for TypeScript
- **Config:** All external credentials via environment variables — never hardcoded, never committed
- **Idempotency:** All cron jobs must be safe to re-run (UPSERT not INSERT; check before write)
- **Job isolation:** Each cron job script is a standalone entry point — no shared state between runs
- **TypeScript/Python split:** TypeScript for orchestration, HTTP calls, Notion/GitHub integration; Python for LLM calls, PDF parsing, GraphDB queries

### Format Patterns

| Item | Format | Example |
|---|---|---|
| Dates in frontmatter | ISO 8601 `YYYY-MM-DD` | `2025-01-15` |
| Timestamps in database | `TIMESTAMP WITH TIME ZONE` (UTC) | `2025-01-15T00:00:00Z` |
| LLM structured output | Always JSON (never parse free text) | `{"concept": "RAG", "confidence": 0.95}` |
| Evidence citation in pages | `"[excerpt]" — [Source] ([type])` | `"RAG reduces hallucinations" — LLM Handbook (paraphrase)` |
| Cost tracking | `cost_cents` as `NUMERIC(10,2)` | Field in `pipeline_runs`, `evidence_paragraphs` |

---

## Consistency Rules

### Error Handling

**Python (AI modules):**
```python
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def call_external_api(payload):
    try:
        return api.call(payload)
    except RateLimitError:
        logger.warning("Rate limit hit — tenacity will retry")
        raise
    except PermanentError as e:
        logger.error(f"Permanent failure: {e}", exc_info=True)
        postgres.insert_failed_item(source="api_name", reason=str(e))
        raise
```

**TypeScript (pipeline jobs):**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const wait = Math.pow(2, attempt) * 1000;
      console.error(`Attempt ${attempt} failed, retrying in ${wait}ms`, err);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('unreachable');
}
```

**Dead-Letter Queue:** Permanent failures go to `failed_items` Postgres table with `retry_count`, `failure_reason`, `failed_at`.

**LLM Fallback Chain (Python):**
```
Claude 3.5 Sonnet → (2 retries) → Gemini Flash → (2 retries) → Log failure, skip item
```

### Logging Strategy

**Python:**
```python
from loguru import logger

logger.add("logs/pipeline_{time}.log",
    format="{time:ISO} | {level} | {name}:{function}:{line} | {message}",
    level="INFO", rotation="1 week", retention="1 month", serialize=True)

# Always include context:
logger.info("Concept extracted", concept=concept_name, confidence=score, paragraph_id=id)
logger.error("API call failed", attempt=attempt_num, exc_info=True)
```

**TypeScript:** Use `console.error` / `console.info` with structured objects; integrate with cloud logging (CloudWatch / Oracle OCI Logging) in production.

### Cost Tracking Pattern

Every LLM call (Python) records costs:

```python
postgres.update_pipeline_run(
    run_id=run_id,
    llm_tokens_used=response.usage.total_tokens,
    llm_cost_cents=calculate_cost_cents(response.usage, model_name),
    llm_provider=model_name
)
```

---

## Data Architecture

### Evidence Layer (PostgreSQL 16)

#### Newly Discovered Pipeline

```sql
CREATE TABLE raw_html_archive (
    id              SERIAL PRIMARY KEY,
    url             TEXT NOT NULL,
    html_content    TEXT,
    content_hash    VARCHAR(64),          -- SHA256 for exact dedup
    simhash64       BIGINT,
    fetched_at      TIMESTAMPTZ,
    source_type     VARCHAR(50)
);

CREATE TABLE notion_news_backup (
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
-- Used for topic-based assignment in the news ingestion pipeline
CREATE TABLE reviewers (
    id              SERIAL PRIMARY KEY,
    notion_user_id  VARCHAR(36) UNIQUE,           -- Notion person ID (UPSERT key)
    reviewer_name   TEXT NOT NULL,
    tags            JSONB,                         -- e.g. ["rag", "fine-tuning", "agents"]
    comment         TEXT,
    backed_up_at    TIMESTAMPTZ
);

-- Source registry for news ingestion pipeline (backup of Notion Data Sources DB)
-- Notion is primary — this table is a one-way backup.
CREATE TABLE data_sources (
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
```

**Usage notes:**
- `data_sources.follow = 'Following'` AND `site_status = 'Alive'` → active sources the ingestion pipeline should crawl
- `data_sources.assignee` / `reviewers.notion_user_id` → join on Notion user ID to find a reviewer's assigned sources
- `data_sources.cherry_category` → JSON array, use `@>` operator for filtering: `WHERE cherry_category @> '["RAG"]'`
- `reviewers.tags` → matched against `data_sources.cherry_category` to auto-assign reviewers by topic

---

#### Books / Evidence Pipeline

```sql
-- Ingested source documents (PDFs, HTML, markdown)
-- Actual table name in DB: books
CREATE TABLE documents (
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
CREATE TABLE chapters (
    id                BIGSERIAL PRIMARY KEY,
    document_id       BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
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
CREATE TABLE sections (
    id                BIGSERIAL PRIMARY KEY,
    document_id       BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
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

-- Paragraph-level chunks of source documents
-- Actual table name in DB: paragraph_chunks
CREATE TABLE evidence_paragraphs (
    id                      BIGSERIAL PRIMARY KEY,
    document_id             BIGINT REFERENCES documents(id),
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
    extracted_concept       VARCHAR(200),         -- Denormalized from idea_groups.canonical_idea_text; KEY LINKAGE to GraphDB
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
CREATE TABLE key_ideas (
    id              BIGSERIAL PRIMARY KEY,
    paragraph_id    BIGINT REFERENCES evidence_paragraphs(id),
    document_id     BIGINT REFERENCES documents(id),
    core_idea_text  TEXT NOT NULL,
    idea_group_id   BIGINT REFERENCES idea_groups(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Per-paragraph metadata and quality scores (used to organize Cherries section)
CREATE TABLE evidence_metadata (
    id                          BIGSERIAL PRIMARY KEY,
    evidence_paragraph_id       BIGINT REFERENCES evidence_paragraphs(id),
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
-- Actual table name in DB: paragraph_embeddings
CREATE TABLE document_embeddings (
    id                    BIGSERIAL PRIMARY KEY,
    evidence_paragraph_id BIGINT REFERENCES evidence_paragraphs(id) ON DELETE CASCADE,
    document_id           BIGINT REFERENCES documents(id),
    embedding             vector(1536),           -- OpenAI text-embedding-3-small
    body_text             TEXT,                   -- Denormalized for fast retrieval
    handbook_topic        VARCHAR(100),
    model                 TEXT DEFAULT 'text-embedding-3-small',
    embedding_cost_cents  NUMERIC(10,4),
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- Per-page/chapter granular processing tracker (enables pipeline resumability)
CREATE TABLE processing_progress (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER REFERENCES documents(id),
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
```

---

#### Operations

```sql
-- Job-level pipeline run log (complements processing_progress which is per-page granularity)
CREATE TABLE pipeline_runs (
    id              SERIAL PRIMARY KEY,
    job_name        VARCHAR(100),                 -- e.g. news-ingestion, notion-backup, writer-agent
    status          VARCHAR(50),
    items_processed INTEGER,
    llm_tokens_used INTEGER,
    llm_cost_cents  NUMERIC(10,2),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT
);

-- Dead-letter queue for failed items awaiting retry
CREATE TABLE failed_items (
    id              SERIAL PRIMARY KEY,
    source_table    VARCHAR(100),
    source_id       INTEGER,
    failure_reason  TEXT,
    retry_count     SMALLINT DEFAULT 0,
    failed_at       TIMESTAMPTZ
);

-- Community contributors registry (used for Cherries section attribution)
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

**Indexes:**
```sql
-- Newly Discovered pipeline
CREATE INDEX idx_raw_html_content_hash ON raw_html_archive(content_hash);
CREATE INDEX idx_notion_backup_page_id ON notion_news_backup(notion_page_id);
CREATE INDEX idx_data_sources_url ON data_sources(url);
CREATE INDEX idx_data_sources_follow ON data_sources(follow);
CREATE INDEX idx_data_sources_site_status ON data_sources(site_status);
CREATE INDEX idx_reviewers_notion_user_id ON reviewers(notion_user_id);

-- Books / Evidence pipeline
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_section ON documents(handbook_section);
CREATE INDEX idx_chapters_document ON chapters(document_id);
CREATE INDEX idx_sections_document ON sections(document_id);
CREATE INDEX idx_sections_chapter ON sections(chapter_id);
CREATE INDEX idx_idea_groups_canonical ON idea_groups(canonical_idea_text);             -- GraphDB linkage key
CREATE INDEX idx_evidence_extracted_concept ON evidence_paragraphs(extracted_concept);  -- CRITICAL: Writer Agent query
CREATE INDEX idx_evidence_idea_group ON evidence_paragraphs(idea_group_id);
CREATE INDEX idx_evidence_paragraph_hash ON evidence_paragraphs(paragraph_hash);
CREATE INDEX idx_evidence_simhash64 ON evidence_paragraphs(simhash64);
CREATE INDEX idx_embeddings_handbook_topic ON document_embeddings(handbook_topic);
CREATE INDEX idx_embeddings_vector ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

-- Operations
CREATE INDEX idx_contributors_active ON knowledge_verification_contributors(active);
CREATE INDEX idx_contributors_contributions ON knowledge_verification_contributors(contributions_count DESC);
```

---

### Notion Databases (Primary Workspace)

Notion is the **source of truth** for three operational databases. The Postgres tables above are one-way backups — never write to Postgres expecting it to update Notion.

| Notion DB | Purpose | Postgres backup | Cron job |
|---|---|---|---|
| Newly Discovered News DB | Content review workspace — KT scores and tags articles | `notion_news_backup` | `notion-backup.ts` |
| Data Sources DB | Registry of websites/people the pipeline monitors | `data_sources` | `notion-backup.ts` |
| Reviewers DB | Knowledge Team member registry with topic tags | `reviewers` | `notion-backup.ts` |

#### Newly Discovered News DB

Articles arrive here from the news ingestion pipeline. Knowledge Team members score and tag each page. Approved items are published to GitHub on the weekly cron.

| Property | Notion Type | Values / Notes |
|---|---|---|
| Title | title | Article title |
| Summary | rich_text | 1–3 sentence summary written by KT |
| Score | number | 1–5 relevance rating |
| Category | select | e.g. RAG, Agents, Fine-tuning |
| Source | rich_text | Publication name |
| Source URL | url | Canonical article URL |
| Tags | multi_select | Topic tags |
| Review Status | select | Pending \| Approved \| Rejected \| Published |
| Reviewer | person | Assigned Knowledge Team member |
| Published Date | date | Date published to the webapp |

Written by: news ingestion cron deposits new articles as Notion pages.
Read by: `notion-backup.ts` → upserts to `notion_news_backup`; weekly-publish cron reads `review_status = 'Approved'`.

#### Data Sources DB

Canonical registry of all sources the pipeline monitors. `follow = 'Following'` AND `site_status = 'Alive'` is the active crawl list that the news ingestion cron uses.

| Property | Notion Type | Values / Notes |
|---|---|---|
| Website Name | title | Display name |
| URL | url | Canonical source URL |
| Follow | select | Not Yet \| Following \| Stopped |
| Site Status | select | Alive \| Dead |
| Content Type | select | Blog / Newsletter / Podcast / Twitter |
| Cherry Category | multi_select | Topic classification — matches `reviewers.tags` |
| Quality Score | number | 0.0–1.0 editorial rating |
| RSS Feed | url | RSS/Atom feed URL if available |
| Assignee | person | 담당자 — responsible KT member |
| Update Frequency | number | Average posts per week |
| Credibility Check | select | Editorial credibility assessment |

Read by: `notion-backup.ts` → upserts to `data_sources`; news ingestion cron reads `data_sources` to build its crawl list.

#### Reviewers DB

Knowledge Team member registry. `reviewers.tags` is matched against `data_sources.cherry_category` to auto-assign incoming articles to the right reviewer.

| Property | Notion Type | Values / Notes |
|---|---|---|
| Reviewer Name | title | Display name |
| Notion User ID | person | Internal Notion user ID (UPSERT key in Postgres) |
| Tags | multi_select | Topic expertise — values match `cherry_category` options |
| Comment | rich_text | Free-form notes |

Read by: `notion-backup.ts` → upserts to `reviewers`.

---

### Concept Layer (GraphDB — RDF)

**Namespaces:**
```sparql
PREFIX llm:  <http://example.org/llm-ontology#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
```

**Concept Nodes (`owl:Class`):**
```
llm:{concept_id}       URI — concept_id is a slug (e.g. llm:RetrievalAugmentedGeneration)
rdfs:label             Human-readable name — KEY LINKAGE to idea_groups.canonical_idea_text in Postgres
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
```

**Planned Relationship Types (not yet implemented):**
```
llm:prerequisite        Directional: understanding A requires B first
llm:extends             A is an advanced variant or optimization of B
llm:contradicts         A and B are in tension or conflict
```

**Postgres linkage:**
- `rdfs:label` on a concept node = `idea_groups.canonical_idea_text` = `evidence_paragraphs.extracted_concept`
- Evidence count is derived from Postgres: `SELECT COUNT(*) FROM key_ideas WHERE idea_group_id = ?` — not stored in GraphDB
- Writer Agent query: GraphDB (`rdfs:label` → concept + relations) → Postgres (`WHERE extracted_concept = ?` → evidence paragraphs)

---

## API Contracts

### Internal Python Interfaces

```python
class GraphDBClient:
    def load_concept(self, concept_name: str) -> Concept | None
    def find_similar_concepts(self, name: str, threshold: float = 0.90) -> list[Concept]
    def create_concept(self, concept: Concept) -> str
    def add_relation(self, from_id: str, to_id: str, relation_type: str, props: dict) -> None
    def get_relations(self, concept_id: str) -> dict[str, list[RelatedConcept]]

class VectorDB:
    def store_embedding(self, paragraph_id: int, embedding: list[float], metadata: dict) -> None
    def search_similar(self, query_embedding: list[float], top_k: int = 10,
                       handbook_topic: str | None = None) -> list[SearchResult]
    def batch_store(self, records: list[dict]) -> None
```

### TypeScript Pipeline Interfaces

```typescript
// packages/pipeline/src/integrations/notion-client.ts
interface NotionClient {
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<string>;
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<void>;
  queryDatabase(
    databaseId: string,
    filter: Record<string, unknown>,
    cursor?: string
  ): Promise<{ pages: NotionPage[]; nextCursor: string | null }>;
}

// packages/pipeline/src/publication/github-committer.ts
interface GitHubCommitter {
  commitFiles(files: { path: string; content: string }[], message: string): Promise<string>; // returns SHA
}
```

### Writer Agent Query Result (Python)

```python
@dataclass
class ConceptQueryResult:
    concept: Concept
    prerequisites: list[RelatedConcept]
    related: list[RelatedConcept]
    subtopics: list[RelatedConcept]
    extends: list[RelatedConcept]
    contradicts: list[RelatedConcept]
    evidence: list[EvidenceParagraph]  # ordered by importance_score DESC
```

### Cron Job Exit Contracts

Each job in `packages/pipeline/src/jobs/` logs a summary on completion:

```typescript
// Standard job result logged to pipeline_runs table
interface JobResult {
  jobName: string;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  errors: number;
  durationMs: number;
}
```

---

## Security Architecture

- **All credentials:** Environment variables only. Never hardcoded. Never committed. `.env.example` shows required keys with placeholder values.
- **Database:** RDS in private VPC subnet; connections use `sslmode=require`
- **GraphDB:** Self-hosted; restrict network access to application server IPs only
- **GitHub PAT (handbook-bot):** Scoped to `repo:write` only; rotate quarterly; store in GitHub Secrets
- **Notion API token:** Scoped to specific database IDs only
- **No user authentication in current epics** — pipeline system only. User auth is Phase 2.

**Required environment variables (`.env.example`):**
```bash
# Database
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/handbook?sslmode=require
GRAPH_DB_URL=http://localhost:7200

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Integrations
NOTION_API_TOKEN=secret_...
NOTION_DATABASE_ID=...
GITHUB_PAT=ghp_...
GITHUB_REPO=org/cherry-in-the-haystack

# MCP Server
MCP_SERVER_URL=http://localhost:8080

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=team@example.com

# AWS (backups)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BACKUP_BUCKET=cherry-handbook-backups
```

---

## Performance Considerations

| Concern | Target | Approach |
|---|---|---|
| Webapp page load | < 2 seconds | Next.js SSR/SSG via CDN (AWS CloudFront / Cloudflare) |
| GraphDB concept query | < 500ms | Index concept_name; cache frequent queries in-process |
| pgvector search (top-10) | < 100ms | IVFFlat index (lists=100 for ~100K vectors); denormalized text |
| Notion API | Max 3 req/sec | Rate limiter in `notion-client.ts`; exponential backoff on 429 |
| LLM embedding cost | Minimize | Batch 2048 texts/request; cache embeddings |
| LLM synthesis cost | Minimize | Deduplication runs before concept extraction; cost tracked per paragraph |
| CI/CD build time | < 10 minutes | Cache pip/pnpm deps in Actions; parallel CI tasks |
| Postgres connections (Python) | Max 20 | psycopg3 connection pool; context manager for release |
| Index maintenance | Sustained performance | Rebuild IVFFlat when row count doubles |

---

## Deployment Architecture

### Content Publication Pipeline

```
Cron job: weekly-publish.ts (Sunday 00:00 UTC)
  → Notion (fetch approved items)
  → format-dispatcher.ts (markdown generation)
```

### Pipeline Scheduling (Cron)

```
# Example crontab entries
0 0 * * *   cd /app && npx tsx packages/pipeline/src/jobs/notion-backup.ts
0 0 * * 0   cd /app && npx tsx packages/pipeline/src/jobs/weekly-publish.ts
0 */6 * * * cd /app && npx tsx packages/pipeline/src/jobs/news-ingestion.ts
0 10 2 * *  cd /app && python handbook/pipeline/writer_agent/run.py
```

All jobs write results to `pipeline_runs` table. Failures send Slack + email alerts.

### Local Development

```bash
docker-compose up -d   # PostgreSQL 16 + pgvector + GraphDB
```

`docker-compose.yml` services:
- `postgres`: PostgreSQL 16 with pgvector, port 5432
- `graphdb`: GraphDB, port 7200 (UI at http://localhost:7200)

### Backup Strategy

| Layer | Method | Frequency | Retention |
|---|---|---|---|
| Evidence Layer (RDS) | Automated RDS snapshots | Daily | 30 days |
| Evidence Layer (RDS) | Point-in-time recovery | Continuous | 7-day window |
| Concept Layer (GraphDB) | JSON/RDF export → S3 | Weekly | 60 days |
| Vector DB (pgvector) | Included in RDS backups | Daily | With RDS |

---

## Development Environment

### Prerequisites

- Docker Desktop
- Python 3.10+
- Poetry 1.8+
- Node.js 20+
- pnpm

### Setup Commands

```bash
# Install dependencies
pnpm install          # TypeScript workspace (apps/web + packages/pipeline)
poetry install        # Python AI modules

# Start databases
docker-compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run Python database setup
python scripts/setup_local.sh

# Verify Python pipeline
ruff check handbook/
mypy handbook/
pytest handbook/ --cov

# Verify TypeScript pipeline
cd packages/pipeline && pnpm tsc --noEmit

# Run a cron job manually
npx tsx packages/pipeline/src/jobs/notion-backup.ts

# Preview webapp
cd apps/web && pnpm dev
```

---

## Architecture Decision Records (ADRs)

### ADR-001: GraphDB over Neo4j for Concept Layer
- **Decision:** GraphDB (RDF/SPARQL, self-hosted, open-source)
- **Rationale:** Free with no production licensing cost; existing `dev/packages/ontology/` work already uses GraphDB
- **Alternative:** Neo4j — more familiar Cypher, larger community, but paid for production scale
- **Re-evaluate if:** GraphDB causes significant friction for team queries

### ADR-002: Notion as Source of Truth (not backend database)
- **Decision:** Notion is source of truth for Newly Discovered; Postgres is one-way backup
- **Rationale:** Knowledge Team works in Notion daily. No custom review UI needed. Mitigated by daily backup.
- **Constraint:** System must never require Postgres for Notion data integrity

### ADR-003: pgvector over standalone vector database
- **Decision:** pgvector PostgreSQL extension
- **Rationale:** No additional infrastructure; pgvector handles ~100K vectors efficiently
- **Re-evaluate at:** 1M+ vectors

### ADR-004: Next.js Webapp (content layer)
- **Decision:** Content is served through the Next.js web application (deployed to AWS / Oracle)
- **Rationale:** Full-stack TypeScript; content served from database via API routes; unified deployment with the rest of the application; enables dynamic features and search

### ADR-005: Cron over Airflow for pipeline scheduling
- **Decision:** System cron / node-cron for job scheduling
- **Rationale:** Airflow is heavyweight infrastructure requiring its own server, database, and web UI. For the pipeline job count in this project (4–6 jobs), cron is sufficient, simpler to operate, and has no dependency on an external orchestration service.
- **Trade-off:** No built-in retry UI, task graph visualization, or dependency tracking. Mitigated by writing results to `pipeline_runs` table and sending alerts on failure.
- **Re-evaluate if:** Pipeline grows beyond ~15 jobs or complex cross-job dependencies emerge

### ADR-006: TypeScript for web app and pipeline orchestration; Python for AI/LLM modules
- **Decision:** TypeScript (Next.js) for web backend and cron job scripts; Python for LLM calls, PDF parsing, GraphDB queries
- **Rationale:** TypeScript gives type safety and a unified language across frontend and pipeline orchestration. Python is unavoidable for AI/LLM work where the SDK ecosystem (anthropic, openai, psycopg3, pdfplumber) is mature and first-class.
- **Boundary:** TypeScript handles HTTP, Notion/GitHub API calls, and job orchestration. Python handles anything touching an LLM, a vector operation, or a PDF.

### ADR-007: Loose Coupling via `extracted_concept` String Field
- **Decision:** Evidence Layer links to Concept Layer via the `extracted_concept` string field, not a foreign key
- **Rationale:** GraphDB and PostgreSQL cannot share a foreign key. Loose coupling via concept name enables independent scaling.
- **Constraint:** `extracted_concept` MUST exactly match `concept_name` in GraphDB. `concept_matcher.py` is responsible for normalization.

### ADR-008: Brownfield — `dev/` packages as reference implementations
- **Decision:** `dev/packages/ontology/` and `dev/packages/pdf_knowledge_extractor/` are read as reference; logic is adapted into the new `handbook/` and `packages/pipeline/` structure
- **Rationale:** Existing code represents validated prototypes. Rewriting from scratch wastes effort.
- **`dev/apps/api/`:** Contains the legacy pipeline. Do not reuse directly — rebuild as `packages/pipeline/` in TypeScript.

---

_Generated by BMAD Decision Architecture Workflow v1.3.2_
_Date: 2026-02-28_
_For: HK_

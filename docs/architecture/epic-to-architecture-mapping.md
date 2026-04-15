# Epic to Architecture Mapping

| Epic | Goal | Primary Components (TS Web + Python AI) |
|------|------|-----------------------------------|
| **Epic 1: Discover Curated Content (Universal)** | Build content pipeline for weekly digest — one version for all users | `python_services/packages/news_collector/` (feedparser, newspaper3k), `python_services/packages/agent/news_agent/` (Celery tasks), NestJS API for content delivery, Notion integration, Postgres storage |
| **Epic 2: Learn Structured Concepts (Universal)** | Build knowledge graph + Writer Agent for comprehensive concept pages | `python_services/packages/idea_to_graph_ontology/` (GraphDB), `python_services/packages/agent/writer_agent/` (Writer Agent), `python_services/packages/text_extract_ideas/` (PDF ingestion), Evidence Layer (Postgres), NestJS API for serving pages |
| **Epic 3: Web Platform + Contributor Tools** | Connect frontend to backend, add URL/markdown submission tools | `apps/web/` (Next.js frontend), `apps/api/` (NestJS backend), URL submission form, markdown submission interface, contributor workflows |
| **Epic 4: Generate Newsletters** | Enterprise Newsletter Studio for email generation | `apps/api/` (NestJS Newsletter Studio), FastAPI AI service for draft generation, email distribution integration, version history management |
| **Epic 5: Personalize Your Feed** | User accounts, tiers, personalization, custom sources | `apps/api/` (NestJS user auth, tier management), FastAPI for AI scoring (personalized), `python_services/packages/news_collector/` (custom source ingestion), PostgreSQL user data, Celery tasks for personalized feeds |
| **Epic 6: Build Your Knowledge Base** | Custom concept pages with custom evidence for paid users | `apps/api/` (NestJS custom topics UI), FastAPI for Writer Agent calls, `python_services/packages/agent/writer_agent/` (custom topic generation), PostgreSQL user-specific evidence, GraphDB integration |
| **Epic 7: Access in Your Language** | Internationalization infrastructure for multi-language UI | `apps/web/` (Next.js i18n), JSON translation files, locale-aware formatting (dates, numbers), language selector UI |

---

## Component Ownership by Language

| Component | Language | Location | Purpose |
|-----------|----------|----------|---------|
| **Next.js Frontend** | TypeScript | `apps/web/` | User-facing UI, SEO pages, routing |
| **NestJS Backend** | TypeScript | `apps/api/` | Main web API, user auth, tier management, content delivery |
| **FastAPI Service** | Python | `python_services/api.py` | AI/LLM operations only (scoring, extraction, synthesis) |
| **Celery Workers** | Python | `python_services/packages/agent/news_agent/`, etc. | Background task processing, scheduled jobs |
| **News Ingestion** | Python | `python_services/packages/news_collector/` | RSS, Twitter, YouTube, arxiv crawling |
| **Evidence Processing** | Python | `python_services/packages/text_extract_ideas/` | PDF parsing, text chunking |
| **Concept Extraction** | Python | `python_services/packages/idea_to_graph_ontology/` | GraphDB integration, ontology management |
| **Writer Agent** | Python | `python_services/packages/agent/writer_agent/` | Page generation, LLM synthesis |
| **Tests** | Python | Within each package (e.g., `packages/agent/writer_agent/test_*.py`) | Package-level testing |

---

## Service Communication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend (TS)                       │
│                        (Port 3000 / Public)                         │
│  - User-facing UI                                                   │
│  - SEO pages                                                        │
│  - Client-side routing                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NestJS Backend (TS)                            │
│                        (Port 4000 / Internal)                       │
│  - /api/news/*           — News endpoints                                 │
│  - /api/concepts/*       — Concept pages                               │
│  - /api/auth/*           — Authentication (JWT, OAuth)                │
│  - /api/users/*          — User management, tiers, profiles        │
│  - /api/newsletter/*     — Enterprise Newsletter Studio             │
│  - /api/sources/*         — Source management, submission             │
│  - Calls FastAPI when AI operations needed                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (AI/LLM only)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Service (Python)                       │
│                        (Port 8000 / Internal)                       │
│  - /ai/scoring           — AI article scoring (z.ai)               │
│  - /ai/extract           — Concept extraction from documents        │
│  - /ai/synthesize         — Writer Agent page generation          │
│  - /celery/*              — Celery task management              │
└───────────┬────────────────────────────────┬─────────────────┘
            │                                        │
            │ Celery protocol                        │
            ▼                                        ▼
┌──────────────────────┐              ┌────────────────────────────────┐
│   Redis + Celery     │              │      Databases (Tailscale)     │
│                      │              │                                 │
│  - Task queue        │              │  - PostgreSQL 16 + pgvector    │
│  - Result backend    │              │  - GraphDB (RDF)               │
│  - Scheduling        │              │  - Managed by docker-compose   │
└──────────────────────┘              └────────────────────────────────┘
            │
            │ Tasks execute here
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Celery Workers (Python)                          │
│  - news_ingestion_worker    — RSS, Twitter, YouTube, arxiv          │
│  - ai_scoring_worker        — LLM scoring via z.ai                   │
│  - concept_extraction_worker — GraphDB concept linking              │
│  - writer_agent_worker      — Handbook page synthesis               │
│  - stats_snapshot_worker    — Nightly statistics aggregation        │
│  - newsletter_worker        — Enterprise email generation            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Epic-Specific Architecture Details

### Epic 1: Discover Curated Content (Universal)

**FRs covered:** FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3, FR-5.1, FR-7.1, FR-9.1

**Data Flow:**
```
Sources (RSS/Twitter/YouTube/arxiv)
    ↓
python_services/packages/news_collector/ (Python)
    ↓
Deduplication (pgvector)
    ↓
AI Scoring (z.ai via FastAPI)
    ↓
Notion Review Workspace (Knowledge Team)
    ↓
PostgreSQL Storage
    ↓
NestJS API → Next.js Display
```

**Key Tables:**
- `source` — Source registry with health monitoring
- `article_raw` — Immutable raw article store
- `user_article_state` — Per-user article view (universal = single view)
- `user_article_ai_state` — AI scoring results
- `curated_articles` — KT-approved articles for publication

**Stories:**
- Story 1.1: Status Check — Audit existing code, database schema, infrastructure
- Story 1.2: Daily Publication Pipeline — Auto-sync Notion → Postgres → GitHub
- Story 1.3: Discover & Configure Additional Source — Add new sources with validation

---

### Epic 2: Learn Structured Concepts (Universal)

**FRs covered:** FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-7.2, FR-8.1

**Data Flow:**
```
Curated Sources (Books, Papers, Docs)
    ↓
python_services/packages/text_extract_ideas/ (Python)
    ↓
Evidence Layer (PostgreSQL paragraph_chunks)
    ↓
python_services/packages/idea_to_graph_ontology/ (Python)
    ↓
GraphDB (RDF) — Concept Layer
    ↓
python_services/packages/agent/writer_agent/ (Python)
    ↓
PostgreSQL concept_pages
    ↓
NestJS API → Next.js Display
```

**Key Tables:**
- `books` — Source document registry
- `paragraph_chunks` — Evidence storage
- `paragraph_concept_links` — Evidence-to-concept mapping
- `idea_groups` — Canonical concept names
- `GraphDB` — Concept ontology (stable)
- `concept_pages` — Generated markdown pages
- `concept_page_changelog` — Change tracking

**Stories:**
- Story 2.1: Status Check — Audit GraphDB, evidence layer, infrastructure
- Story 2.2: Pipeline Integration — Unified pipeline from evidence to published pages
- Story 2.3: Content Discovery & Ontology Creation — Initial seeding with quality sources

---

### Epic 3: Web Platform + Contributor Tools

**FRs covered:** FR-5.2, FR-6.1, FR-8.1 (contributor workflows)
**UX-DRs:** All 8 custom components + 50+ shadcn/ui components

**Components:**
- **Next.js Frontend** (`apps/web/`)
  - Public content pages
  - Navigation (Basics, Advanced, Newly Discovered)
  - URL submission form
  - Markdown submission interface

- **NestJS Backend** (`apps/api/`)
  - Content delivery endpoints
  - Source submission API
  - Markdown submission API
  - Authentication (for Epic 5+)

**Integration Points:**
- NestJS reads from PostgreSQL for content
- NestJS calls FastAPI for any AI operations
- Contributor forms write to appropriate tables

**Stories:**
- Story 3.1: Backend Integration — Connect Next.js to Postgres content
- Story 3.2: URL Submission Form — Web form for source submissions
- Story 3.3: Markdown Submission Page — Submit docs for evidence ingestion

---

### Epic 4: Generate Newsletters

**FRs covered:** FR-14.1, FR-14.2, FR-14.3, FR-14.4, FR-14.5, FR-14.6

**Components:**
- **NestJS Newsletter Studio** (`apps/api/modules/newsletter/`)
  - Prompt configuration UI
  - Content selection interface
  - Draft generation (calls FastAPI for AI)
  - Version history
  - Email distribution

- **FastAPI AI Service**
  - Newsletter draft generation (z.ai)
  - Content synthesis

**Key Tables:**
- `prompt_template` — Newsletter configuration
- `prompt_template_version` — Version history
- `newsletter_issue` — Newsletter drafts
- `newsletter_issue_item_snapshot` — Content snapshots
- `newsletter_send_log` — Delivery tracking
- `recipient` — Subscriber management

**Stories:**
- Story 4.1: Newsletter Agent Configuration — Configure tone, structure, audience
- Story 4.2: Content Selection Interface — Select evidence and sources
- Story 4.3: Newsletter Draft Generation — One-click generation
- Story 4.4: Email Distribution — Send to email lists

---

### Epic 5: Personalize Your Feed

**FRs covered:** FR-10.1, FR-10.2, FR-11.1, FR-11.2, FR-11.3, FR-11.4

**Components:**
- **NestJS User Service** (`apps/api/modules/users/`)
  - User registration/login (JWT, OAuth)
  - Tier management (Free, Paid, Enterprise)
  - Profile management

- **FastAPI Personalization**
  - Natural language scoring criteria parsing (z.ai)
  - Personalized feed generation

- **Python Services**
  - Custom source ingestion (extends news_collector)
  - AI scoring with user weights

**Key Tables:**
- `user` — User accounts
- `user_source_follow_cfg` — Per-user source subscriptions
- `user_entity_follow` — Entity-level follows
- `user_category_follow_cfg` — Category filters
- `user_scoring_preference` — Natural language criteria
- `user_newly_discovered_page` — Personalized feed snapshots

**Stories:**
- Story 5.1: User Registration & Login — Secure auth with JWT/OAuth
- Story 5.2: User Tier Management — Free/Paid/Enterprise tiers
- Story 5.3: Custom Source Management — Add private sources
- Story 5.4: Natural Language Scoring Criteria — AI-parsed preferences
- Story 5.5: Content Filtering & Feed Personalization — Entity/category filters
- Story 5.6: Adaptive Content Scoring — Apply custom scoring to feeds

---

### Epic 6: Build Your Knowledge Base

**FRs covered:** FR-10.3, FR-12.1, FR-12.2, FR-12.3

**Components:**
- **NestJS Custom Topics UI** (`apps/api/modules/topics/`)
  - Topic creation interface
  - Evidence upload/management
  - Knowledge base management

- **FastAPI Writer Agent**
  - Custom topic page generation
  - Evidence synthesis from user-provided sources

**Key Tables:**
- `user_concept_evidence_selection` — User's custom evidence sets
- `user_concept_evidence_item` — Evidence items
- `user_concept_page` — Generated custom pages

**Stories:**
- Story 6.1: User Profile Management — Account settings, data export
- Story 6.2: User-Controlled Topic Addition — Add custom topics
- Story 6.3: Writer Agent Regeneration — Generate custom pages
- Story 6.4: User Knowledge Base Management — Manage custom topics

---

### Epic 7: Access in Your Language

**FRs covered:** FR-13.1, FR-13.2, FR-13.3

**Components:**
- **Next.js i18n** (`apps/web/`)
  - i18next or react-intl integration
  - JSON translation files
  - Language selector UI
  - Locale-aware formatting

**Key Files:**
- `apps/web/locales/en.json` — English translations
- `apps/web/locales/ko.json` — Korean translations
- Future: Add more language files

**Stories:**
- Story 7.1: Internationalization Infrastructure — Setup i18n foundation
- Story 7.2: Multi-Language UI — Translate all UI elements
- Story 7.3: Content Language Handling — Language indicators on content

---

## Task Scheduling (Celery + Redis)

| Task Name | Epic | Package | Schedule | Purpose |
|-----------|------|---------|----------|---------|
| `news_ingestion` | Epic 1 | `news_collector` | Every 6 hours | Fetch from RSS, Twitter, YouTube, arxiv |
| `ai_scoring` | Epic 1, 5 | `news_collector` | On ingestion | Score articles with z.ai |
| `notion_backup` | Epic 1 | Custom | Daily 00:00 UTC | Backup Notion to Postgres |
| `weekly_publish` | Epic 1 | Custom | Sunday 00:00 UTC | Publish approved content |
| `ontology_extraction` | Epic 2 | `idea_to_graph_ontology` | Monthly (2nd Saturday) | Extract new concepts |
| `concept_review` | Epic 2 | Knowledge Team | Monthly (2nd Saturday) | Review and approve concepts |
| `writer_agent` | Epic 2, 6 | `writer_agent` | Monthly | Generate concept pages |
| `stats_snapshot` | All | Custom | Daily 02:00 UTC | Aggregate statistics |

---

## Package Dependencies

### Core Python Dependencies
```
python_services/requirements.txt:
- fastapi>=0.104.0       # Web framework (AI service)
- uvicorn[standard]      # ASGI server
- celery>=5.0.0          # Task queue
- redis>=5.0.0           # Cache and broker
- sqlalchemy>=2.0        # ORM
- psycopg[binary]>=3.0   # Postgres driver
- pydantic>=2.0.0        # Validation
- loguru>=0.7.0          # Logging
- python-dotenv          # Environment variables
- zai                    # LLM SDK
```

### TypeScript Dependencies
```
apps/web/package.json (Next.js):
- next
- react
- @tanstack/react-query   # Data fetching
- shadcn/ui                # UI components
- tailwindcss              # Styling

apps/api/package.json (NestJS):
- @nestjs/core
- @nestjs/common
- @nestjs/config
- @nestjs/jwt
- @nestjs/passport
- @prisma/client          # Database ORM
- class-validator          # Validation
```

---

## Deployment Units

| Unit | Technology | Deploy Target | Scale Independently? |
|------|------------|---------------|---------------------|
| Next.js Frontend | TypeScript (Vercel) | Vercel, Netlify | Yes (CDN) |
| NestJS Backend | TypeScript (NestJS) | Fly.io, Render, Railway | Yes |
| FastAPI Service | Python (FastAPI) | Fly.io, Render, Railway | Yes |
| Celery Workers | Python (Celery) | Same as API or separate | Yes |
| PostgreSQL | Database | Supabase, RDS, Neon | Yes |
| GraphDB | Database | Self-hosted VPS | Yes |
| Redis | Cache/Queue | Upstash, Redis Cloud | Yes |

---

_Last updated: 2026-04-07_

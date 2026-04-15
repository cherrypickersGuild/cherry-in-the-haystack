# Architecture Decision Records (ADRs)

---

### ADR-001: GraphDB over Neo4j for Concept Layer

- **Decision:** GraphDB (RDF/SPARQL, self-hosted, open-source)
- **Rationale:** Free with no production licensing cost; existing `dev/packages/ontology/` work already uses GraphDB
- **Alternative:** Neo4j — more familiar Cypher, larger community, but paid for production scale
- **Re-evaluate if:** GraphDB causes significant friction for team queries

---

### ADR-002: Notion as Source of Truth (not backend database)

- **Decision:** Notion is source of truth for Newly Discovered; Postgres is one-way backup
- **Rationale:** Knowledge Team works in Notion daily. No custom review UI needed. Mitigated by daily backup.
- **Constraint:** System must never require Postgres for Notion data integrity

---

### ADR-003: pgvector over standalone vector database

- **Decision:** pgvector PostgreSQL extension
- **Rationale:** No additional infrastructure; pgvector handles ~100K vectors efficiently
- **Re-evaluate at:** 1M+ vectors

---

### ADR-004: Next.js Webapp (content layer)

- **Decision:** Frontend UI is Next.js/React (TypeScript), served from Vercel or equivalent
- **Rationale:** SEO-critical pages, React ecosystem, server components, automatic static generation
- **Backend:** All API routes served by FastAPI (Python) — Next.js is a thin client layer
- **Re-evaluate if:** Team has strong React preference for SSR; otherwise consider Python web frameworks

---

### ADR-005: Celery + Redis over Airflow for pipeline scheduling

- **Decision:** Celery task queue with Redis broker and beat scheduler
- **Rationale:**
  - Python-native (matches our AI/LLM stack)
  - Mature, proven at scale
  - Built-in retries, scheduling, monitoring (Flower)
  - No separate orchestration server like Airflow
- **Trade-off:** No built-in DAG visualization (mitigated by Flower for task monitoring)
- **Re-evaluate if:** Pipeline grows beyond ~50 jobs or complex cross-job dependencies emerge
- **Old approach:** System cron / node-cron (deprecated 2026-04-07)

---

### ADR-006: TypeScript Web Application with Python AI Service (Updated 2026-04-07)

- **Decision:** TypeScript for web application (Next.js + NestJS); Python reserved for AI/LLM and data processing via FastAPI
- **Rationale:**
  - Web ecosystem is TypeScript-first (React, Next.js, NestJS)
  - AI/LLM ecosystem is Python-first (z.ai, langchain)
  - Scientific libraries (numpy, scikit-learn, sentence-transformers) are Python-only
  - Clear separation: NestJS handles web backend, calls FastAPI only for AI operations
- **Split:**
  - **TypeScript (~60% LOC):** Next.js frontend, NestJS backend, API routes, database access (Prisma)
  - **Python (~40% LOC):** FastAPI (AI service), Celery tasks, AI/LLM, GraphDB operations
- **Boundary:** NestJS exposes main REST API to Next.js. NestJS calls FastAPI for AI/LLM operations (scoring, extraction, synthesis). Celery workers handle async tasks.
- **Re-evaluate if:** Team needs more Python in web layer or AI operations become minimal

---

### ADR-007: Loose Coupling via `extracted_concept` String Field

- **Decision:** Evidence Layer links to Concept Layer via the `extracted_concept` string field, not a foreign key
- **Rationale:** GraphDB and PostgreSQL cannot share a foreign key. Loose coupling via concept name enables independent scaling.
- **Constraint:** `extracted_concept` MUST exactly match `concept_name` in GraphDB. `concept_matcher.py` is responsible for normalization.

---

### ADR-008: Tailscale for Infrastructure Access

- **Decision:** Tailscale for all secure infrastructure access (databases, services, internal tools)
- **Rationale:** Zero-configuration secure networking; no VPN management overhead; works across cloud providers and local dev; built-in ACLs for access control
- **Trade-off:** Requires Tailscale agent on all hosts; mitigated by easy install and cross-platform support
- **Re-evaluate if:** Need features beyond Tailscale's capabilities (e.g., advanced BGP, custom routing policies)

---

### ADR-009: Brownfield — Existing Python Packages as Reference (Updated 2026-04-07)

- **Decision:** Existing `python_services/packages/` are read as reference; logic is adapted into the new architecture
- **Rationale:** Existing code represents validated prototypes. Rewriting from scratch wastes effort.
- **Existing packages:**
  - `news_collector` — News ingestion pipeline (feedparser, newspaper3k, Twitter, YouTube)
  - `idea_to_graph_ontology` — GraphDB/RDF management with langchain, rdflib
  - `text_extract_ideas` — PDF processing pipeline
  - `agent/news_agent` — News processing agents
  - `agent/writer_agent` — Writer agent with tests

---

### ADR-010: Codebase Structure — Monorepo with TypeScript Web App and Python AI Service (Updated 2026-04-07)

- **Decision:** `apps/web` (Next.js), `apps/api` (NestJS) for web application; `python_services/` (FastAPI) for AI service
- **Rationale:** TypeScript and Python have separate runtime ecosystems. Clear service boundaries enable independent deployment and scaling.
- **Boundaries:**
  - `apps/api` (NestJS, port 4000) — main web backend, handles most API routes
  - `apps/web` (Next.js, port 3000) — frontend UI
  - `python_services/api.py` (FastAPI, port 8000) — AI/LLM service only
  - `python_services/packages/` — Python packages (news_collector, agent, idea_to_graph_ontology, text_extract_ideas)
- **Communication:**
  - Next.js → NestJS: REST API
  - NestJS → FastAPI: HTTP for AI operations only
  - Celery: Python-only, managed by FastAPI
- **Re-evaluate if:** AI operations become minimal or team consolidates to single language

---

### ADR-011: Use Battle-Tested OSS Packages (New 2026-04-07)

- **Decision:** Leverage existing open-source packages instead of building from scratch wherever possible
- **Rationale:**
  - Faster development — use proven solutions
  - Better security — community-vetted code
  - Lower maintenance — bugs fixed upstream
- **Key packages used:**
  - RSS parsing: `feedparser`
  - Article extraction: `newspaper3k`
  - PDF parsing: `PyMuPDF`, `unstructured`
  - Task queue: `Celery` + `Redis`
  - LLM: `z.ai`
  - ORM: `SQLAlchemy`
  - Embeddings: `sentence-transformers`
- **Cherry-specific code only for:**
  - Domain-specific news scoring
  - Custom ontology concept extraction
  - Writer Agent synthesis logic
  - Personalization engine
- **Re-evaluate if:** A package becomes unmaintained or doesn't fit requirements

---

### ADR-012: FastAPI over Flask/Django for REST API (New 2026-04-07)

- **Decision:** FastAPI as the unified Python backend framework
- **Rationale:**
  - Native async/await support (critical for I/O-bound LLM calls)
  - Automatic OpenAPI docs
  - Pydantic validation integrated
  - TypeScript-friendly (auto-generated types possible)
- **Alternatives considered:**
  - Flask — synchronous by default, less modern
  - Django — heavy, opinionated, overkill for API-only service
- **Re-evaluate if:** Team needs Django's admin interface or ORM features

---

### ADR-013: SQLAlchemy ORM over Raw SQL (New 2026-04-07)

- **Decision:** Use SQLAlchemy 2.0+ with async support for database operations
- **Rationale:**
  - Type-safe queries (mypy + SQLAlchemy stubs)
  - Automatic connection pooling
  - Migration support via Alembic
  - Can drop to raw SQL for complex queries
- **Trade-off:** ORM overhead for simple queries (mitigated by Core or raw SQL when needed)
- **Re-evaluate if:** ORM complexity exceeds benefit for a specific query pattern

---

### ADR-014: z.ai as LLM Provider (New 2026-04-07)

- **Decision:** Use `z.ai` as the single LLM provider for all operations
- **Rationale:**
  - Single provider simplifies integration and cost tracking
  - No fallback complexity
  - Direct API calls via official SDK
- **Trade-off:** Vendor lock-in (mitigated by z.ai capabilities)
- **Re-evaluate if:** z.ai service becomes unreliable or doesn't meet requirements

---

_Historical records retained for context. Decisions marked "Updated 2026-04-07" reflect the Python-first architecture shift._

_Last updated: 2026-04-07_

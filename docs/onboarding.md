# Developer Onboarding

Welcome to **cherry-in-the-haystack** (Cherry for AI Engineers).

This guide gets you from zero to your first contribution. Read it in order — each section builds on the previous one.

---

## What We're Building

Cherry is a living, community-curated knowledge base for AI/LLM engineers. The system has three moving parts:

1. **Newly Discovered pipeline** — Custom news ingestion pipeline scores content → Knowledge Team reviews in Notion → weekly publication to GitHub
2. **Basics/Advanced pipeline** — Source documents (PDFs, books) are chunked into paragraphs → concepts extracted → stored in a knowledge graph → Writer Agent synthesizes handbook pages
3. **Newsletter Studio** — Enterprise feature, planned for Phase 2, not in scope yet

**Language split:** TypeScript (Next.js) for the web application, API backend, and pipeline cron jobs. Python for AI/LLM-specific work (concept extraction, Writer Agent synthesis, PDF parsing). Pipeline scheduling uses cron — no Airflow.

The core architectural concept you need to internalize before touching any code:

> Evidence Layer (PostgreSQL) stores raw paragraphs from source documents. Concept Layer (GraphDB) stores normalized concept names and their relationships. They link via a single string field: `extracted_concept`. The Writer Agent does a two-step query — GraphDB first for concept + relations, then Postgres for evidence paragraphs — and Claude synthesizes a handbook page from the result.

Everything in this repo flows from that pattern.

---

## Before Day 1 — Access You Need

Ask HK to provide:

- [ ] GitHub repo access
- [ ] SSH key for `cherry@13.239.18.76` (remote PostgreSQL server — required to run anything)
- [ ] OpenAI API key (Writer Agent prototype uses `gpt-4.1-mini`)
- [ ] Anthropic API key (Claude — required from Epic 3 onward)
- [ ] Notion API token + database ID (required for Epic 2)
- [ ] Node.js 20+ and pnpm installed locally

GraphDB runs locally via Docker — no shared access needed.

---

## Day 1 — Orientation

### Morning: Read These in Order

1. **`docs/PRD.md`** — Read the Executive Summary and MVP sections. Skip Vision/Growth for now.
2. **`docs/architecture.md`** — Read Executive Summary, Novel Patterns, and Project Structure.
3. **`docs/epics.md`** — Read the Epic Summary table at the top, then the epic you'll be working on.

This takes about 2–3 hours. Don't rush it. The architecture doc is the single source of truth for every technical decision.

### Afternoon: Run the Writer Agent End-to-End

The fastest way to understand the system is to run it. The Writer Agent is a working prototype that does the full pipeline: GraphDB query → evidence query → page synthesis.

**Step 1: Start GraphDB locally**

```bash
cd dev/packages/ontology
uv sync
./setup_graphdb.sh
```

GraphDB UI is at `http://localhost:7200`. The repository is `llm-ontology`. Take a minute to browse the concept nodes — this is the Concept Layer.

**Step 2: Open SSH tunnel to remote PostgreSQL**

```bash
ssh -N -L 5433:localhost:5432 cherry@13.239.18.76
```

Leave this terminal open. The remote Postgres at `cherry@13.239.18.76` is the Evidence Layer with real data. Nothing works without this tunnel.

Verify the tunnel is up:

```bash
lsof -nP -iTCP:5433 -sTCP:LISTEN
```

**Step 3: Configure the Writer Agent**

```bash
cp dev/apps/agent/writer_agent/.env.example dev/apps/agent/writer_agent/.env
```

Fill in:

```
DATABASE_URL=postgresql://postgres:cherry251110!@localhost:5433/cherry_db
OPENAI_API_KEY=<your key>
```

**Step 4: Run it**

```bash
python dev/apps/agent/writer_agent/run_writer_agent.py "RAG evaluation"
```

You should get a Cherry page as output. Read `dev/apps/agent/writer_agent/README.md` for details on the three-agent setup (Writer, OntologyJudge, EvidenceSummarizer).

**Step 5: Inspect what's in the databases**

```bash
# See the GraphDB concept tree
python dev/apps/agent/writer_agent/print_graphdb_tree.py

# See what's in the Evidence DB
python dev/apps/agent/writer_agent/inspect_evidence_db.py
```

Goal for the day: see a page come out of the agent. Understand the pipeline by watching it run.

---

## Day 2 — Understand the Gap

There is a gap between what's built and what the architecture describes. You need to understand both.

### What Exists Today

| Location                                | What it does                                                | Status            |
| --------------------------------------- | ----------------------------------------------------------- | ----------------- |
| `dev/apps/agent/writer_agent/`          | Full Writer Agent (GraphDB + Evidence DB → Claude/GPT page) | Working prototype |
| `dev/packages/ontology/`                | GraphDB setup + concept management + vector store           | Working prototype |
| `dev/packages/pdf_knowledge_extractor/` | PDF → paragraph extraction pipeline                         | Working prototype |
| `dev/apps/api/`                         | Legacy pipeline code (reference only — not reused directly) | Reference         |

### What's Planned (your job to build)

| Location                  | What it does                                                        | Status             |
| ------------------------- | ------------------------------------------------------------------- | ------------------ |
| `apps/web/`               | Next.js web application + API backend (TypeScript)                  | Does not exist yet |
| `packages/pipeline/`      | TypeScript cron jobs: news ingestion, Notion backup, weekly publish | Does not exist yet |
| `handbook/db_connection/` | psycopg3 Evidence Layer, GraphDB, pgvector connections (Python)     | Does not exist yet |
| `handbook/pipeline/`      | Evidence ingestion, Writer Agent modules (Python)                   | Does not exist yet |
| `handbook-content/`       | Jupyter Book content (published to GitHub Pages)                    | Does not exist yet |

**Language boundary:** `packages/pipeline/` is TypeScript (cron jobs, Notion/GitHub API calls). `handbook/` is Python (LLM calls, PDF parsing, GraphDB queries). Don't mix them.

The `dev/` packages are **reference implementations**. Their logic gets adapted — not rewritten from scratch. When you start a story, find the relevant prototype in `dev/` first.

### Walk Through These Files in Order

1. `dev/packages/ontology/src/storage/graph_query_engine.py` — how GraphDB is queried today
2. `dev/packages/pdf_knowledge_extractor/src/workflow/workflow.py` — how PDF extraction works
3. `dev/apps/agent/writer_agent/run_writer_agent.py` — the full agent flow
4. `docs/architecture.md` → Project Structure section — where all of this needs to land

---

## Day 3 — First Contribution

### Pick Your Starting Point

Find your epic in `docs/epics.md` and pick the lowest-numbered incomplete story. Then follow this pattern:

1. Read the story's acceptance criteria carefully
2. Find the matching section in `docs/architecture.md` (use section names, not line numbers — line number references in epic stories are stale from the old architecture)
3. Check `dev/` for existing prototype code to adapt
4. Write the `handbook/` module
5. Run `ruff check`, `mypy`, `pytest` before opening a PR

### Recommended First Tasks by Epic

| Epic   | Good first task                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epic 1 | Write `scripts/setup_evidence_layer.sql` — the full Postgres schema from `docs/architecture.md` → Data Architecture section. Run it against local Docker Postgres.                                  |
| Epic 1 | Write `handbook/db_connection/postgres.py` — adapt connection logic from `dev/packages/pdf_knowledge_extractor/src/db/connection.py` to the psycopg3 + context manager pattern in the architecture. |
| Epic 2 | Write `packages/pipeline/src/integrations/notion-client.ts` — TypeScript wrapper for Notion API v2 with pagination and rate limit handling.                                                         |
| Epic 2 | Write `packages/pipeline/src/jobs/notion-backup.ts` — cron job that queries Notion and upserts into `notion_news_backup` table.                                                                     |
| Epic 3 | Adapt `dev/packages/pdf_knowledge_extractor/src/workflow/workflow.py` into `handbook/pipeline/evidence_ingestion/document_chunker.py`.                                                              |
| Epic 4 | Read `dev/apps/agent/writer_agent/run_writer_agent.py` in full, then write `handbook/pipeline/writer_agent/graph_query.py`.                                                                         |

---

## Quick Reference

### Key Files

```
What you need                            Where to find it
──────────────────────────────────────────────────────────────────
What we're building                      docs/PRD.md
All technical decisions                  docs/architecture.md
Stories and acceptance criteria          docs/epics.md
Working Writer Agent prototype           dev/apps/agent/writer_agent/
Working PDF extraction prototype         dev/packages/pdf_knowledge_extractor/
GraphDB setup                            dev/packages/ontology/setup_graphdb.sh
GraphDB connection code                  dev/packages/ontology/src/storage/
Legacy pipeline reference                dev/apps/api/  (reference only)
New TypeScript pipeline jobs go here     packages/pipeline/src/jobs/  (you build this)
New Python AI modules go here            handbook/pipeline/  (you build this)
Next.js web app goes here                apps/web/  (you build this)
```

### Three Commands to Know

```bash
# 1. Start GraphDB locally
cd dev/packages/ontology && ./setup_graphdb.sh

# 2. Open Evidence DB tunnel (leave open while working)
ssh -N -L 5433:localhost:5432 cherry@13.239.18.76

# 3. Run the Writer Agent
python dev/apps/agent/writer_agent/run_writer_agent.py "<topic>"
```

### Docker Container Lifecycle (GraphDB)

```bash
docker stop graphdb-ontology
docker start graphdb-ontology
docker rm -f graphdb-ontology   # only if resetting
```

### Required Environment Variables

```bash
# Evidence DB (via SSH tunnel)
DATABASE_URL=postgresql://postgres:cherry251110!@localhost:5433/cherry_db

# GraphDB (local Docker)
GRAPH_DB_URL=http://localhost:7200

# LLM APIs
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Notion (Epic 2+)
NOTION_API_TOKEN=...
NOTION_DATABASE_ID=...
```

---

## Things to Know Before You Start

**`uv` vs. Poetry vs. pnpm** — `dev/packages/ontology/` uses `uv`. New `handbook/` Python code uses Poetry. New TypeScript code (`apps/web/`, `packages/pipeline/`) uses pnpm. Three separate package managers in one repo — don't mix them.

**SSH tunnel is always required** — The remote Postgres at `cherry@13.239.18.76` is the only Evidence DB with real data. If your script can't find evidence, the tunnel is probably not open.

**No Airflow** — Pipeline jobs are cron scripts in `packages/pipeline/src/jobs/`. There is no DAG UI. Monitor job results via the `pipeline_runs` Postgres table.

**`handbook/` and `packages/pipeline/` are blank slates** — Don't look for existing code there. The `dev/` packages are the reference; these directories are what the epics are building.

**TypeScript for orchestration, Python for AI** — If your task involves calling an LLM, parsing a PDF, or querying GraphDB: Python in `handbook/`. If it involves calling Notion, GitHub, formatting markdown, or scheduling: TypeScript in `packages/pipeline/`.

**Ontology is manually maintained** — The GraphDB concept tree is reliable for the nodes that exist, but the auto-concept-matching pipeline is not yet built. Use a topic that already exists in the graph when testing: `python dev/apps/agent/writer_agent/print_graphdb_tree.py`.

**Architecture line number references in epic stories are stale** — Story technical notes reference the old `architecture.md` with specific line numbers. Those are wrong after the rewrite. Use section names instead (e.g., "Data Architecture → Evidence Paragraphs table").

**Notion is source of truth for Newly Discovered content** — Postgres `notion_news_backup` is a one-way backup only. Never write to Postgres and expect it to update Notion.

---

## Who to Ask

All questions → HK.

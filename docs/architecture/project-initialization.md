# Project Initialization

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
- `dev/apps/api/` → Adapt and extend directly (auto-news pipeline kept, not rebuilt)

**Starter-Provided Architectural Decisions:**

| Component         | Decision             | Version |
| ----------------- | -------------------- | ------- |
| Web Framework     | Nest.js (App Router) | latest  |
| Frontend Language | TypeScript           | 5.9+    |
| Pipeline Language | TypeScript           | 5.9+    |
| AI/LLM Language   | Python               | 3.10+   |
| Deployment Target | AWS / Oracle         | —       |

---

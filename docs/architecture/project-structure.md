# Project Structure

```
cherry-in-the-haystack/
│
├── apps/
│   ├── web/                            # Next.js application (TypeScript)
│   │   ├── app/                         # App Router
│   │   │   ├── (public)/                # Public routes — no auth required
│   │   │   │   ├── basics/[slug]/
│   │   │   │   ├── advanced/[slug]/
│   │   │   │   └── newly-discovered/
│   │   │   ├── (dashboard)/             # Authenticated routes (Phase 2)
│   │   │   └── api/                     # API routes (forward to FastAPI)
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   │
│   └── api/                            # NestJS application (TypeScript)
│       ├── src/
│       │   ├── modules/
│       │   └── main.ts
│       └── package.json
│
├── python_services/                    # Python packages and API
│   ├── api.py                           # FastAPI application entry point
│   │
│   ├── packages/
│   │   ├── agent/                       # Agent-based packages
│   │   │   ├── news_agent/              # News processing agents
│   │   │   └── writer_agent/            # Handbook page synthesis
│   │   │       ├── test_evidence_db_connection.py
│   │   │       └── test_graphdb_connection.py
│   │   │
│   │   ├── news_collector/              # News ingestion pipeline
│   │   │   ├── (RSS, Twitter, YouTube, arxiv crawlers)
│   │   │   └── pyproject.toml
│   │   │
│   │   ├── idea_to_graph_ontology/      # Concept extraction → GraphDB
│   │   │   ├── src/                      # LangChain, RDFlib, SPARQLWrapper
│   │   │   └── pyproject.toml
│   │   │
│   │   └── text_extract_ideas/          # PDF/HTML → evidence extraction
│   │       ├── src/                      # PyMuPDF, pipeline logic
│   │       ├── tests/                    # Package tests
│   │       ├── run_chapters.py
│   │       ├── run_pipeline.py
│   │       └── requirements.txt
│   │
│   ├── requirements.txt                 # Core dependencies
│   ├── pyproject.toml                   # Project metadata
│   └── README.md
│
├── scripts/                            # Standalone utility scripts
│   ├── setup_evidence_layer.sql         # Postgres schema migration
│   ├── setup_graph_db.py                # GraphDB initialization
│   └── backup_db.py                     # Database backups
│
├── docker-compose.yml                   # Local development: Postgres, GraphDB, Redis
├── pyproject.toml                       # Root Python project metadata
├── package.json                         # Root TypeScript project metadata
├── pnpm-workspace.yaml                  # PNPM workspace configuration
│
	└── docs/                               # Documentation
    ├── PRD/                             # Product Requirements
    └── architecture/                    # Architecture documents
```

## Language Distribution

| Component | Language | Primary Purpose |
|-----------|----------|-----------------|
| **Frontend UI** | TypeScript | Next.js web application |
| **Web Backend** | TypeScript | NestJS API (main backend) |
| **Python AI Service** | Python | FastAPI (AI/LLM operations only) |
| **Celery Workers** | Python | Background task processing |
| **AI/LLM** | Python | Concept extraction, Writer Agent |
| **Data Pipeline** | Python | News ingestion, evidence processing |

## Service Communication

```
Next.js (Frontend)
    ↓ REST API
NestJS (Web Backend)
    ↓ HTTP (when AI needed)
FastAPI (Python AI Service)
    ↓ Celery protocol
Celery Workers (Python)
```

## Key Points

- **NestJS is the main backend** — handles most API routes and business logic
- **FastAPI is a specialized AI service** — called only when AI/LLM operations are needed
- **Tests** reside within each package directory (e.g., `packages/agent/writer_agent/test_*.py`)
- **No `handbook/` folder** — Python code is in `python_services/`
- **No `pipeline/` folder** — Pipeline code is in individual packages
- **No `templates/` folder** — Templates are handled differently
- **`python_services`** uses underscore, not hyphen

---

_Last updated: 2026-04-07_

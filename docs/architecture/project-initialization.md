# Project Initialization

**Current State: Python-First Architecture**

This project is brownfield — the existing `python_services/packages/` must be preserved and adapted, not replaced.

---

## Existing Structure (Already Set Up)

The project is already initialized with:

```
apps/
├── web/          # Next.js (TypeScript) — already exists
└── api/          # NestJS (TypeScript) — already exists

python_services/
├── api.py                        # FastAPI entry point
├── packages/
│   ├── agent/
│   │   ├── news_agent/           # Already exists
│   │   └── writer_agent/         # Already exists with tests
│   ├── news_collector/           # Already exists
│   ├── idea_to_graph_ontology/   # Already exists
│   └── text_extract_ideas/       # Already exists
├── requirements.txt
└── pyproject.toml
```

---

## Initial Setup Commands

### Next.js Web Application

```bash
# Already exists, but for reference:
cd apps/web
pnpm install
pnpm run dev
```

### Python FastAPI Backend

```bash
# Core dependencies
cd python_services
pip install -r requirements.txt

# Or using uv (faster):
uv pip install -r requirements.txt
```

### Docker Services (Local Development)

```bash
# Start Postgres, GraphDB, Redis
docker-compose up -d
```

---

## Python Package Setup

### Core Dependencies (requirements.txt)

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
celery>=5.0.0
redis>=5.0.0
sqlalchemy>=2.0
psycopg[binary]>=3.0
pydantic>=2.0.0
loguru>=0.7.0
python-dotenv
zai  # LLM SDK
```

### Development Tools

```bash
# Install dev tools
pip install ruff mypy pytest pytest-cov black
```

---

## Existing Packages to Adapt

| Existing Package | Purpose | Adapt To |
|-----------------|---------|----------|
| `packages/agent/news_agent/` | News processing | Extend with Celery tasks |
| `packages/agent/writer_agent/` | Page synthesis | Integrate with FastAPI routes |
| `packages/news_collector/` | RSS/Twitter/YouTube | Keep as-is, add Celery integration |
| `packages/idea_to_graph_ontology/` | GraphDB integration | Keep as-is, update for new schema |
| `packages/text_extract_ideas/` | PDF processing | Keep as-is, integrate with evidence pipeline |

---

## Architecture Decisions

| Component | Decision | Version |
|-----------|----------|---------|
| **Frontend** | Next.js (App Router) | latest |
| **Frontend Language** | TypeScript | 5.9+ |
| **Web Backend** | NestJS (TypeScript) | latest |
| **Python AI Service** | FastAPI (Python) | 0.104+ |
| **Task Queue** | Celery + Redis | 5.0+ |
| **AI/LLM** | Python | 3.10+ |
| **LLM Provider** | z.ai | — |
| **Database** | PostgreSQL 16 + pgvector | — |
| **Graph DB** | GraphDB (RDF) | latest |

**Key Point:** NestJS is the main web backend. FastAPI provides a specialized Python service for AI/LLM operations. NestJS calls FastAPI when Python operations are needed.

---

## Environment Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd cherry-in-the-haystack

# 2. Install Node.js dependencies
pnpm install

# 3. Install Python dependencies
cd python_services
pip install -r requirements.txt

# 4. Start Docker services
docker-compose up -d

# 5. Run database migrations
python scripts/setup_evidence_layer.sql
python scripts/setup_graph_db.py

# 6. Start NestJS backend (Terminal 1)
cd apps/api
npm run start:dev

# 7. Start FastAPI (Python AI service) (Terminal 2)
cd python_services
uvicorn api:app --reload --port 8000

# 8. Start Celery worker (Terminal 3)
cd python_services
celery -A api.celery_app worker --loglevel=info

# 9. Start Celery beat (Terminal 4)
cd python_services
celery -A api.celery_app beat --loglevel=info

# 10. Start Next.js frontend (Terminal 5)
cd apps/web
pnpm run dev
```

---

## First Implementation Tasks

1. **Set up FastAPI routes** — Move from single `api.py` to organized route handlers
2. **Add Celery configuration** — Configure Celery app in `api.py`
3. **Integrate existing packages** — Connect `news_collector`, `writer_agent` to Celery tasks
4. **Database migration** — Run schema setup scripts
5. **Test connectivity** — Verify FastAPI → Postgres, GraphDB, Redis

---

_Last updated: 2026-04-07_

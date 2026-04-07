# ADR-010: Codebase Structure — Monorepo with Separate TypeScript and Python Services

**Date:** 2026-04-07
**Status:** Accepted
**Context:** Reorganization after migration from `dev/` structure

---

## Decision

The codebase is organized as a **monorepo with separate service boundaries**:

```
cherry-in-the-haystack/
├── apps/                       # TypeScript applications (pnpm workspace)
│   ├── api/                     # NestJS backend (port 4000)
│   └── web/                     # Next.js frontend (port 3000)
├── python_services/             # Python services (Poetry workspace)
│   ├── packages/                # Python packages (reusable logic)
│   │   ├── agent/
│   │   ├── idea_to_graph_ontology/
│   │   ├── news_collector/
│   │   └── text_extract_ideas/
│   └── api/                     # FastAPI server (port 8000)
│       ├── main.py
│       ├── routes/
│       └── pyproject.toml
├── docs/                        # Architecture docs, PRD, ADRs
├── _bmad-output/                # BMAD-generated artifacts
├── node_modules/                # pnpm workspace (root-level)
├── pyproject.toml               # Root Python dependencies
└── docker-compose.yml
```

---

## Rationale

### Why Separate `apps/` and `python_services/`?

1. **Different runtime ecosystems**
   - TypeScript runs on Node.js with pnpm workspaces
   - Python runs on CPython with Poetry
   - They cannot share dependencies or module systems

2. **Clear service boundaries**
   - `apps/api` (NestJS) handles web backend, user auth, business logic
   - `python_services/api` (FastAPI) handles AI/LLM, PDF, GraphDB operations
   - Each service has its own port and deployment lifecycle

3. **No viable alternative**
   - TypeScript cannot import Python modules directly (different runtimes)
   - Python cannot import TypeScript modules directly
   - Communication must happen via HTTP (or stdio/messages)

---

## Why NOT `next_js_webapp/` or Similar Consolidation?

### Rejected: `next_js_webapp/` containing `apps/` and `node_modules/`

**Problem:** pnpm workspace requires `node_modules` at root level.

```
❌ This breaks:
next_js_webapp/
├── node_modules/    # pnpm won't find this
├── apps/
└── package.json
```

**Why it fails:**
- `pnpm-workspace.yaml` expects `packages: ['apps/*', 'packages/*']` relative to root
- Moving `apps/` requires updating all import paths (`@cherry/api` → new path)
- `node_modules` at root is how pnpm shares dependencies across workspace packages

### Rejected: Single `services/` folder

```
❌ Not better than current:
services/
├── nestjs-api/
├── nextjs-web/
└── python-api/
```

**Why rejected:**
- Requires updating `pnpm-workspace.yaml`
- Requires updating all TypeScript import paths
- Non-standard for pnpm monorepos
- No clear benefit over `apps/` naming

---

## Why `python_services/api/` IS Valid

Unlike Node.js/pnpm, Python has **no workspace constraint**:

1. **Flexible imports**
   ```python
   # Can use relative imports
   from ...packages.agent import run_agent

   # Or sys.path manipulation
   sys.path.append('../packages')
   from agent import run_agent
   ```

2. **No workspace file**
   - Poetry doesn't have `pnpm-workspace.yaml` equivalent
   - `pyproject.toml` can reference packages via `path = "../packages/agent"`

3. **Simpler Docker builds**
   ```dockerfile
   # Single build context for all Python code
   WORKDIR /app
   COPY packages/ ./packages/
   COPY api/ ./api/
   ```

---

## Port Allocation

| Service | Port | Framework | Purpose |
|---------|------|-----------|---------|
| `apps/api` | 4000 | NestJS | Web backend, user auth |
| `apps/web` | 3000 | Next.js | Frontend UI |
| `python_services/api` | 8000 | FastAPI | AI/LLM, PDF, GraphDB |
| PostgreSQL | 5432 | - | Database |
| GraphDB | 7200 | - | Knowledge graph |
| Redis | 6379 | - | Cache |

---

## Communication Between Services

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript (Orchestrator)                  │
│                                                               │
│  packages/pipeline/jobs/*  ──┐                              │
│  apps/api/src/*               │                              │
│                               ▼                              │
│                    HTTP (fetch/axios)                       │
│                               │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Python FastAPI Server                  │   │
│  │              python_services/api/main.py            │   │
│  │              Port: 8000                             │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  POST /api/v1/pdf/extract                           │   │
│  │  POST /api/v1/ontology/extract                       │   │
│  │  POST /api/v1/ontology/update                        │   │
│  │  POST /api/v1/writer/generate                        │   │
│  │  GET  /api/v1/health                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                               │                              │
│                               ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Python Packages                        │   │
│  ├──────────────────┬──────────────────────────────────┤   │
│  │  agent/          │  idea_to_graph_ontology/          │   │
│  │  news_collector/ │  text_extract_ideas/              │   │
│  └──────────────────┴──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Completed

| From | To | Status |
|------|-----|--------|
| `dev/packages/ontology/` | `python_services/packages/idea_to_graph_ontology/` | ✅ Migrated |
| `dev/packages/pdf_knowledge_extractor/` | `python_services/packages/text_extract_ideas/` | ✅ Migrated |
| `dev/packages/news_collector/` | `python_services/packages/news_collector/` | ✅ Migrated |
| Root `pyproject.toml` | Root `pyproject.toml` (consolidated) | ✅ Consolidated |

---

## Re-evaluate If

- We need to share Python code outside `python_services/`
- `python_services/api/` becomes too large and needs splitting
- We adopt a Python monorepo tool (Poetry workspaces, uv)

---

## References

- ADR-006: TypeScript for orchestration; Python for LLM/PDF/GraphDB
- Epic 1+2 Team Integration Plan: `_bmad-output/planning-artifacts/epic-1-2-team-integration-plan.md`
- API Contract: Same integration plan document

---

_**Author:** Tech Lead (Hankeol)
**Date:** 2026-04-07
**Status:** Accepted — Implementation in progress_

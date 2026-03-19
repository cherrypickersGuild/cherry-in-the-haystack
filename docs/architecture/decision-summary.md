# Decision Summary

| Category                   | Decision                               | Version                  | Affects Epics    | Rationale                                                            |
| -------------------------- | -------------------------------------- | ------------------------ | ---------------- | -------------------------------------------------------------------- |
| Web Language               | TypeScript                             | 5.9+                     | All              | Type-safe; Nest.js native; shared types across frontend and pipeline |
| AI/LLM Language            | Python                                 | 3.10+                    | Epics 1, 3, 4    | Best ecosystem for LLM SDKs, embeddings, and PDF parsing             |
| Web Framework              | Nest.js (App Router)                   | latest                   | Phase 2          | Full-stack TypeScript; API routes + SSR; single deployment unit      |
| Package Manager            | pnpm                                   | latest                   | All TS           | Workspace support; fast; disk-efficient                              |
| Python Deps                | Poetry                                 | 1.8+                     | Epics 1, 3, 4    | Lock files; dev/prod dependency separation                           |
| Python Linting             | Ruff                                   | latest                   | Epics 1, 3, 4    | Single tool replacing flake8, black, isort                           |
| Python Logging             | Loguru                                 | latest                   | Epics 1, 3, 4    | Structured logging, superior to stdlib                               |
| Python Types               | mypy                                   | latest                   | Epics 1, 3, 4    | Static type checking for pipeline reliability                        |
| Python Testing             | pytest + pytest-cov                    | latest                   | Epics 1, 3, 4    | Standard Python testing, coverage reporting                          |
| Pipeline Scheduling        | Cron (system cron / node-cron)         | —                        | Epics 2, 3, 4    | No external orchestration service; simple, reliable scheduling       |
| Primary Database           | PostgreSQL 16 (Amazon RDS db.t3.small) | 16                       | Epics 1, 2, 3, 4 | Evidence Layer; ~$25/month; point-in-time recovery                   |
| PostgreSQL Driver (Python) | psycopg3                               | latest                   | Epics 1, 3, 4    | Modern async-capable Postgres adapter with type hints                |
| PostgreSQL Driver (TS)     | Prisma or postgres.js                  | latest                   | Phase 2          | Type-safe ORM / query builder for Nest.js API routes                 |
| Graph Database             | GraphDB (RDF, self-hosted)             | latest                   | Epics 1, 3, 4    | Free open-source; RDF standard; no production licensing cost         |
| Vector Store               | pgvector (PostgreSQL extension)        | latest                   | Epics 1, 3       | No separate infrastructure; sufficient for ~100K vectors             |
| Content Deployment         | Nest.js webapp (AWS / Oracle)          | —                        | Epics 1, 4       | Full-stack TypeScript; content served from database via API routes   |
| CI/CD                      | GitHub Actions                         | —                        | Epics 1, 5       | Existing infrastructure; build, test, and deploy pipeline            |
| Local Dev                  | Docker Compose                         | —                        | Epic 1           | PostgreSQL 16 + pgvector + GraphDB; 30-min onboarding target         |
| Review Workspace           | Notion API v2 (source of truth)        | v2                       | Epics 1, 2       | KT already uses Notion; eliminates custom review UI                  |
| LLM — Synthesis            | Claude 3.5 Sonnet                      | claude-3-5-sonnet-latest | Epics 3, 4       | 200K context; superior concept extraction and prose quality          |
| LLM — Embeddings           | OpenAI text-embedding-3-small          | 1536 dims                | Epics 1, 3       | $0.02/1M tokens; sufficient quality for semantic search              |
| LLM — Fallback             | Gemini Flash                           | latest                   | Epics 3, 4       | When Claude unavailable after 2 retries; cost-effective              |
| Python Retry               | tenacity                               | latest                   | Epics 1, 3, 4    | Exponential backoff with jitter for external API calls               |
| Content Format             | Markdown                               | —                        | Epics 2, 4, 5    | Supports frontmatter metadata; rendered by Next.js webapp            |
| Notion Client (TS)         | notion-client (official SDK)           | latest                   | Epics 1, 2       | Official SDK; handles auth and pagination                            |
| GitHub Automation          | Octokit or GitHub API                  | latest                   | Epics 2, 4       | Bot account atomic commits; TypeScript native                        |

---

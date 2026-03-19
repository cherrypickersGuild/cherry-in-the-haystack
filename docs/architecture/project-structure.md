# Project Structure

```
cherry-in-the-haystack/
│
├── apps/
│   └── web/                            # Nest.js application (TypeScript)
│       ├── app/
│       │   ├── (public)/               # Public routes — no auth required
│       │   │   ├── basics/[slug]/
│       │   │   ├── advanced/[slug]/
│       │   │   └── newly-discovered/
│       │   ├── (dashboard)/            # Authenticated routes (Phase 2)
│       │   └── api/                    # Nest.js API routes
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
│   │   ├── deploy.yml                  # main push: Nest.js build → deploy to AWS/Oracle
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

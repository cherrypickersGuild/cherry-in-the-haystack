# Implementation Patterns

These patterns ensure consistent implementation across all AI dev agents working on this codebase:

### Naming Patterns

| Item                       | Convention                            | Example                                    |
| -------------------------- | ------------------------------------- | ------------------------------------------ |
| TypeScript files           | `kebab-case.ts`                       | `notion-client.ts`, `category-matcher.ts`  |
| TypeScript functions       | `camelCase`                           | `fetchApprovedItems()`, `commitToGitHub()` |
| TypeScript interfaces      | `PascalCase` with `I` prefix optional | `NotionPage`, `ConceptQueryResult`         |
| TypeScript constants       | `UPPER_SNAKE_CASE`                    | `MAX_RETRIES`, `NOTION_RATE_LIMIT`         |
| Python files               | `lowercase_underscores.py`            | `concept_matcher.py`                       |
| Python functions/variables | `snake_case`                          | `extract_concept()`, `paragraph_text`      |
| Python constants           | `UPPER_SNAKE_CASE`                    | `MAX_POOL_SIZE = 20`                       |
| Python classes             | `PascalCase`                          | `ConceptQueryResult`, `GraphDBClient`      |
| Python data models         | `@dataclass` with type hints          | `@dataclass class Concept:`                |
| Test files (Python)        | `test_{module_name}.py`               | `test_concept_matcher.py`                  |
| Test files (TS)            | `{module}.test.ts`                    | `notion-client.test.ts`                    |
| Markdown content files     | `lowercase-with-hyphens.md`           | `retrieval-augmented-generation.md`        |
| Newly Discovered files     | `{YYYY-MM-DD}-{slug}.md`              | `2025-01-15-llama-4-release.md`            |
| Cron job files             | `{action}.ts` in `jobs/`              | `news-ingestion.ts`, `notion-backup.ts`    |
| Database tables            | `snake_case` plural                   | `paragraph_chunks`, `pipeline_runs`        |
| Database columns           | `snake_case`                          | `extracted_concept`, `importance_score`    |
| Environment variables      | `UPPER_SNAKE_CASE`                    | `DATABASE_URL`, `NOTION_API_TOKEN`         |
| GitHub bot commits         | `handbook-bot` account                | `"Weekly publish: 12 items (2025-01-15)"`  |

### Structure Patterns

- **Test organization:** `tests/unit/` and `tests/integration/` for Python; co-located `*.test.ts` for TypeScript
- **Config:** All external credentials via environment variables — never hardcoded, never committed
- **Idempotency:** All cron jobs must be safe to re-run (UPSERT not INSERT; check before write)
- **Job isolation:** Each cron job script is a standalone entry point — no shared state between runs
- **TypeScript/Python split:** TypeScript for orchestration, HTTP calls, Notion/GitHub integration; Python for LLM calls, PDF parsing, GraphDB queries

### Format Patterns

| Item                       | Format                              | Example                                                    |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Dates in frontmatter       | ISO 8601 `YYYY-MM-DD`               | `2025-01-15`                                               |
| Timestamps in database     | `TIMESTAMP WITH TIME ZONE` (UTC)    | `2025-01-15T00:00:00Z`                                     |
| LLM structured output      | Always JSON (never parse free text) | `{"concept": "RAG", "confidence": 0.95}`                   |
| Evidence citation in pages | `"[excerpt]" — [Source] ([type])`   | `"RAG reduces hallucinations" — LLM Handbook (paraphrase)` |
| Cost tracking              | `cost_cents` as `NUMERIC(10,2)`     | Field in `pipeline_runs`, `paragraph_chunks`               |

### Documentation Placement Patterns

| Type | Location | Examples |
|------|----------|----------|
| Architecture docs | `docs/architecture/` | ADRs, DDL, patterns |
| Developer/AI-facing docs | `docs/` | Technical guides, agent context |
| User-facing docs | `docs/user/` | End-user guides, tutorials |
| Planning artifacts | `_bmad-output/planning-artifacts/` | Epics, integration plans, memos |
| BMAD outputs | `_bmad-output/` | Automated artifacts |

**Rule:** All documentation goes into `docs/` or `_bmad-output/planning-artifacts/`

**Documentation audience distinction:**
- `docs/` (root level) — Internal development documentation for developers and AI agents
- `docs/user/` — End-user documentation (guides, tutorials, help content)
- `docs/architecture/` — System design and architectural decisions
- `_bmad-output/` — BMAD agent-generated artifacts and planning documents

---

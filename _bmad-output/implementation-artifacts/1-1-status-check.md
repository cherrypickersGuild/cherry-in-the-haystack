# Story 1.1: Status Check

Status: ready-for-dev

## Story

As a developer working on this project,
I want a comprehensive audit of existing code, database schema, and infrastructure,
So that I understand the current state before making changes.

## Acceptance Criteria

**Given** the project repository exists
**When** I run the status check
**Then** a comprehensive report is generated documenting:
  - All existing database tables with their schemas
  - Current pipeline jobs and their schedules
  - Environment configuration status
  - Infrastructure components and their health
  - Any gaps or issues identified

**And** the report is saved to `{planning_artifacts}/status-check-report.md`

## Tasks / Subtasks

- [ ] Create status check script in `packages/pipeline/src/jobs/status-check.ts` (AC: #)
  - [ ] Scan and parse database schema from `docs/architecture/ddl-v1.0.sql`
  - [ ] Extract all tables with columns, types, constraints, and indexes
  - [ ] Scan for existing pipeline jobs in `packages/pipeline/src/jobs/`
  - [ ] Check environment variables against `.env.example`
  - [ ] Verify Docker Compose services configuration
  - [ ] Generate markdown report with all findings
- [ ] Add npm script to run status check (AC: #)
  - [ ] Add `status-check` script to `packages/pipeline/package.json`
  - [ ] Test script execution and report generation
- [ ] Document any gaps or issues found (AC: #)
  - [ ] Identify missing infrastructure components
  - [ ] Flag incomplete configuration
  - [ ] Note any schema inconsistencies

## Dev Notes

### Epic Context

This is the first story of **Epic 1: Discover Curated Content (Universal Version)**, which builds the content pipeline for a weekly digest. The status check establishes our baseline before implementing any pipeline changes.

### Project Structure

**Monorepo Layout:**
```
cherry-in-the-haystack/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # API server
├── packages/
│   └── pipeline/     # TypeScript pipeline scripts (CURRENTLY EMPTY)
├── docs/
│   └── architecture/ # Architecture docs including DDL
├── scripts/         # Utility scripts
├── _bmad-output/    # BMAD generated artifacts
│   ├── planning-artifacts/
│   └── implementation-artifacts/
└── docker-compose.yml
```

**Key Finding:** The `packages/pipeline/src/` directory currently only contains `index.ts` with an empty export. No pipeline jobs exist yet - this is a **critical gap** to document.

### Database Schema

**Location:** `docs/architecture/ddl-v1.0.sql`

**Database:** PostgreSQL 16 with pgvector extension
**Database Name:** `cherry_platform` (as defined in DDL)

**Schema Structure:**
- `core` - User accounts, prompt templates, run logs
- `personal` - User preferences, follows, custom concepts
- `content` - Sources, articles, entities, categories
- `handbook` - Books, chapters, paragraphs, embeddings
- `concept` - Concept pages, changelogs
- `snapshot` - Statistics and pre-built views
- `publishing` - Newsletters, recipients, send logs

**Key Tables to Document:**
1. `core.app_user` - User accounts with tiers (FREE/PAID/ENTERPRISE)
2. `content.source` - Content source configuration
3. `content.article_raw` - Fetched articles
4. `content.tracked_entity` - Global entity registry
5. `content.user_article_state` - User-article relationships
6. `core.run_log` - Pipeline execution tracking

### Infrastructure Components

**Docker Services (docker-compose.yml):**
1. **PostgreSQL** (`pgvector/pgvector:pg16`)
   - Port: 5432
   - Default credentials: cherry/cherry_dev/cherry_db
   - Health check: `pg_isready`

2. **GraphDB** (`ontotext/graphdb:10.7.4`)
   - Port: 7200
   - Health check: HTTP endpoint check
   - Purpose: Knowledge graph storage (Concept/Evidence layers)

3. **Redis** (`redis:7-alpine`)
   - Port: 6379
   - Purpose: Caching layer (implied by NFR-P2)

### Environment Variables

**Required Variables (from .env.example):**

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://cherry:cherry_dev@localhost:5432/cherry_db` |
| `NOTION_API_TOKEN` | Notion integration | None |
| `ANTHROPIC_API_KEY` | Claude API access | None |
| `GITHUB_TOKEN` | GitHub commit access | None |
| `SLACK_WEBHOOK_URL` | Pipeline alerts | None |
| `TWITTER_BEARER_TOKEN` | Twitter API | None |
| `REDDIT_CLIENT_ID` | Reddit API | None |
| `REDDIT_CLIENT_SECRET` | Reddit API | None |

**Health Check Status:**
- Verify which variables are set vs. documented
- Flag any missing credentials
- Note that `NOTION_API_TOKEN` and `ANTHROPIC_API_KEY` are critical for Epic 1

### Pipeline Jobs

**Current State:** No pipeline jobs exist yet.

**Expected Jobs (from PRD references):**
1. **source-fetch** - Fetch content from RSS/Twitter/Discord/etc.
2. **article-ai-process** - Score and classify articles with AI
3. **weekly-publish** - Sync approved Notion content to GitHub
4. **newly-discovered-build** - Generate weekly "Newly Discovered" pages
5. **embedding-build** - Generate vector embeddings for deduplication

**Cron Schedule Requirements (from epics.md):**
- `weekly-publish.ts`: Sunday 00:00 UTC
- `notion-backup.ts`: Daily 00:00
- `news-ingestion.ts`: Every 6 hours
- `writer-agent`: Daily at 02:10

### Technology Stack

**Languages & Frameworks:**
- TypeScript 5.9+
- Node.js >=20.0.0
- pnpm >=9.0.0

**Key Dependencies:**
- `@anthropic-ai/sdk` (^0.36.0) - Claude API for AI processing
- `@notionhq/client` (^2.3.0) - Notion integration
- `@octokit/rest` (^20.1.0) - GitHub API
- `pg` (^8.13.0) - PostgreSQL client
- `rss-parser` (^3.13.0) - RSS feed parsing
- `node-cron` (^3.0.3) - Job scheduling
- `p-throttle` (^5.0.0) - Rate limiting

**Testing:**
- `vitest` (^2.0.0) - Unit/integration tests
- `nock` (^13.5.0) - HTTP mocking

### Implementation Requirements

**Script Structure:**

```typescript
// packages/pipeline/src/jobs/status-check.ts
import fs from 'fs';
import path from 'path';

interface SchemaReport {
  tables: TableInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}

interface InfrastructureReport {
  dockerServices: ServiceInfo[];
  environmentStatus: EnvVarStatus[];
}

export async function runStatusCheck(): Promise<void> {
  // 1. Parse DDL file
  // 2. Scan for existing jobs
  // 3. Check environment
  // 4. Generate report
}
```

**Output Format:** Save to `_bmad-output/planning-artifacts/status-check-report.md`

**Report Sections:**
1. **Executive Summary** - Overall health status
2. **Database Schema** - All tables, columns, indexes
3. **Pipeline Jobs** - Existing jobs and schedules (expected: none)
4. **Infrastructure** - Docker services status
5. **Environment Configuration** - Required variables status
6. **Gaps & Issues** - Missing components, inconsistencies
7. **Recommendations** - Next steps based on findings

### Code Conventions

**File Organization:**
- Pipeline jobs go in `packages/pipeline/src/jobs/`
- Each job is a standalone TypeScript file
- Use async/await for all I/O operations
- Export `run{JobName}()` function for each job

**Naming Conventions:**
- Files: kebab-case (`status-check.ts`, `weekly-publish.ts`)
- Functions: camelCase (`runStatusCheck`, `fetchSources`)
- Constants: SCREAMING_SNAKE_CASE (`DATABASE_URL`, `MAX_RETRIES`)

**Error Handling:**
- Use try-catch for all I/O operations
- Log errors to console with context
- Exit with appropriate status codes

### Testing Requirements

**Unit Tests:**
- Test DDL parsing logic
- Test environment variable checking
- Test report generation

**Integration Tests:**
- Test against actual database (if available)
- Verify report file creation

**Test Files Location:** `packages/pipeline/src/jobs/__tests__/status-check.test.ts`

### Deployment Notes

**No deployment required** - this is a one-time status check script. However, the script can be re-run anytime to refresh the status report.

**Execution:** Run via npm script: `pnpm --filter @cherry/pipeline status-check`

### Project Structure Notes

**Monorepo Configuration:**
- Workspace: `pnpm-workspace.yaml`
- Packages: `apps/*` and `packages/*`
- Build: `pnpm -r build` builds all packages

**Detected Issues:**
1. Pipeline package is empty - no jobs exist yet
2. No `src/jobs/` directory structure exists
3. Database DDL exists but hasn't been applied (no migration scripts)

### References

- [PRD: Functional Requirements](../../_bmad-output/planning-artifacts/epics.md) - FR-1.1 through FR-9.1
- [Database Schema](../../docs/architecture/ddl-v1.0.sql) - Complete DDL definition
- [Infrastructure Requirements](../../_bmad-output/planning-artifacts/epics.md#infrastructure-requirements) - Docker, cron, backup strategy
- [Environment Variables](../../.env.example) - Required configuration

### Success Criteria

1. Script runs without errors
2. Report file is created at correct location
3. Report includes all required sections
4. Database tables are accurately documented
5. Gaps are clearly identified (e.g., no pipeline jobs exist)
6. Report is human-readable markdown format

## Dev Agent Record

### Agent Model Used

To be filled by dev agent

### Debug Log References

### Completion Notes List

### File List

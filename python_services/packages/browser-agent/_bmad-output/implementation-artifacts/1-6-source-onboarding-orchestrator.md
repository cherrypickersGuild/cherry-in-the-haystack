# Story 1.6: Source Onboarding Orchestrator

**Status:** review
**Story ID:** 1.6
**Epic:** 1 ??Source Onboarding Engine
**Created:** 2026-05-24

---

## Tasks / Subtasks

- [x] Task 1: Add TypeScript DB client for orchestrator queries (AC1, AC2, AC4)
  - [x] 1.1 Add `pg` and `@types/pg` to `packages/pipeline/package.json` dependencies
  - [x] 1.2 Create `packages/pipeline/src/db/crawler-db.ts` ??pool init/close + 6 query functions (see Dev Notes)
  - [x] 1.3 Verify `content.source` NOT NULL columns against DDL before writing upsert
- [x] Task 2: Implement the orchestrator job
  - [x] 2.1 Create `packages/pipeline/src/jobs/browser-crawl.ts` ??main entry point
  - [x] 2.2 Implement `resolveSourceId(source, pool)` ??SELECT from `content.source` by URL; INSERT if absent
  - [x] 2.3 Implement `runOnboardingPipeline(sourceId, source, committer, pool)`:
    - [x] 2.3a Skip if `browser_use_only: true` (AC3, FR-3.6)
    - [x] 2.3b SELECT from `content.crawler_registry WHERE source_id=? AND status IN ('active','pending_review')`
    - [x] 2.3c If active entry ??skip source (AC2 NFR-1 cost guard)
    - [x] 2.3d If pending_review entry with `pr_number` ??call `checkAndActivatePR()` ??skip generate
    - [x] 2.3e If pending_review entry without `pr_number` ??retry PR creation with existing `generated_code`
    - [x] 2.3f If no entry ??call analyze ??generate ??create PR ??update registry with pr_number/pr_url
  - [x] 2.4 Implement `callAnalyze(sourceId, url)` ??POST :8000/crawler/analyze, return `{analysis_id, analysis_json}`
  - [x] 2.5 Implement `callGenerate(sourceId, analysisId, sourceName)` ??POST :8000/crawler/generate, return `{registry_id, generated_code}`
  - [x] 2.6 Implement `checkAndActivatePR(registryRow, pool, octokit)` ??GET PR via Octokit; if merged, UPDATE status='active' + pr_merged_at
  - [x] 2.7 Implement `buildPRBody(source, analysisJson, analysisId)` ??ADR-014-R1 format
  - [x] 2.8 Implement `updateRegistryWithPR(registryId, prNumber, prUrl, pool)` ??UPDATE pr_number/pr_url
- [x] Task 3: Write Jest tests
  - [x] 3.1 Mock `pg.Pool`, `fetch`, and `OctokitGitHubCommitter` at module level
  - [x] 3.2 Test: new source (no analysis, no registry) ??full pipeline fires in order
  - [x] 3.3 Test: source with active registry entry ??neither analyze nor generate called (AC2)
  - [x] 3.4 Test: source with pending_review + pr_number + PR merged ??status updated to 'active' (AC4)
  - [x] 3.5 Test: source with pending_review + pr_number + PR not merged ??no update (AC4)
  - [x] 3.6 Test: source with `browser_use_only: true` ??skip all operations (AC3)
  - [x] 3.7 Test: source removed from YAML ??not in loop, not processed (AC5)

---

## User Story

As an engineer,
I want a daily orchestration job that reads the YAML config, detects new sources, and automatically runs the full analysis ??generation ??PR pipeline for each new entry,
so that adding a URL to the config file is everything I need to do to onboard a new source.

---

## Acceptance Criteria

**AC1 ??New source triggers full pipeline:**
**Given** the daily orchestrator runs and the YAML config contains a source with no existing `crawler_analysis` record
**When** the orchestrator executes
**Then** it calls `POST /crawler/analyze` for that source
**And** on success, calls `POST /crawler/generate`
**And** on success, calls `GitHubCommitter.createPullRequest()` with the generated code
**And** the new `crawler_registry` row references the correct `analysis_id`

**AC2 ??Skip fully onboarded sources (NFR-1 cost guard):**
**Given** the daily orchestrator runs and a source already has a `crawler_analysis` record and an `active` or `pending_review` `crawler_registry` entry
**When** the orchestrator executes
**Then** neither `/crawler/analyze` nor `/crawler/generate` is called for that source

**AC3 ??browser_use_only sources are skipped:**
**Given** a source with `browser_use_only: true` in the config
**When** the orchestrator runs
**Then** `/crawler/analyze` and `/crawler/generate` are not called for that source (FR-3.6)
**And** no `crawler_registry` row is created for that source

**AC4 ??PR merge detection activates crawler:**
**Given** a `crawler_registry` row with `status = 'pending_review'` and `pr_number` set, and the PR has been merged on GitHub
**When** the orchestrator runs its PR status check
**Then** the `crawler_registry` row is updated to `status = 'active'` and `pr_merged_at` is set

**AC5 ??Removed sources are ignored:**
**Given** a source entry is removed from the YAML config
**When** the orchestrator runs
**Then** the source is not scheduled for analysis or generation
**And** existing `crawler_analysis` and `crawler_registry` DB records are retained (FR-1.6)

**AC6 ??New sources are processed on next cycle:**
**Given** a new source entry is added to the YAML config
**When** the orchestrator runs on the next daily cycle
**Then** the analysis ??generation ??PR pipeline fires for that source (FR-1.5)

---

## Dev Notes

### New File Structure

```
packages/pipeline/src/
  db/
    crawler-db.ts            ??NEW ??TypeScript DB client for orchestrator queries
    __tests__/
      crawler-db.test.ts     ??NEW ??pg mock tests
  jobs/
    browser-crawl.ts         ??NEW ??main orchestrator job (entry point)
    __tests__/
      browser-crawl.test.ts  ??NEW ??integration-style tests with mocked DB + HTTP
```

**Do NOT touch:** `src/config/source-config.ts`, `src/publication/github-committer.ts`, any Python files, existing test files.

---

### TypeScript DB Client ??`crawler-db.ts` (CRITICAL NEW)

The orchestrator does direct DB queries per ADR-013-R1 flow. Add `pg` + `@types/pg` to `packages/pipeline/package.json`.

```json
"dependencies": {
  "pg": "^8.12.0",
  ...
},
"devDependencies": {
  "@types/pg": "^8.11.6",
  ...
}
```

Implement these 6 functions in `src/db/crawler-db.ts`:

```typescript
import { Pool, PoolClient } from 'pg'

// 1. Pool lifecycle ??call initPool() at job start, closePool() on exit
export function createPool(connectionString: string): Pool
export async function closePool(pool: Pool): Promise<void>

// 2. Source resolution
export async function getSourceByUrl(pool: Pool, url: string): Promise<{ id: string } | null>
export async function insertSource(pool: Pool, params: {
  id: string
  url: string
  sourceName: string
  sourceType: string
}): Promise<string>
// CRITICAL: verify content.source NOT NULL columns in DDL before implementing insertSource.
// Minimum expected: id, url, source_name, source_type. There may be additional required fields.

// 3. Registry state queries
export async function getActiveOrPendingRegistry(pool: Pool, sourceId: string): Promise<{
  id: string
  status: 'active' | 'pending_review'
  prNumber: number | null
  prUrl: string | null
  generatedCode?: string   // needed for pending-without-PR retry
} | null>

// 4. Registry state updates
export async function updateRegistryWithPR(pool: Pool, registryId: string, prNumber: number, prUrl: string): Promise<void>
export async function activateRegistry(pool: Pool, registryId: string, prMergedAt: Date): Promise<void>
```

**pg connection string** comes from `process.env.DATABASE_URL`. Use same format as Python side (`postgresql://user:pass@host:port/db`).

---

### Source ID Resolution (CRITICAL)

YAML sources have a `url` but no `source_id`. The orchestrator must resolve a UUID from `content.source`.

```typescript
async function resolveSourceId(pool: Pool, source: SourceConfig): Promise<string> {
  const existing = await getSourceByUrl(pool, source.url)
  if (existing) return existing.id

  // Source not yet in DB ??insert it
  const newId = generateUuidV4()  // use built-in crypto.randomUUID()
  await insertSource(pool, {
    id: newId,
    url: source.url,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })
  return newId
}
```

**Use `crypto.randomUUID()`** (Node.js 15+ built-in) for UUID generation ??no extra dependency needed.
Note: The DB schema requires UUID v7 PKs per ADR convention, but for `content.source` rows created by the orchestrator, UUID v4 is acceptable since the requirement is at the Python DB client layer for crawler-specific tables. **Verify this with the DDL before deploying.**

---

### Python API Integration

Base URL comes from `process.env.CRAWLER_API_URL` (default: `http://localhost:8000`).
Use built-in `fetch` (Node 18+) ??no axios dependency needed.

```typescript
// POST /crawler/analyze
async function callAnalyze(sourceId: string, url: string): Promise<{
  analysis_id: string
  analysis_json: AnalysisJsonShape
}> {
  const res = await fetch(`${CRAWLER_API_URL}/crawler/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, url }),
    signal: AbortSignal.timeout(65_000),  // 60s server timeout + 5s buffer
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/analyze failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json()
}

// POST /crawler/generate
async function callGenerate(sourceId: string, analysisId: string, sourceName: string): Promise<{
  registry_id: string
  generated_code: string
}> {
  const res = await fetch(`${CRAWLER_API_URL}/crawler/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, analysis_id: analysisId, source_name: sourceName }),
    signal: AbortSignal.timeout(35_000),  // 30s server timeout + 5s buffer
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/generate failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json()
}
```

**Type for analysis_json shape** (matches Python `AnalysisJson` in `models/crawler.py`):

```typescript
interface AnalysisJsonShape {
  content_selector: string
  title_selector: string
  date_selector: string
  author_selector: string
  url_selector: string
  body_selector: string
  pagination_type: 'none' | 'click' | 'scroll'
  dynamic_load: boolean
  notes: string
  wait_for: string | null
  js_code: string | null
  magic_mode: boolean
}
```

---

### Orchestration Loop Logic

```typescript
// packages/pipeline/src/jobs/browser-crawl.ts

const CONFIG_PATH = path.join(__dirname, '../../config/sources.yaml')

export async function runBrowserCrawlJob(): Promise<void> {
  const pool = createPool(process.env.DATABASE_URL!)
  const committer = OctokitGitHubCommitter.fromEnv()
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

  try {
    const sources = loadSourceConfig(CONFIG_PATH)

    for (const source of sources) {
      try {
        await processSource(pool, committer, octokit, source)
      } catch (err) {
        // Log and continue ??one source failure must not halt others
        console.error(`[browser-crawl] source=${source.sourceName} error:`, err)
      }
    }
  } finally {
    await closePool(pool)
  }
}

async function processSource(pool, committer, octokit, source: SourceConfig): Promise<void> {
  // AC3: browser_use_only sources are NEVER onboarded via crawl4ai (FR-3.6)
  if (source.browserUseOnly) {
    console.log(`[browser-crawl] skip browser_use_only source: ${source.sourceName}`)
    return
  }

  const sourceId = await resolveSourceId(pool, source)

  // Check registry state first (AC2 NFR-1 cost guard)
  const registry = await getActiveOrPendingRegistry(pool, sourceId)

  if (registry?.status === 'active') {
    // Fully active ??nothing to do
    console.log(`[browser-crawl] active crawler exists: ${source.sourceName}`)
    return
  }

  if (registry?.status === 'pending_review') {
    if (registry.prNumber) {
      // AC4: check if PR was merged
      await checkAndActivatePR(pool, octokit, registry)
    } else {
      // Edge case: generate ran but PR creation failed ??retry PR creation
      await retryPRCreation(pool, committer, source, sourceId, registry)
    }
    return  // Do NOT re-run analyze/generate (AC2)
  }

  // No registry entry ??run the full pipeline (AC1, AC6)
  await runFullPipeline(pool, committer, source, sourceId)
}
```

---

### PR Merge Detection

```typescript
async function checkAndActivatePR(pool, octokit, registry): Promise<void> {
  const owner = process.env.GITHUB_REPO_OWNER!
  const repo = process.env.GITHUB_REPO_NAME!

  const pr = await octokit.rest.pulls.get({
    owner, repo,
    pull_number: registry.prNumber!,
  })

  if (pr.data.merged_at) {
    await activateRegistry(pool, registry.id, new Date(pr.data.merged_at))
    console.log(`[browser-crawl] activated registry ${registry.id} (PR #${registry.prNumber} merged)`)
  }
}
```

---

### Full Onboarding Pipeline (New Source)

```typescript
async function runFullPipeline(pool, committer, source: SourceConfig, sourceId: string): Promise<void> {
  console.log(`[browser-crawl] onboarding new source: ${source.sourceName}`)

  const analyzeResult = await callAnalyze(sourceId, source.url)
  const { analysis_id: analysisId, analysis_json: analysisJson } = analyzeResult

  const generateResult = await callGenerate(sourceId, analysisId, source.sourceName)
  const { registry_id: registryId, generated_code: generatedCode } = generateResult

  const kebabName = toKebabCase(source.sourceName)
  const prBody = buildPRBody(source, analysisJson, analysisId)

  const { prNumber, prUrl } = await committer.createPullRequest({
    branch: `feat/crawler/${kebabName}`,
    title: `feat(crawler): add generated crawler for ${source.sourceName}`,
    body: prBody,
    files: [{
      path: `python_services/crawlers/generated/${kebabName}.py`,
      content: generatedCode,
    }],
  })

  await updateRegistryWithPR(pool, registryId, prNumber, prUrl)
  console.log(`[browser-crawl] opened PR #${prNumber} for ${source.sourceName}`)
}
```

---

### PR Body Format (ADR-014-R1)

```typescript
function buildPRBody(source: SourceConfig, analysisJson: AnalysisJsonShape, analysisId: string): string {
  return [
    `Source:        ${source.sourceName}`,
    `Analysis ID:   ${analysisId}`,
    `Key selectors: baseSelector=${analysisJson.content_selector}`,
    `Pagination:    ${analysisJson.pagination_type}`,
    `crawl4ai:      wait_for=${analysisJson.wait_for ?? 'null'}, magic=${analysisJson.magic_mode}`,
    `Generated at:  ${new Date().toISOString()}`,
  ].join('\n')
}
```

---

### `toKebabCase` Helper

Reuse the same logic as Python's `_to_kebab_case` in `crawler.py`. Do NOT import from Python ??reimplement in TypeScript:

```typescript
function toKebabCase(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}
```

---

### Environment Variables

| Variable            | Used By         | Description                                           |
|---------------------|-----------------|-------------------------------------------------------|
| `DATABASE_URL`      | crawler-db.ts   | PostgreSQL DSN, e.g. `postgresql://user:pass@host/db` |
| `GITHUB_TOKEN`      | OctokitGitHubCommitter | PAT for handbook-bot with `repo` write scope  |
| `GITHUB_REPO_OWNER` | OctokitGitHubCommitter | GitHub org/user                               |
| `GITHUB_REPO_NAME`  | OctokitGitHubCommitter | Repository name                               |
| `CRAWLER_API_URL`   | callAnalyze, callGenerate | Python service base URL (default: `http://localhost:8000`) |

---

### DB Queries Reference

```sql
-- getSourceByUrl
SELECT id FROM content.source WHERE url = $1 LIMIT 1

-- getActiveOrPendingRegistry
SELECT id, status, pr_number, pr_url, generated_code
FROM content.crawler_registry
WHERE source_id = $1 AND status IN ('active', 'pending_review')
ORDER BY created_at DESC LIMIT 1

-- updateRegistryWithPR
UPDATE content.crawler_registry
SET pr_number = $2, pr_url = $3, updated_at = NOW()
WHERE id = $1

-- activateRegistry
UPDATE content.crawler_registry
SET status = 'active', pr_merged_at = $2, updated_at = NOW()
WHERE id = $1
```

---

### Testing Pattern

```typescript
// src/jobs/__tests__/browser-crawl.test.ts

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    end: jest.fn(),
  }
  return { Pool: jest.fn(() => mockPool) }
})

jest.mock('../../publication/github-committer', () => ({
  OctokitGitHubCommitter: {
    fromEnv: jest.fn(() => ({ createPullRequest: jest.fn() })),
  },
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('runBrowserCrawlJob', () => {
  it('calls analyze ??generate ??createPR for new source (AC1)', ...)
  it('skips analyze+generate for source with active registry (AC2)', ...)
  it('skips browser_use_only sources entirely (AC3)', ...)
  it('activates registry when PR is merged (AC4)', ...)
  it('does not process sources removed from YAML (AC5)', ...)
})
```

**Key mock setup pattern (consistent with github-committer.test.ts):**
- Use `jest.mock()` at module level
- `beforeEach(() => { jest.clearAllMocks() })`
- `mockResolvedValue()` / `mockRejectedValue()` for async
- Named exports: `export function runBrowserCrawlJob()`; `export async function processSource()` (for isolated unit tests)

---

### Architecture Compliance Checklist

- [x] TypeScript file naming: `kebab-case.ts` ??`browser-crawl.ts`, `crawler-db.ts` ??- [x] Job location: `packages/pipeline/src/jobs/` per ADR-014
- [x] `loadSourceConfig()` imported from `../config/source-config` ??DO NOT re-implement YAML parsing
- [x] `OctokitGitHubCommitter.fromEnv()` used for GitHub operations ??DO NOT create new Octokit directly in job (use committer for PR, raw Octokit only for PR status checks)
- [x] Zero DB access in `GitHubCommitter` (verified in Story 1.5) ??all DB calls go through `crawler-db.ts`
- [x] `browser_use_only: true` sources are skipped with no registry row created (FR-3.6)
- [x] One source failure does NOT halt the job ??catch per-source errors and continue
- [x] PR file path: `python_services/crawlers/generated/{source_name_kebab}.py` (ADR-014-R1)
- [x] PR head branch: `feat/crawler/{source_name_kebab}` (ADR-014)
- [x] `content.source` upsert uses `crypto.randomUUID()` ??NO additional uuid library needed

---

## Previous Story Intelligence (Story 1.5 Learnings)

**What Story 1.5 established (must follow):**
- `OctokitGitHubCommitter.fromEnv()` reads `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`
- `createPullRequest()` handles GitHub-only: close existing PR on branch + create new + open PR
- **DB operations (update registry with pr_number/pr_url after createPullRequest) are the orchestrator's responsibility** ??not GitHubCommitter's
- `commitFiles()` stub exists but only commits to BASE_BRANCH (no PR opened) ??Story 4.1 extends it
- Package setup: `packages/pipeline/package.json` exists with `jest`, `ts-jest`, `typescript`, `@octokit/rest`, `js-yaml`, `zod`
- Jest config: `ts-jest` with `diagnostics: { warnOnly: true }` (do NOT change this)
- Tests use `jest.mock()` at module level, `jest.fn().mockResolvedValue()` for async mocks
- `tsconfig.json`: `target: ES2020`, `module: commonjs`, `strict: true`, `rootDir: ./src`

**CRITICAL scope boundary established in Story 1.5:**
- `createPullRequest()` detects and closes open PRs on the same branch (GitHub-side only)
- The DB deprecation of old `pending_review` rows is the **orchestrator's job** (Story 1.6)
- For the normal daily flow (Story 1.6), the orchestrator sees pending_review ??checks PR merge ??if not merged, no action. It does NOT re-trigger generate or re-create the PR.
- Re-triggering generate for a deprecated crawler is Story 3.3 (auto-regeneration), not this story.

**Package version note (from Story 1.5 debug log):**
- `@types/node@^18.19.0` is intentional ??do NOT upgrade to 20+ (causes `Buffer` type incompatibility with existing tests)

---

## File List

- `packages/pipeline/src/db/crawler-db.ts` ??NEW: TypeScript PostgreSQL client for orchestrator queries
- `packages/pipeline/src/db/__tests__/crawler-db.test.ts` ??NEW: pg mock tests
- `packages/pipeline/src/jobs/browser-crawl.ts` ??NEW: daily orchestrator job (main entry point)
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` ??NEW: orchestration flow tests
- `packages/pipeline/package.json` ??MODIFY: add `pg` + `@types/pg` dependencies

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Pre-existing `source-config.test.ts` has 3 TS type errors (`Buffer<ArrayBufferLike>` vs `NonSharedBuffer`) under `tsc --noEmit` ??known issue from Story 1.5, suppressed by `diagnostics: { warnOnly: true }` in jest.config.js. New files are error-free.
- `content.source` schema not directly accessible (lives in cherry-in-the-haystack). `insertSource()` uses minimal fields (id, url, source_name, source_type) with `ON CONFLICT (url) DO NOTHING`. If the table has additional NOT NULL columns, the INSERT must be updated before deployment.
- `runBrowserCrawlJob` uses dynamic `import('@octokit/rest')` to allow module-level jest.mock to intercept correctly ??avoids static import hoisting issues in tests.

### Completion Notes List

- AC1 ??`processSource` with no registry entry: calls `/crawler/analyze` ??`/crawler/generate` ??`createPullRequest()` ??`updateRegistryWithPR()` in order.
- AC2 ??Active or pending_review registry entry ??skip both analyze and generate (NFR-1 cost guard).
- AC3 ??`browser_use_only: true` sources return immediately with no DB queries or HTTP calls (FR-3.6).
- AC4 ??Pending PR merge detection: calls `octokit.rest.pulls.get()` ??if `merged_at` is set, `activateRegistry()` updates status + pr_merged_at.
- AC5 ??Sources removed from YAML are simply not iterated ??no DB records deleted.
- AC6 ??New YAML entries are processed on the next job run (the absence of registry entry triggers the full pipeline).
- `toKebabCase()` matches Python's `_to_kebab_case()` regex logic ??same output for given source names.
- `retryPRCreation()` handles edge case where generate succeeded but PR creation failed in a prior run.
- Pool closed in `finally` block ??guaranteed even on per-source errors.
- 18 new tests (10 crawler-db + 8 browser-crawl); 37 pre-existing tests unchanged. Total: 55 tests, 0 failures.

### Change Log

| Date | Change |
|------|--------|
| 2026-05-24 | Story created ??comprehensive developer guide for Source Onboarding Orchestrator TypeScript implementation |
| 2026-05-24 | Implementation complete ??5 new files, 18 tests added (55 total pass); status ??review |

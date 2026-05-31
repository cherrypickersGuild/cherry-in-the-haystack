# Story 4.1: Notion Source Registry Sync Job

**Status:** review
**Story ID:** 4.1
**Epic:** 4 — Notion Source Registry Sync
**Created:** 2026-05-25

---

## Tasks / Subtasks

- [x] Task 1: Add `@notionhq/client` dependency — `packages/pipeline/package.json`
  - [x] 1.1 Add `"@notionhq/client": "^2.2.14"` under `dependencies`

- [x] Task 2: Create `notion-sync.ts` — `packages/pipeline/src/jobs/notion-sync.ts`
  - [x] 2.1 Add `NOTION_SOURCE_DB_CONFIGS` constant array (two DB configs from ADR-015)
  - [x] 2.2 Add Notion property extractor helpers: `extractUrlFromProperty`, `extractTextFromProperty`, `extractCheckboxFromProperty`
  - [x] 2.3 Add `loadSourcesYaml()` — reads config file, returns `{ raw, existingUrls }`
  - [x] 2.4 Add `buildUpdatedYaml()` — preserves header comment block, re-dumps sources array with new entries appended
  - [x] 2.5 Add `buildPRBody()` — formats PR description with added source names and their DB origin
  - [x] 2.6 Add `runNotionSyncJob(committer: GitHubCommitter): Promise<void>` — main export
  - [x] 2.7 Implement Notion pagination loop (`has_more` + `next_cursor`) for both DBs inside `runNotionSyncJob`
  - [x] 2.8 Implement `source_type` validation against `CONTENT_SOURCE_TYPES` — skip invalid entries with `console.warn`
  - [x] 2.9 Implement URL dedup check against existing YAML URLs — skip already-present URLs
  - [x] 2.10 Deduplicate within-run: track added URLs in a `Set` to prevent double-add when a URL appears in both DBs
  - [x] 2.11 If zero new entries: log and return early without opening PR
  - [x] 2.12 If new entries: call `committer.createPullRequest()` with updated YAML and PR description
  - [x] 2.13 Wrap top-level in try/catch — log failure, do not throw (failed sync must not crash pipeline)
  - [x] 2.14 Add `withRetry()` helper for 5xx Notion errors (max 3 attempts, exponential backoff: 1s, 2s, 4s)

- [x] Task 3: Create test file — `packages/pipeline/src/jobs/__tests__/notion-sync.test.ts`
  - [x] 3.1 Mock `@notionhq/client` Client at module level
  - [x] 3.2 Mock `fs` / `readFileSync` with fixture YAML content
  - [x] 3.3 AC1 test: new URL in LinkedIn DB → appended to YAML, PR opened
  - [x] 3.4 AC2 test: URL already in YAML → skipped (no PR opened)
  - [x] 3.5 AC3 test: new URLs in both DBs → both appended, PR body lists both with DB origin
  - [x] 3.6 AC4 test: invalid `source_type` → entry skipped + warning logged, other valid entries still processed
  - [x] 3.7 AC5 test: `browser_use_only` checkbox → parsed as boolean in YAML entry
  - [x] 3.8 AC6 test: no new sources across all DBs → `createPullRequest` NOT called
  - [x] 3.9 AC7 test: Notion API returns 500 → retried up to 3 times with backoff, failure logged, `createPullRequest` NOT called
  - [x] 3.10 AC8 test: same URL in both LinkedIn DB and Custom Crawl DB → added only once (within-run dedup)

- [x] Task 4: Remove TODO comment — `packages/pipeline/src/publication/github-committer.ts`
  - [x] 4.1 Remove the `// TODO (Story 4.1)...` comment block from `commitFiles()` (lines 147–149)

---

## User Story

As an engineer,
I want a daily job that reads the Notion Source Registry DBs and automatically upserts new sources into the YAML config and opens a PR,
so that I can onboard sources by adding them to Notion without ever touching the YAML file directly.

---

## Acceptance Criteria

**AC1 — New source from Notion is appended to YAML config:**
**Given** the daily Notion sync job runs
**When** it queries both configured Notion DBs (LinkedIn DB `342f199edf7c803ebb2cfcb30bd492e3` and Custom Crawl DB `340f199edf7c80cabc78f94853d2c426`)
**Then** it reads each page's URL property (`Linkedin` for LinkedIn DB, `URL` for Custom Crawl DB), `Name`, `source_type`, and `browser_use_only` fields using the `NOTION_SOURCE_DB_CONFIGS` array
**And** for each Notion entry whose URL does not already exist in the YAML config, a new source entry is appended

**AC2 — Existing sources are not overwritten (FR-1.4):**
**Given** a Notion entry whose URL already exists in the YAML config
**When** the sync job processes it
**Then** the existing YAML entry is left unchanged (upsert inserts only, no overwrite of existing sources)

**AC3 — PR opened with source names and DB origin:**
**Given** the sync job identifies one or more new sources
**When** the YAML config is updated
**Then** `createPullRequest()` is called with the updated config file
**And** the PR description lists the newly added source names and their Notion DB origin (LinkedIn DB or Custom Crawl DB)

**AC4 — Invalid source_type skipped with warning:**
**Given** a Notion entry with a `source_type` value that does not match any value in `content.source_type_enum`
**When** the sync job encounters it
**Then** that entry is skipped and a warning is logged identifying the source name and invalid type value
**And** all other valid entries in the same sync run are still processed

**AC5 — browser_use_only parsed as boolean:**
**Given** a Notion entry with a `browser_use_only` property
**When** it is read
**Then** the checkbox value is parsed as a boolean and correctly reflected in the YAML entry

**AC6 — No PR when no new sources:**
**Given** all Notion entries already exist in the YAML config (or no Notion entries)
**When** the sync job runs
**Then** `createPullRequest()` is NOT called

**AC7 — Failed sync run is logged, pipeline unaffected:**
**Given** the Notion API returns a rate-limit (429) or transient server error (500)
**When** the sync job encounters it
**Then** it retries with exponential backoff (5xx: up to 3 attempts, 1s → 2s → 4s delays)
**And** if all retries fail, the failure is logged but does not affect the existing YAML config or any other pipeline jobs

**AC8 — Within-run URL dedup:**
**Given** a URL that appears in both the LinkedIn DB and the Custom Crawl DB
**When** the sync job processes both DBs
**Then** the source is added to the YAML config only once

---

## Dev Notes

### API Design: `createPullRequest()` vs `commitFiles()`

**Use `createPullRequest()`, NOT `commitFiles()`.**

The epics AC references `commitFiles()`, but `createPullRequest()` (already on the `GitHubCommitter` interface) is the correct method — it creates an isolated branch, commits files, and opens a PR. `commitFiles()` commits directly to `feature/browser-crawl-agent` with no PR isolation, and lacks a PR body parameter for listing added sources.

The TODO comment in `commitFiles()` (lines 147–149) anticipates this story. Remove it in Task 4.

**PR branch name:** `feat/notion-sync/{YYYY-MM-DD}` — e.g., `feat/notion-sync/2026-05-25`. Date-stamped to avoid conflicts on repeat runs. If the job runs twice on the same day, `createPullRequest()` auto-closes the previous PR for that branch (Story 1.5 behavior).

**PR files path:** `packages/pipeline/config/sources.yaml` (relative to repo root, same as where the file lives in the repository).

---

### New File: `notion-sync.ts` Structure

```typescript
// packages/pipeline/src/jobs/notion-sync.ts
import { Client } from '@notionhq/client'
import { dump, load } from 'js-yaml'
import { readFileSync } from 'fs'
import * as path from 'path'
import { CONTENT_SOURCE_TYPES, ContentSourceType } from '../config/source-config'
import type { GitHubCommitter } from '../publication/github-committer'

// ─── Notion DB config (ADR-015) ───────────────────────────────────────────────

interface NotionSourceDbConfig {
  databaseId: string
  urlProperty: string
  nameProperty: string
  sourceTypeProperty: string
  browserUseOnlyProperty: string
}

const NOTION_SOURCE_DB_CONFIGS: readonly NotionSourceDbConfig[] = [
  {
    databaseId: '342f199edf7c803ebb2cfcb30bd492e3',
    urlProperty: 'Linkedin',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
  {
    databaseId: '340f199edf7c80cabc78f94853d2c426',
    urlProperty: 'URL',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
] as const

const LINKEDIN_DB_ID = '342f199edf7c803ebb2cfcb30bd492e3'
const CONFIG_PATH = path.join(__dirname, '../../config/sources.yaml')
const YAML_REPO_PATH = 'packages/pipeline/config/sources.yaml'

// ─── YAML entry shape (snake_case — matches sources.yaml format) ──────────────

interface SourceYamlEntry {
  url: string
  source_name: string
  source_type: string
  browser_use_only?: boolean
}
```

**Property extractors** — handle multiple Notion property types for safety:

```typescript
function extractUrlFromProperty(page: any, propertyName: string): string | null {
  const prop = page.properties?.[propertyName]
  if (!prop) return null
  if (prop.type === 'url') return prop.url ?? null
  if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text ?? null
  return null
}

function extractTextFromProperty(page: any, propertyName: string): string | null {
  const prop = page.properties?.[propertyName]
  if (!prop) return null
  if (prop.type === 'title') return prop.title?.[0]?.plain_text ?? null
  if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text ?? null
  if (prop.type === 'select') return prop.select?.name ?? null
  return null
}

function extractCheckboxFromProperty(page: any, propertyName: string): boolean | null {
  const prop = page.properties?.[propertyName]
  if (!prop || prop.type !== 'checkbox') return null
  return prop.checkbox
}
```

**YAML update — preserves header comment block:**

```typescript
function buildUpdatedYaml(configPath: string, newEntries: SourceYamlEntry[]): string {
  const raw = readFileSync(configPath, 'utf8')
  const parsed = load(raw) as { sources: SourceYamlEntry[] }
  const allSources = [...(parsed.sources ?? []), ...newEntries]

  // Preserve the large header comment block above 'sources:'
  const sourcesIdx = raw.indexOf('\nsources:')
  const headerBlock = sourcesIdx >= 0 ? raw.slice(0, sourcesIdx) : ''

  const sourcesDump = dump({ sources: allSources }, { lineWidth: -1, noRefs: true })
  return headerBlock + '\n' + sourcesDump
}
```

**PR body builder:**

```typescript
function buildPRBody(added: Array<{ sourceName: string; dbId: string }>): string {
  const lines = [
    '## Notion Source Registry Sync',
    '',
    'New sources added from Notion:',
    '',
  ]
  for (const { sourceName, dbId } of added) {
    const origin = dbId === LINKEDIN_DB_ID ? 'LinkedIn DB' : 'Custom Crawl DB'
    lines.push(`- **${sourceName}** (${origin})`)
  }
  lines.push('')
  lines.push('After merging, the browser-crawl job will pick up these sources on the next daily cycle.')
  return lines.join('\n')
}
```

**Retry helper for 5xx Notion errors:**

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const is5xx = typeof err?.status === 'number' && err.status >= 500 && err.status < 600
      if (is5xx && attempt < maxAttempts) {
        const delayMs = 1000 * Math.pow(2, attempt - 1)  // 1s, 2s, 4s
        console.warn(`[notion-sync] attempt ${attempt} failed (${err.status}), retrying in ${delayMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}
```

**Main `runNotionSyncJob()` function structure:**

```typescript
export async function runNotionSyncJob(committer: GitHubCommitter): Promise<void> {
  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN })

    const raw = readFileSync(CONFIG_PATH, 'utf8')
    const parsed = load(raw) as { sources: Array<{ url: string }> }
    const existingUrls = new Set((parsed.sources ?? []).map((e) => e.url))

    const added: Array<{ sourceName: string; dbId: string }> = []
    const newEntries: SourceYamlEntry[] = []

    for (const dbConfig of NOTION_SOURCE_DB_CONFIGS) {
      let cursor: string | undefined = undefined
      do {
        const response = await withRetry(() =>
          notion.databases.query({
            database_id: dbConfig.databaseId,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        )

        for (const page of response.results) {
          const url = extractUrlFromProperty(page, dbConfig.urlProperty)
          const name = extractTextFromProperty(page, dbConfig.nameProperty)
          const sourceType = extractTextFromProperty(page, dbConfig.sourceTypeProperty)
          const browserUseOnly = extractCheckboxFromProperty(page, dbConfig.browserUseOnlyProperty)

          if (!url || !name || !sourceType) {
            console.warn(`[notion-sync] skipping entry with missing fields in DB ${dbConfig.databaseId}`)
            continue
          }
          if (!CONTENT_SOURCE_TYPES.includes(sourceType as ContentSourceType)) {
            console.warn(`[notion-sync] invalid source_type "${sourceType}" for "${name}" — skipping`)
            continue
          }
          if (existingUrls.has(url)) continue  // AC2, AC8

          const entry: SourceYamlEntry = { url, source_name: name, source_type: sourceType }
          if (browserUseOnly !== null) entry.browser_use_only = browserUseOnly

          newEntries.push(entry)
          existingUrls.add(url)  // AC8: within-run dedup
          added.push({ sourceName: name, dbId: dbConfig.databaseId })
        }

        cursor = response.next_cursor ?? undefined
      } while (cursor)
    }

    if (newEntries.length === 0) {
      console.log('[notion-sync] no new sources found — skipping PR')
      return
    }

    const updatedYaml = buildUpdatedYaml(CONFIG_PATH, newEntries)
    const branch = `feat/notion-sync/${new Date().toISOString().slice(0, 10)}`

    const { prNumber, prUrl } = await committer.createPullRequest({
      branch,
      title: `feat(notion-sync): add ${newEntries.length} new source(s) from Notion`,
      body: buildPRBody(added),
      files: [{ path: YAML_REPO_PATH, content: updatedYaml }],
    })

    console.log(`[notion-sync] opened PR #${prNumber} with ${newEntries.length} source(s): ${prUrl}`)
  } catch (err) {
    console.error('[notion-sync] sync job failed — existing config and pipeline unaffected:', err)
  }
}
```

---

### Notion SDK: `@notionhq/client` Key Facts

- **Version `^2.2.14`** — latest stable as of 2026-05-25. TypeScript types bundled (no `@types/` package needed).
- **Rate limit (429)**: handled automatically by the SDK with exponential backoff — do NOT add retry logic for 429.
- **5xx server errors**: NOT auto-retried by SDK — use `withRetry()` helper (Task 2.14).
- **`notion.databases.query()`** returns `{ results: PageObjectResponse[], has_more: boolean, next_cursor: string | null }`.
- **Pagination**: Loop until `response.next_cursor` is `null` (handled by the `do...while` pattern above).
- **Auth env var**: `NOTION_TOKEN` — set in env, passed as `auth` to `new Client({ auth: ... })`.
- **Error type guard**: `import { isNotionClientError } from '@notionhq/client'` available if needed for error discrimination.

---

### YAML Serialization Notes

- `js-yaml` is already in dependencies (`"js-yaml": "^4.1.0"`) — no new import needed.
- `dump({ sources: allSources }, { lineWidth: -1, noRefs: true })` produces clean block-style YAML.
- `lineWidth: -1` disables line wrapping (URLs would otherwise wrap).
- `noRefs: true` prevents `&ref` anchors in output.
- The header comment block (~41 lines) is preserved by slicing the raw string before `'\nsources:'`.
- Inline comments on existing entries (e.g., `# browser_use_only: true`) are lost on re-dump — acceptable since this is a programmatic update.

---

### `createPullRequest()` Behavior (Review)

From `packages/pipeline/src/publication/github-committer.ts` (line 47–140):
- **AC2 in Story 1.5**: If an open PR already exists for `branch`, it is closed via Octokit before creating a new one.
- For Notion sync: if the daily job runs twice on the same day (`feat/notion-sync/2026-05-25`), the second run closes the first PR and opens a fresh one. This is safe behavior.
- **Base branch**: Always `feature/browser-crawl-agent` (hardcoded `BASE_BRANCH` constant at line 17).
- **Committer identity**: `handbook-bot` / `handbook-bot@users.noreply.github.com` (line 19–22).

---

### Test File Structure

```typescript
// packages/pipeline/src/jobs/__tests__/notion-sync.test.ts
// Mock at module level (before imports)

const mockDatabasesQuery = jest.fn()
jest.mock('@notionhq/client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    databases: { query: mockDatabasesQuery },
  })),
}))

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(FIXTURE_YAML),
}))

const mockCreatePullRequest = jest.fn()
const mockCommitter = { createPullRequest: mockCreatePullRequest }

// ─── Fixture YAML ────────────────────────────────────────────────────────────
const FIXTURE_YAML = `
sources:
  - url: "https://existing.com/blog"
    source_name: "Existing Blog"
    source_type: "BLOG"
`.trim()

// ─── Notion page builder ──────────────────────────────────────────────────────
function makeNotionPage(url: string, name: string, sourceType: string, browserUseOnly?: boolean): any {
  return {
    properties: {
      URL: { type: 'url', url },
      Linkedin: { type: 'url', url },
      Name: { type: 'title', title: [{ plain_text: name }] },
      source_type: { type: 'select', select: { name: sourceType } },
      browser_use_only: browserUseOnly !== undefined
        ? { type: 'checkbox', checkbox: browserUseOnly }
        : { type: 'checkbox', checkbox: false },
    },
  }
}
```

**Key test mock patterns:**
- Each `mockDatabasesQuery` call returns `{ results: [...], has_more: false, next_cursor: null }` by default
- For pagination tests: first call returns `{ results: [...], has_more: true, next_cursor: 'cursor-1' }`, second returns `{ results: [...], has_more: false, next_cursor: null }`
- Mock `readFileSync` returns `FIXTURE_YAML` (already includes `https://existing.com/blog`)
- AC4 test: `mockCreatePullRequest` should NOT be called if invalid entry is the only Notion entry (no valid entries = no PR); it SHOULD be called if valid entries also present

---

### `commitFiles()` TODO Removal (Task 4)

**File:** `packages/pipeline/src/publication/github-committer.ts`

**Current lines 147–149:**
```typescript
async commitFiles(
  files: { path: string; content: string }[],
  message: string,
): Promise<string> {
  // TODO (Story 4.1): Story 4.1 AC requires commitFiles() to also open a PR and return the PR URL.
  // Current behavior: commits files to BASE_BRANCH and returns the branch name.
  for (const file of files) {
```

**Remove lines 148–149** (the two TODO comment lines). Keep everything else intact. The `commitFiles()` method stays as-is — Story 4.1 uses `createPullRequest()` instead, making the TODO obsolete.

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|---------------|
| ADR-015: Two target DBs with config-driven URL property names | `NOTION_SOURCE_DB_CONFIGS` array |
| ADR-015: `source_type` validation against `content.source_type_enum` | `CONTENT_SOURCE_TYPES.includes()` check |
| ADR-015: `browser_use_only` parsed as boolean | `extractCheckboxFromProperty()` with `type === 'checkbox'` guard |
| FR-1.4: Upsert inserts only, no overwrite of existing sources | `existingUrls.has(url)` guard, skip if present |
| FR-1.4: PR lists newly added sources with Notion DB origin | `buildPRBody()` with `dbId === LINKEDIN_DB_ID` check |
| Codebase conventions: TypeScript `kebab-case.ts` | `notion-sync.ts` ✓ |
| All jobs idempotent | Skip existing URLs ✓; same-day re-run closes/reopens PR via `createPullRequest()` ✓ |
| No hardcoded credentials | `process.env.NOTION_TOKEN` only ✓ |

---

### File Structure

```
packages/pipeline/
  package.json                         ← MODIFY: add @notionhq/client dependency

  src/
    jobs/
      notion-sync.ts                   ← CREATE: main sync job
      __tests__/
        notion-sync.test.ts            ← CREATE: full test suite

    publication/
      github-committer.ts              ← MODIFY: remove TODO comment (lines 148–149)
```

**No DB migration, no Python changes, no new TypeScript interfaces.**

---

### Previous Story Intelligence

- This is the first story in Epic 4 — no previous Epic 4 story to reference.
- From Epic 3 patterns (`browser-crawl.ts`, `crawler-db.ts`): errors are caught, logged with `[module-name] message:`, and do not crash the pipeline.
- From Story 1.5 patterns: `createPullRequest()` returns `{ prNumber, prUrl }` and auto-handles existing PRs on the same branch.
- From Story 1.2 patterns: `CONTENT_SOURCE_TYPES` and `ContentSourceType` are already exported from `source-config.ts` — import from there, do NOT redeclare.
- From `browser-crawl.test.ts` patterns: mock modules at the very top of the test file (before `import` statements), use `beforeEach(() => jest.clearAllMocks())`.
- YAML `load()` returns `unknown` in TypeScript — cast with `as { sources: ... }`.
- `dump()` is already used as a named import in this project: `import { dump, load } from 'js-yaml'`.

---

### FR Coverage Cross-Reference

| FR | Implementation |
|----|---------------|
| FR-1.4: Daily sync reads both Notion DBs, upserts new sources to YAML, opens PR | `runNotionSyncJob()` with `NOTION_SOURCE_DB_CONFIGS` iteration |
| ADR-015: LinkedIn DB URL property `Linkedin`, Custom Crawl DB URL property `URL` | Config-driven via `NOTION_SOURCE_DB_CONFIGS[i].urlProperty` |
| ADR-015: Validate `source_type` against enum | `CONTENT_SOURCE_TYPES.includes()` check, skip + warn on mismatch |
| ADR-015: `browser_use_only` is a checkbox (boolean) | `extractCheckboxFromProperty()` type guard |
| NFR-6: LinkedIn/Threads ToS review | Out of scope for this story — noted in architecture |

---

### References

- `packages/pipeline/src/config/source-config.ts` — `CONTENT_SOURCE_TYPES`, `ContentSourceType` (import from here)
- `packages/pipeline/src/publication/github-committer.ts` — `GitHubCommitter` interface, `createPullRequest()` (line 47), `commitFiles()` TODO (line 147)
- `packages/pipeline/config/sources.yaml` — existing YAML structure with header comment block
- Architecture ADR-015 — Notion DB IDs, property names, sync behavior
- Epics Epic 4 / Story 4.1 — all ACs and FR-1.4
- `packages/pipeline/package.json` — current dependencies (no `@notionhq/client` yet)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Task 1: Added `@notionhq/client: "^2.2.14"` to `packages/pipeline/package.json` dependencies; `npm install` completed successfully.
- Task 2: Created `packages/pipeline/src/jobs/notion-sync.ts` with: `NOTION_SOURCE_DB_CONFIGS` (two DB configs per ADR-015), three property extractor helpers, `buildUpdatedYaml()` (header-comment-preserving YAML update), `buildPRBody()`, `withRetry()` (3-attempt exponential backoff for 5xx), and main `runNotionSyncJob()` with pagination loop, source_type validation, within-run URL dedup, and top-level error catch. Uses `createPullRequest()` (not `commitFiles()`) to open the PR with branch `feat/notion-sync/YYYY-MM-DD`.
- Task 3: Created `packages/pipeline/src/jobs/__tests__/notion-sync.test.ts` with 38 tests covering all 8 ACs: property extractor unit tests, YAML update, PR body, withRetry (success/retry/exhausted/non-5xx), integration tests for all ACs including pagination. Fixed fake-timer + unhandled-rejection race by adding `promise.catch(() => {})` before `runAllTimersAsync()` in the exhaustion test.
- Task 4: Removed two TODO comment lines from `commitFiles()` in `github-committer.ts` — made obsolete by using `createPullRequest()` for the sync PR instead.
- Full suite: 164/164 tests pass across all 5 test files; 0 regressions.

### File List

- `packages/pipeline/package.json` — MODIFIED
- `packages/pipeline/src/jobs/notion-sync.ts` — CREATED
- `packages/pipeline/src/jobs/__tests__/notion-sync.test.ts` — CREATED
- `packages/pipeline/src/publication/github-committer.ts` — MODIFIED

### Change Log

- 2026-05-25: Story 4.1 created — Notion Source Registry Sync Job
- 2026-05-25: Story 4.1 implemented — all 4 tasks complete, 38 new tests, 164 total passing

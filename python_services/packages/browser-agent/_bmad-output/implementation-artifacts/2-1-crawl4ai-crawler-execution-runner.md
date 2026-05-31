# Story 2.1: crawl4ai Crawler Execution Runner

**Status:** review
**Story ID:** 2.1
**Epic:** 2 ??Scheduled Crawling & Pipeline Integration
**Created:** 2026-05-24

---

## Tasks / Subtasks

- [x] Task 1: Add `getAllActiveRegistryCrawlers` DB helper (AC1)
  - [x] 1.1 Add `ActiveCrawlerRow` interface to `packages/pipeline/src/db/crawler-db.ts`
  - [x] 1.2 Implement `getAllActiveRegistryCrawlers(pool)` after `activateRegistry` ??JOIN query, no params
  - [x] 1.3 Add test for `getAllActiveRegistryCrawlers` to `packages/pipeline/src/db/__tests__/crawler-db.test.ts`

- [x] Task 2: Add `CrawledItem` type + `callExecute` to `browser-crawl.ts` (AC1, AC3)
  - [x] 2.1 Export `CrawledItem` interface alongside existing types (title, body, published_at, author, url, canonical_url ??snake_case matches Python response shape)
  - [x] 2.2 Implement `callExecute(sourceId)` after `callGenerate` ??`POST /crawler/execute`, 35s timeout, throw on non-ok

- [x] Task 3: Implement `runCrawlerExecution` + `_processCrawledArticles` stub (AC1, AC2, AC4)
  - [x] 3.1 Build `browserUseOnlyUrls` Set from `sources` param
  - [x] 3.2 Call `getAllActiveRegistryCrawlers(pool)` to get all active crawlers with source URLs
  - [x] 3.3 For each crawler: skip if URL is in `browserUseOnlyUrls` (FR-4.5, AC2); otherwise call `callExecute`
  - [x] 3.4 On execute success: log item count, call `_processCrawledArticles` stub
  - [x] 3.5 On execute failure: log `FULL_RUN_FAILURE` with source URL + error ??catch and continue (AC4)
  - [x] 3.6 Add `_processCrawledArticles(_sourceId, _items, _source)` as unexported no-op stub (extension point for 2.2 + 2.3)

- [x] Task 4: Extend `runBrowserCrawlJob` (AC1)
  - [x] 4.1 Add `getAllActiveRegistryCrawlers` to the import from `../db/crawler-db`
  - [x] 4.2 Call `await runCrawlerExecution(pool, sources)` after the onboarding `for` loop (inside `try`, before `finally`)

- [x] Task 5: Write Jest tests (AC1?“AC4)
  - [x] 5.1 `crawler-db.test.ts`: add `getAllActiveRegistryCrawlers` import + two tests (rows mapped + empty)
  - [x] 5.2 `browser-crawl.test.ts`: add `runCrawlerExecution` import
  - [x] 5.3 Test: active non-browser_use_only crawler ??`/crawler/execute` called with correct `source_id` (AC1)
  - [x] 5.4 Test: browser_use_only crawler in active list ??`/crawler/execute` NOT called (AC2)
  - [x] 5.5 Test: 422 on first source ??batch continues, second source still called (AC4)
  - [x] 5.6 Test: network error (fetch throws) on first source ??batch continues (AC4)
  - [x] 5.7 Update existing `runBrowserCrawlJob` smoke tests to handle `getAllActiveRegistryCrawlers` query

---

## User Story

As an engineer,
I want the TypeScript scheduler to invoke `POST /crawler/execute` for all active crawlers once per day,
so that articles from merged crawl4ai crawlers are automatically collected without managing browser lifecycle in TypeScript.

---

## Acceptance Criteria

**AC1 ??Active crawlers are executed:**
**Given** the daily scheduler job runs
**When** it queries `content.crawler_registry WHERE status = 'active'`
**Then** for each active crawler, the scheduler calls `POST :8000/crawler/execute` with `{ source_id }`
**And** the response `{ items: CrawledItem[] }` provides the raw output (title, body, published_at, author, url, canonical_url) per article

**AC2 ??browser_use_only sources are skipped:**
**Given** a source with `browser_use_only: true` in the config
**When** the scheduler runs
**Then** `POST /crawler/execute` is not called for that source (FR-4.5)
**And** the source is routed to the browser-use fallback path (handled in Epic 3)

**AC3 ??NFR-3 latency guard:**
**Given** `/crawler/execute` returns a successful response
**When** its per-source elapsed time is measured
**Then** the full round-trip completes within 5 minutes (NFR-3)
(Note: enforced by the Python endpoint's internal 30s timeout; the TS caller uses 35s `AbortSignal.timeout`)

**AC4 ??Batch resilience:**
**Given** `/crawler/execute` returns a 422 error or network timeout
**When** the scheduler encounters it
**Then** the failure is logged with the source URL and error detail
**And** execution continues for all remaining active crawlers (one failure does not halt the batch)
**And** the failure is treated as a full-run failure for that source (Epic 3 fallback hooks here)

---

## Dev Notes

### File Structure

```
packages/pipeline/src/
  db/
    crawler-db.ts                         ??MODIFY: add ActiveCrawlerRow + getAllActiveRegistryCrawlers
    __tests__/
      crawler-db.test.ts                  ??MODIFY: add getAllActiveRegistryCrawlers tests
  jobs/
    browser-crawl.ts                      ??MODIFY: add CrawledItem, callExecute, runCrawlerExecution,
                                                     _processCrawledArticles stub; extend runBrowserCrawlJob
    __tests__/
      browser-crawl.test.ts               ??MODIFY: add runCrawlerExecution tests + update smoke tests
```

**Do NOT create new files** ??all changes extend existing files.

---

### DB Helper ??`crawler-db.ts`

Add after `activateRegistry`. The query has **no runtime parameters** ??call `pool.query(sql)` with no second arg.

```typescript
export interface ActiveCrawlerRow {
  registryId: string
  sourceId: string
  sourceUrl: string
}

export async function getAllActiveRegistryCrawlers(
  pool: Pool,
): Promise<ActiveCrawlerRow[]> {
  const res = await pool.query(
    `SELECT r.id AS registry_id, r.source_id, s.url AS source_url
     FROM content.crawler_registry r
     JOIN content.source s ON s.id = r.source_id
     WHERE r.status = 'active'
     ORDER BY r.created_at ASC`,
  )
  return res.rows.map((row) => ({
    registryId: row.registry_id as string,
    sourceId: row.source_id as string,
    sourceUrl: row.source_url as string,
  }))
}
```

Add `getAllActiveRegistryCrawlers` to the named import in `browser-crawl.ts`:

```typescript
import {
  createPool,
  closePool,
  getSourceByUrl,
  insertSource,
  getActiveOrPendingRegistry,
  updateRegistryWithPR,
  activateRegistry,
  getAllActiveRegistryCrawlers,   // ADD
  RegistryRow,
} from '../db/crawler-db'
```

---

### `CrawledItem` interface ??`browser-crawl.ts`

Add alongside the existing `AnalysisJsonShape` and `PullRequestCreator` types at the top of the types section:

```typescript
export interface CrawledItem {
  title: string
  body: string
  published_at: string   // snake_case ??matches Python response shape directly
  author: string
  url: string
  canonical_url: string  // snake_case ??matches Python response shape
}
```

**Why snake_case:** The Python `/crawler/execute` response uses `published_at` and `canonical_url` as-is. TypeScript receives and forwards them unchanged. Do NOT camelCase these ??Stories 2.2/2.3 use them as-is when writing to `content.article_raw`.

---

### `callExecute` function ??`browser-crawl.ts`

Add after `callGenerate`, following the exact same pattern:

```typescript
async function callExecute(
  sourceId: string,
): Promise<{ source_id: string; items: CrawledItem[] }> {
  const res = await fetch(`${getCrawlerApiUrl()}/crawler/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId }),
    signal: AbortSignal.timeout(35_000),  // Python endpoint enforces 30s internally; 5s buffer
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/execute failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<{ source_id: string; items: CrawledItem[] }>
}
```

**Timeout value rationale:** `callAnalyze` = 65s (60s Python + 5s), `callGenerate` = 35s (30s Python + 5s), `callExecute` = 35s (30s Python + 5s). NFR-3's "?? min" is the business SLA; the Python endpoint enforces 30s hard cutoff.

---

### `runCrawlerExecution` + `_processCrawledArticles` ??`browser-crawl.ts`

Export `runCrawlerExecution` so tests can call it directly (same pattern as `processSource`). Keep `_processCrawledArticles` unexported.

```typescript
export async function runCrawlerExecution(
  pool: Pool,
  sources: SourceConfig[],
): Promise<void> {
  const browserUseOnlyUrls = new Set(
    sources.filter((s) => s.browserUseOnly).map((s) => s.url),
  )

  const activeCrawlers = await getAllActiveRegistryCrawlers(pool)

  for (const crawler of activeCrawlers) {
    if (browserUseOnlyUrls.has(crawler.sourceUrl)) {
      // FR-4.5: browser_use_only sources skip Playwright execution; Epic 3 handles fallback
      console.log(`[crawler-exec] skip browser_use_only: ${crawler.sourceUrl}`)
      continue
    }

    try {
      const result = await callExecute(crawler.sourceId)
      console.log(
        `[crawler-exec] source=${crawler.sourceUrl} items=${result.items.length}`,
      )
      const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
      await _processCrawledArticles(crawler.sourceId, result.items, sourceConfig)
    } catch (err) {
      // Full-run failure for this source. Epic 3 fallback logic hooks into this signal.
      console.error(
        `[crawler-exec] FULL_RUN_FAILURE source=${crawler.sourceUrl}:`,
        err,
      )
    }
  }
}

// Extension point: Story 2.2 adds validation; Story 2.3 adds dedup + article_raw insert.
// In Story 2.1 this is intentionally a no-op stub. Do NOT implement logic here yet.
async function _processCrawledArticles(
  _sourceId: string,
  _items: CrawledItem[],
  _source: SourceConfig | undefined,
): Promise<void> {
  // stub ??replaced by Stories 2.2 and 2.3
}
```

---

### Extend `runBrowserCrawlJob` ??`browser-crawl.ts`

The `sources` variable is already declared in `runBrowserCrawlJob`. Add the execution phase call after the onboarding `for` loop, inside the `try` block:

```typescript
  try {
    const sources = loadSourceConfig(CONFIG_PATH)

    // Phase 1: Onboarding ??detect new sources, run analyze?’generate?’PR pipeline
    for (const source of sources) {
      try {
        await processSource(pool, committer, octokit as unknown as PRStatusChecker, source)
      } catch (err) {
        console.error(`[browser-crawl] source=${source.sourceName} error:`, err)
      }
    }

    // Phase 2: Crawler Execution (Story 2.1) ??run all active crawl4ai crawlers
    await runCrawlerExecution(pool, sources)
  } finally {
    await closePool(pool)
  }
```

---

### Testing ??`crawler-db.test.ts`

Add to the import line:
```typescript
import {
  createPool,
  closePool,
  getSourceByUrl,
  insertSource,
  getActiveOrPendingRegistry,
  updateRegistryWithPR,
  activateRegistry,
  getAllActiveRegistryCrawlers,
} from '../crawler-db'
```

Add after the `activateRegistry` describe block:

```typescript
describe('getAllActiveRegistryCrawlers', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns mapped ActiveCrawlerRow objects from JOIN query', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({
      rows: [
        { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://techcrunch.com' },
        { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://another.com' },
      ],
    })
    const result = await getAllActiveRegistryCrawlers(pool)
    // No params array ??query called with SQL string only
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.crawler_registry'),
    )
    expect(result).toEqual([
      { registryId: 'reg-1', sourceId: 'src-1', sourceUrl: 'https://techcrunch.com' },
      { registryId: 'reg-2', sourceId: 'src-2', sourceUrl: 'https://another.com' },
    ])
  })

  it('returns empty array when no active crawlers', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const result = await getAllActiveRegistryCrawlers(pool)
    expect(result).toEqual([])
  })
})
```

**Critical:** `getAllActiveRegistryCrawlers` calls `pool.query(sql)` with ONE argument (no params array). The test assertion uses `expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining(...))` with no second arg matcher.

---

### Testing ??`browser-crawl.test.ts`

Add `runCrawlerExecution` to the import:
```typescript
import { Pool } from 'pg'
import { processSource, runBrowserCrawlJob, runCrawlerExecution } from '../browser-crawl'
import type { SourceConfig } from '../../config/source-config'
```

Add a `describe('runCrawlerExecution', ...)` block. The `mockPoolQuery` and `mockFetch` mocks are already set up at module level ??reuse them.

```typescript
describe('runCrawlerExecution', () => {
  describe('AC1, AC2 ??executes non-browser_use_only active crawlers only', () => {
    it('calls /crawler/execute for active non-browser_use_only, skips browser_use_only', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources: SourceConfig[] = [
        makeSource({ url: 'https://techcrunch.com/blog', sourceName: 'TechCrunch', browserUseOnly: false }),
        makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', sourceType: 'LINKEDIN', browserUseOnly: true }),
      ]

      // getAllActiveRegistryCrawlers
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://techcrunch.com/blog' },
          { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://www.linkedin.com/feed' },
        ],
      })

      // /crawler/execute for techcrunch only
      mockFetchJson({ source_id: 'src-1', items: [] })

      await runCrawlerExecution(pool as unknown as Pool, sources)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/crawler/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ source_id: 'src-1' }),
        }),
      )
    })

    it('calls /crawler/execute with correct source_id from active registry', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources: SourceConfig[] = [
        makeSource({ url: 'https://example.com/blog', sourceName: 'Example' }),
      ]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-xyz', source_id: 'src-abc', source_url: 'https://example.com/blog' }],
      })
      mockFetchJson({ source_id: 'src-abc', items: [{ title: 'T', body: 'B', published_at: '2026-01-01', author: 'A', url: 'https://x.com/1', canonical_url: 'https://x.com/1' }] })

      await runCrawlerExecution(pool as unknown as Pool, sources)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/crawler/execute'),
        expect.objectContaining({ body: JSON.stringify({ source_id: 'src-abc' }) }),
      )
    })
  })

  describe('AC4 ??batch resilience', () => {
    it('continues when /crawler/execute returns 422 for one source', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [
        makeSource({ url: 'https://source1.com', sourceName: 'Source1' }),
        makeSource({ url: 'https://source2.com', sourceName: 'Source2' }),
      ]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://source1.com' },
          { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://source2.com' },
        ],
      })

      mockFetchJson({ error: 'TIMEOUT', detail: 'exceeded 30s' }, false)  // source1: 422
      mockFetchJson({ source_id: 'src-2', items: [] })                    // source2: success

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('continues when fetch throws a network error for one source', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [
        makeSource({ url: 'https://source1.com', sourceName: 'Source1' }),
        makeSource({ url: 'https://source2.com', sourceName: 'Source2' }),
      ]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://source1.com' },
          { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://source2.com' },
        ],
      })

      mockFetch.mockRejectedValueOnce(new Error('network error'))
      mockFetchJson({ source_id: 'src-2', items: [] })

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('completes with no fetch calls when no active crawlers exist', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource()]

      mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // no active crawlers

      await runCrawlerExecution(pool as unknown as Pool, sources)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
```

---

### Update Existing `runBrowserCrawlJob` Smoke Tests

The existing smoke tests use `mockPoolQuery.mockResolvedValue(...)` (default for all calls). After adding the execution phase, `getAllActiveRegistryCrawlers` also calls `pool.query`. The existing mock shape `{ id: 'source-uuid-x', status: 'active', ... }` has no `registry_id`/`source_url` fields, so `getAllActiveRegistryCrawlers` would return `[{ registryId: undefined, sourceId: undefined, sourceUrl: undefined }]` ??`callExecute(undefined)` would be called ??TypeError is caught by the loop's try/catch ??test still passes technically, but adds noise.

**Fix:** Update both `runBrowserCrawlJob` smoke tests to use `mockImplementation` that distinguishes the execution-phase query:

```typescript
describe('runBrowserCrawlJob', () => {
  it('processes all sources from config, closes pool in finally block', async () => {
    mockPoolEnd.mockResolvedValue(undefined)
    // Onboarding queries: source has active registry ??skip
    // Execution query (getAllActiveRegistryCrawlers): return empty ??no execute calls
    mockPoolQuery.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('source_url')) {
        // getAllActiveRegistryCrawlers JOIN query
        return Promise.resolve({ rows: [] })
      }
      return Promise.resolve({
        rows: [{ id: 'source-uuid-x', status: 'active', pr_number: 1, pr_url: 'url', generated_code: '#c' }],
      })
    })

    await runBrowserCrawlJob()

    expect(mockPoolEnd).toHaveBeenCalledTimes(1)
  })

  it('continues processing other sources when one source fails (AC1 resilience)', async () => {
    mockPoolQuery
      .mockRejectedValueOnce(new Error('DB connection error'))
      .mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('source_url')) {
          return Promise.resolve({ rows: [] })
        }
        return Promise.resolve({
          rows: [{ id: 'src', status: 'active', pr_number: 1, pr_url: 'u', generated_code: 'c' }],
        })
      })

    await runBrowserCrawlJob()

    expect(mockPoolEnd).toHaveBeenCalledTimes(1)
  })
})
```

**Why `sql.includes('source_url')`:** The `getAllActiveRegistryCrawlers` SQL selects `s.url AS source_url` ??this string is unique to that query among all queries in `crawler-db.ts`.

---

### Architecture Compliance Checklist

- [x] `getAllActiveRegistryCrawlers` in `crawler-db.ts` ??do NOT write SQL inline in `browser-crawl.ts`
- [x] `pool.query(sql)` ??no second arg; test assertion uses single-arg `toHaveBeenCalledWith(stringContaining(...))`
- [x] `runCrawlerExecution` is exported ??required for isolated unit testing (same pattern as `processSource`)
- [x] `_processCrawledArticles` is NOT exported ??internal extension point for Stories 2.2 + 2.3
- [x] `callExecute` uses `AbortSignal.timeout(35_000)` ??matches `callGenerate` timeout pattern
- [x] `CrawledItem` fields use snake_case (`published_at`, `canonical_url`) ??matches Python response, matches `article_raw` column names that Story 2.3 will write
- [x] Per-source errors caught in try/catch, logged with `[crawler-exec] FULL_RUN_FAILURE` ??Epic 3 fallback logic hooks here
- [x] `runCrawlerExecution(pool, sources)` called after onboarding loop, inside `try` block ??pool closed in `finally`
- [x] No new files created ??all changes are additive extensions to existing files

---

### Critical Constraints

**`_processCrawledArticles` is a required stub:** Do NOT skip it or inline its logic. Stories 2.2 and 2.3 modify this function. The stub's signature `(_sourceId, _items, _source)` must be preserved exactly ??prefixed underscores signal intentionally unused params in TypeScript.

**browser_use_only detection uses YAML config URL, NOT DB flag:** The execution runner cross-references active registry `sourceUrl` against the loaded YAML config's `sources.filter(s => s.browserUseOnly)`. A source can have an active registry row AND be browser_use_only (e.g., if it was onboarded before the flag was set). The YAML config is always the runtime source of truth.

**`getAllActiveRegistryCrawlers` no-params query:** Unlike all other functions in `crawler-db.ts`, this query has no `$1` params. Pass only the SQL string to `pool.query()`. The Jest test assertion matches on a single-arg call.

**Story scope boundary:** Story 2.1 does NOT update `content.source.consecutive_failures`, does NOT insert to `content.article_raw`, and does NOT invoke browser-use fallback. Those are Stories 2.3 and 3.1 respectively. The `_processCrawledArticles` stub is the exact boundary marker.

**Smoke test update is required:** The two existing `runBrowserCrawlJob` tests MUST be updated (see section above). If skipped, they will produce console.error noise from `callExecute(undefined)` being called with the mis-shaped mock data.

---

### Previous Story Intelligence (Epic 1 Learnings)

From Story 1.6 (orchestrator, most relevant):
- `mockPoolQuery.mockResolvedValueOnce(...)` per call in order of execution ??set up BEFORE calling the function under test
- `jest.clearAllMocks()` in `beforeEach` ??prevents cross-test query mock contamination
- Export test-surface functions (`processSource`, now `runCrawlerExecution`) ??unexported internals stay private
- `new Pool({ connectionString: '...' })` in test body to trigger mock constructor and get a pool instance

From Story 1.7 (Python execute endpoint):
- `CrawledItem` field name `body` maps from Python schema field `"content"` ??this mapping happens inside `_parse_crawl_result` in Python. By the time the TypeScript receives the JSON response, the field is already named `body`.
- `published_at` (not `publishedAt`) in the response ??the Python response uses snake_case throughout.
- `canonical_url` falls back to `url` in `_parse_crawl_result` (CSS extraction has no canonical URL) ??Story 2.1's `CrawledItem` interface reflects what the Python actually sends.

---

## File List

- `packages/pipeline/src/db/crawler-db.ts` ??MODIFY: add `ActiveCrawlerRow` interface + `getAllActiveRegistryCrawlers(pool)`
- `packages/pipeline/src/db/__tests__/crawler-db.test.ts` ??MODIFY: add `getAllActiveRegistryCrawlers` import + 2 tests
- `packages/pipeline/src/jobs/browser-crawl.ts` ??MODIFY: add `CrawledItem`, `callExecute`, `runCrawlerExecution`, `_processCrawledArticles` stub; extend `runBrowserCrawlJob`
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` ??MODIFY: add `runCrawlerExecution` import + 5 new tests; update 2 existing smoke tests

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None ??clean implementation, no debugging required.

### Completion Notes List

- All 5 tasks and 15 subtasks implemented. 62/62 tests pass (all pre-existing + 7 new tests).
- `getAllActiveRegistryCrawlers` added to `crawler-db.ts` ??JOIN query with no runtime params; maps `registry_id`/`source_id`/`source_url` to `ActiveCrawlerRow`.
- `CrawledItem` interface uses snake_case (`published_at`, `canonical_url`) to match Python response shape directly ??no mapping needed.
- `callExecute` follows exact same pattern as `callGenerate`: `AbortSignal.timeout(35_000)`, throws on non-ok with error detail.
- `runCrawlerExecution` exported for testability; builds `browserUseOnlyUrls` Set from YAML config to filter sources at runtime.
- `_processCrawledArticles` is a no-op stub ??Stories 2.2 and 2.3 will fill it in. Underscore-prefixed params signal unused args to TypeScript.
- `runBrowserCrawlJob` extended with Phase 2 execution call after the Phase 1 onboarding loop.
- Existing smoke tests updated with `mockImplementation` that returns `{ rows: [] }` when SQL contains `source_url` (distinguishes `getAllActiveRegistryCrawlers` JOIN query from onboarding queries).
- Pre-existing TypeScript error in `source-config.test.ts` (Buffer type mismatch) is not a regression ??zero errors in any of the 4 modified files.

### Change Log

| Date | Change |
|------|--------|
| 2026-05-24 | Story created ??comprehensive developer guide for crawl4ai crawler execution runner |
| 2026-05-24 | Implementation complete ??all tasks done, 62 tests pass, status ??review |

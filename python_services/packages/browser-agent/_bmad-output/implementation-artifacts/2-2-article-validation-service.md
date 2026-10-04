# Story 2.2: Article Validation Service

**Status:** review
**Story ID:** 2.2
**Epic:** 2 ??Scheduled Crawling & Pipeline Integration
**Created:** 2026-05-24

---

## Tasks / Subtasks

- [x] Task 1: Add validation constants and export `validateArticle` (AC1, AC4)
  - [x] 1.1 Add `DEFAULT_MIN_BODY_LENGTH = 100` and `DEFAULT_RECENCY_WINDOW_DAYS = 1` constants after the Config section
  - [x] 1.2 Export `validateArticle(item: CrawledItem, source: SourceConfig | undefined): string[]` ??pure function, no DB calls, no side effects

- [x] Task 2: Implement `_processCrawledArticles` with validation logic (AC1, AC2, AC3)
  - [x] 2.1 Update function signature to add `pool: Pool` as first param (needed for Story 2.3's DB access)
  - [x] 2.2 Loop items: call `validateArticle`, log failures with `console.warn`, collect `validItems`
  - [x] 2.3 If `validItems.length === 0` and `items.length > 0` ??throw Error (triggers FULL_RUN_FAILURE catch in `runCrawlerExecution`)
  - [x] 2.4 If items was empty ??return without throw (Python returns 422 for zero items; this shouldn't occur but must not panic)
  - [x] 2.5 Call `await _insertValidatedArticles(pool, sourceId, validItems, source)` stub

- [x] Task 3: Add `_insertValidatedArticles` no-op stub (Story 2.3 extension point)
  - [x] 3.1 Add unexported `_insertValidatedArticles(pool: Pool, sourceId: string, items: CrawledItem[], source: SourceConfig | undefined): Promise<void>` as a no-op stub

- [x] Task 4: Update `runCrawlerExecution` call site (AC1)
  - [x] 4.1 Change call from `await _processCrawledArticles(crawler.sourceId, result.items, sourceConfig)` to `await _processCrawledArticles(pool, crawler.sourceId, result.items, sourceConfig)`

- [x] Task 5: Write Jest tests (AC1?“AC4)
  - [x] 5.1 Add `validateArticle` and `makeValidItem` helper to `browser-crawl.test.ts` imports/helpers
  - [x] 5.2 `validateArticle` unit tests: EMPTY_TITLE (empty string, whitespace-only)
  - [x] 5.3 `validateArticle` unit tests: SHORT_CONTENT (below default; below per-source threshold)
  - [x] 5.4 `validateArticle` unit tests: STALE_DATE (unparseable date; old date beyond 24h; accepted within per-source window)
  - [x] 5.5 `validateArticle` unit tests: MISSING_FIELD (empty url) and INVALID_URL (non-http url, malformed url)
  - [x] 5.6 `validateArticle` unit tests: valid article returns []; multiple errors returned together
  - [x] 5.7 Integration test (via `runCrawlerExecution`): mix of valid and invalid items ??valid pass, batch completes (AC3 partial pass)
  - [x] 5.8 Integration test: all invalid ??full-run failure signalled; second source in batch still processed (AC3 + AC4 resilience)
  - [x] 5.9 Update existing Story 2.1 `runCrawlerExecution` test that uses stale article data to use `makeValidItem()`

---

## User Story

As an engineer,
I want crawled articles to pass through a validation gate before entering the pipeline,
so that only well-formed, timely content reaches the database and downstream processes.

---

## Acceptance Criteria

**AC1 ??Validation checks:**
**Given** a crawled article from any source
**When** the validation service evaluates it
**Then** it checks: `title` is non-empty; `body` length is above the configured minimum threshold; `published_at` is parseable as a valid date and falls within the recency window (default: within 24h); `url` is present and a valid HTTP/HTTPS URL

**AC2 ??Failure logging and discard:**
**Given** an article that fails one or more validation checks
**When** it is processed
**Then** a structured log entry is written with the source name, article URL, and one or more of the error codes: `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL`
**And** the invalid article is discarded and not inserted into `content.article_raw`

**AC3 ??Partial pass / full-run failure:**
**Given** a crawl run that returns a mix of valid and invalid articles
**When** validation completes
**Then** valid articles pass through to the dedup/insert step (FR-5.3)
**And** only a run where zero articles pass validation is treated as a full-run failure (FR-5.3)

**AC4 ??Per-source threshold overrides:**
**Given** a source config entry with per-source overrides (`min_body_length`, `recency_window_days`)
**When** validation runs for that source
**Then** the per-source values are used instead of the package-level defaults (FR-5.4)

---

## Dev Notes

### File Structure

```
packages/pipeline/src/
  jobs/
    browser-crawl.ts          ??MODIFY: add constants, validateArticle, update _processCrawledArticles,
                                         add _insertValidatedArticles stub, update runCrawlerExecution call site
    __tests__/
      browser-crawl.test.ts   ??MODIFY: add validateArticle tests + integration tests; update stale test data
```

**Do NOT create new files** ??all changes extend existing files.

---

### Validation Constants ??`browser-crawl.ts`

Add in the `// ?€?€?€ Config ?€?€?€` section, after `getCrawlerApiUrl()`:

```typescript
const DEFAULT_MIN_BODY_LENGTH = 100
const DEFAULT_RECENCY_WINDOW_DAYS = 1
```

---

### `validateArticle` function ??`browser-crawl.ts`

Export this function so it can be unit-tested in isolation. Place it before `runCrawlerExecution`.

**Error code mapping:**
| Condition | Code |
|-----------|------|
| `title` is empty or whitespace-only | `EMPTY_TITLE` |
| `body.length < minBodyLength` | `SHORT_CONTENT` |
| `published_at` is unparseable OR outside recency window | `STALE_DATE` |
| `url` is absent/empty | `MISSING_FIELD` |
| `url` is present but not valid `http:`/`https:` URL | `INVALID_URL` |

```typescript
export function validateArticle(
  item: CrawledItem,
  source: SourceConfig | undefined,
): string[] {
  const errors: string[] = []

  const minBodyLength = source?.minBodyLength ?? DEFAULT_MIN_BODY_LENGTH
  const recencyWindowMs =
    (source?.recencyWindowDays ?? DEFAULT_RECENCY_WINDOW_DAYS) * 24 * 60 * 60 * 1000

  // EMPTY_TITLE
  if (!item.title || !item.title.trim()) {
    errors.push('EMPTY_TITLE')
  }

  // SHORT_CONTENT
  if (!item.body || item.body.length < minBodyLength) {
    errors.push('SHORT_CONTENT')
  }

  // STALE_DATE ??unparseable OR outside recency window
  if (!item.published_at) {
    errors.push('STALE_DATE')
  } else {
    const articleDate = new Date(item.published_at)
    if (isNaN(articleDate.getTime())) {
      errors.push('STALE_DATE')
    } else if (Date.now() - articleDate.getTime() > recencyWindowMs) {
      errors.push('STALE_DATE')
    }
  }

  // MISSING_FIELD / INVALID_URL ??url checks
  if (!item.url) {
    errors.push('MISSING_FIELD')
  } else {
    try {
      const parsed = new URL(item.url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('INVALID_URL')
      }
    } catch {
      errors.push('INVALID_URL')
    }
  }

  return errors
}
```

---

### Updated `_processCrawledArticles` ??`browser-crawl.ts`

Replace the current no-op stub entirely. The signature changes from `(_sourceId, _items, _source)` to `(pool, sourceId, items, source)` ??remove underscore prefixes since all params are now used (pool forwarded to Story 2.3 stub).

```typescript
async function _processCrawledArticles(
  pool: Pool,
  sourceId: string,
  items: CrawledItem[],
  source: SourceConfig | undefined,
): Promise<void> {
  const validItems: CrawledItem[] = []

  for (const item of items) {
    const errors = validateArticle(item, source)
    if (errors.length > 0) {
      console.warn(
        `[validation] source=${source?.sourceName ?? sourceId} url=${item.url || '(missing)'} codes=${errors.join(',')}`,
      )
    } else {
      validItems.push(item)
    }
  }

  if (items.length > 0 && validItems.length === 0) {
    throw new Error(
      `[validation] FULL_RUN_FAILURE: 0/${items.length} articles passed validation for source=${source?.sourceName ?? sourceId}`,
    )
  }

  // Story 2.3 fills this in: dedup + article_raw insert + consecutive_failures update
  await _insertValidatedArticles(pool, sourceId, validItems, source)
}
```

---

### `_insertValidatedArticles` stub ??`browser-crawl.ts`

Add immediately after `_processCrawledArticles`. Not exported.

```typescript
// Extension point: Story 2.3 adds dedup + content.article_raw insert + consecutive_failures update
async function _insertValidatedArticles(
  _pool: Pool,
  _sourceId: string,
  _items: CrawledItem[],
  _source: SourceConfig | undefined,
): Promise<void> {
  // stub ??replaced by Story 2.3
}
```

---

### Updated `runCrawlerExecution` call site ??`browser-crawl.ts`

Change one line inside the `try` block:

```typescript
// BEFORE (Story 2.1):
await _processCrawledArticles(crawler.sourceId, result.items, sourceConfig)

// AFTER (Story 2.2):
await _processCrawledArticles(pool, crawler.sourceId, result.items, sourceConfig)
```

No other changes to `runCrawlerExecution`.

---

### Testing ??`browser-crawl.test.ts`

#### New `makeValidItem` helper (add to Test Data Helpers section)

```typescript
function makeValidItem(overrides: Partial<CrawledItem> = {}): CrawledItem {
  return {
    title: 'Test Article Title',
    body: 'A'.repeat(150),                      // 150 chars > DEFAULT_MIN_BODY_LENGTH (100)
    published_at: new Date().toISOString(),       // now = within 24h recency window
    author: 'Test Author',
    url: 'https://example.com/article-valid',
    canonical_url: 'https://example.com/article-valid',
    ...overrides,
  }
}
```

#### Add `validateArticle` to import

```typescript
import { processSource, runBrowserCrawlJob, runCrawlerExecution, validateArticle } from '../browser-crawl'
```

#### New `describe('validateArticle', ...)` block

```typescript
describe('validateArticle', () => {
  const noSource = undefined

  it('returns [] for a fully valid article', () => {
    expect(validateArticle(makeValidItem(), noSource)).toEqual([])
  })

  it('returns EMPTY_TITLE for empty title', () => {
    expect(validateArticle(makeValidItem({ title: '' }), noSource)).toContain('EMPTY_TITLE')
  })

  it('returns EMPTY_TITLE for whitespace-only title', () => {
    expect(validateArticle(makeValidItem({ title: '   ' }), noSource)).toContain('EMPTY_TITLE')
  })

  it('returns SHORT_CONTENT for body below default threshold (100 chars)', () => {
    expect(validateArticle(makeValidItem({ body: 'short' }), noSource)).toContain('SHORT_CONTENT')
  })

  it('returns SHORT_CONTENT for body below per-source threshold', () => {
    const source = makeSource({ minBodyLength: 500 })
    const item = makeValidItem({ body: 'A'.repeat(300) })  // 300 < 500
    expect(validateArticle(item, source)).toContain('SHORT_CONTENT')
  })

  it('does NOT return SHORT_CONTENT when body meets per-source threshold', () => {
    const source = makeSource({ minBodyLength: 50 })
    const item = makeValidItem({ body: 'A'.repeat(60) })  // 60 > 50
    expect(validateArticle(item, source)).not.toContain('SHORT_CONTENT')
  })

  it('returns STALE_DATE for unparseable published_at', () => {
    expect(validateArticle(makeValidItem({ published_at: 'not-a-date' }), noSource)).toContain('STALE_DATE')
  })

  it('returns STALE_DATE for article older than 24h (default window)', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(validateArticle(makeValidItem({ published_at: twoDaysAgo }), noSource)).toContain('STALE_DATE')
  })

  it('does NOT return STALE_DATE when article is within per-source recency window', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const source = makeSource({ recencyWindowDays: 7 })
    expect(validateArticle(makeValidItem({ published_at: threeDaysAgo }), source)).not.toContain('STALE_DATE')
  })

  it('returns STALE_DATE for article outside per-source recency window', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const source = makeSource({ recencyWindowDays: 7 })
    expect(validateArticle(makeValidItem({ published_at: tenDaysAgo }), source)).toContain('STALE_DATE')
  })

  it('returns MISSING_FIELD for empty url', () => {
    expect(validateArticle(makeValidItem({ url: '' }), noSource)).toContain('MISSING_FIELD')
  })

  it('returns INVALID_URL for non-http protocol url', () => {
    expect(validateArticle(makeValidItem({ url: 'ftp://example.com/file' }), noSource)).toContain('INVALID_URL')
  })

  it('returns INVALID_URL for malformed url', () => {
    expect(validateArticle(makeValidItem({ url: 'not-a-url' }), noSource)).toContain('INVALID_URL')
  })

  it('accepts https:// url', () => {
    expect(validateArticle(makeValidItem({ url: 'https://secure.example.com/article' }), noSource)).not.toContain('INVALID_URL')
  })

  it('returns multiple errors for article with multiple failures', () => {
    const item = makeValidItem({ title: '', url: 'not-a-url' })
    const errors = validateArticle(item, noSource)
    expect(errors).toContain('EMPTY_TITLE')
    expect(errors).toContain('INVALID_URL')
  })
})
```

#### New validation integration tests in `describe('runCrawlerExecution', ...)`

Add inside the existing `describe('runCrawlerExecution', ...)` block:

```typescript
describe('AC2, AC3 ??validation integration', () => {
  it('valid articles pass through without error', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
  })

  it('partial pass: some invalid articles discarded, valid continue, no full-run failure', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({
      source_id: 'src-1',
      items: [
        makeValidItem(),                          // valid ??passes through
        makeValidItem({ body: 'too short' }),     // SHORT_CONTENT ??discarded
      ],
    })

    // No throw ??at least one valid article means no full-run failure
    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
  })

  it('all invalid: full-run failure signalled for source, batch continues to next source', async () => {
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

    // source1: all items fail validation ??full-run failure (caught by runCrawlerExecution)
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ body: 'short' })] })
    // source2: valid ??ok
    mockFetchJson({ source_id: 'src-2', items: [makeValidItem()] })

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(2)  // both sources attempted
  })

  it('per-source minBodyLength applied: article below custom threshold fails', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://example.com', sourceName: 'Example', minBodyLength: 500 }),
    ]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    // body is 150 chars ??passes default (100) but fails per-source (500)
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ body: 'A'.repeat(150) })] })

    // All items fail ??full-run failure thrown internally, caught by runCrawlerExecution
    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
  })
})
```

#### Update Existing Story 2.1 Tests with Stale Data

The test `'calls /crawler/execute with correct source_id from active registry'` uses:
```typescript
items: [{ title: 'T', body: 'B', published_at: '2026-01-01', ... }]
```

After Story 2.2, `body: 'B'` fails SHORT_CONTENT and `'2026-01-01'` fails STALE_DATE. The test still passes (fetch assertion is unaffected; the throw is caught internally), but it emits console.warn/error noise.

**Update this test to use `makeValidItem()`:**

```typescript
// BEFORE:
mockFetchJson({ source_id: 'src-abc', items: [{ title: 'T', body: 'B', published_at: '2026-01-01', author: 'A', url: 'https://x.com/1', canonical_url: 'https://x.com/1' }] })

// AFTER:
mockFetchJson({ source_id: 'src-abc', items: [makeValidItem({ url: 'https://x.com/1', canonical_url: 'https://x.com/1' })] })
```

---

### Architecture Compliance Checklist

- [x] `validateArticle` is exported ??required for unit testability (pure function pattern)
- [x] `_insertValidatedArticles` is NOT exported ??internal stub (same convention as `_processCrawledArticles` in Story 2.1)
- [x] `_processCrawledArticles` signature updated to include `pool: Pool` first param ??Story 2.3 needs it for DB access
- [x] `runCrawlerExecution` call site updated to pass `pool` as first arg to `_processCrawledArticles`
- [x] Full-run failure throws from `_processCrawledArticles` ??caught by existing try/catch in `runCrawlerExecution` (logs `FULL_RUN_FAILURE`)
- [x] No DB queries in Story 2.2 ??`_processCrawledArticles` and `validateArticle` are pure validation logic only
- [x] No new files ??all changes additive to existing files
- [x] Error codes are exact strings: `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL`
- [x] URL validation restricts to `http:` and `https:` protocols (not just URL parseability)
- [x] Per-source thresholds via `source?.minBodyLength ?? DEFAULT_MIN_BODY_LENGTH` and `source?.recencyWindowDays ?? DEFAULT_RECENCY_WINDOW_DAYS`

---

### Critical Constraints

**`_processCrawledArticles` signature change:** The Story 2.1 stub used underscore-prefixed params `(_sourceId, _items, _source)`. Story 2.2 changes the signature to `(pool, sourceId, items, source)`. Since this function is NOT exported, only the `runCrawlerExecution` call site needs updating (Task 4). No test changes needed for this signature change.

**`pool` in `_processCrawledArticles`:** Story 2.2 does not use `pool` in `_processCrawledArticles` logic yet. It is added NOW so Story 2.3 can use it without a further signature change. Pass `pool` through to `_insertValidatedArticles`.

**STALE_DATE covers both parse failure and recency:** Both "can't parse date" and "date is too old" map to the single `STALE_DATE` error code. Do not introduce a separate `INVALID_DATE` code ??the epics define exactly 5 error codes.

**Empty items array:** If Python sends 0 items, the endpoint itself returns 422 (Story 1.7 AC), so `callExecute` throws before `_processCrawledArticles` is called. The `items.length === 0` guard in `_processCrawledArticles` is a defensive safety net only ??do not throw on empty items (it is not a full-run validation failure).

**Existing Story 2.1 tests:** Only the test `'calls /crawler/execute with correct source_id from active registry'` needs a data update. The other runCrawlerExecution tests pass `items: []` which is unaffected by validation logic (empty items ??empty validItems ??no throw condition).

**Story scope boundary:** Story 2.2 does NOT write to `content.article_raw`. Does NOT update `content.source.consecutive_failures`. Does NOT call any DB function. The `_insertValidatedArticles` stub is the exact Story 2.3 boundary marker.

---

### Previous Story Intelligence (Story 2.1 Learnings)

- Export test-surface functions; do NOT export internal stubs (`_processCrawledArticles`, `_insertValidatedArticles`)
- `mockPoolQuery.mockResolvedValueOnce(...)` per call in execution order ??set up BEFORE calling the function under test
- `jest.clearAllMocks()` in `beforeEach` prevents cross-test mock contamination
- `new Pool({ connectionString: '...' })` in test body triggers the mock constructor
- The `runCrawlerExecution` error catch is silent from test perspective ??a throw inside `_processCrawledArticles` does NOT fail the test or reject the `runCrawlerExecution` promise

---

## File List

- `packages/pipeline/src/jobs/browser-crawl.ts` ??MODIFIED: added `DEFAULT_MIN_BODY_LENGTH`, `DEFAULT_RECENCY_WINDOW_DAYS` constants; added exported `validateArticle` function; replaced `_processCrawledArticles` stub with validation implementation; added `_insertValidatedArticles` no-op stub; updated `runCrawlerExecution` call site to pass `pool`
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` ??MODIFIED: added `validateArticle` + `CrawledItem` imports; added `makeValidItem` helper; added 18 `validateArticle` unit tests; added 5 integration tests via `runCrawlerExecution`; updated stale test data in 1 existing test

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None ??clean implementation, no debugging required.

### Completion Notes List

- All 5 tasks and 9 subtasks implemented. 83/83 tests pass across all 4 test suites (21 new tests added).
- `validateArticle` exported as pure function: checks EMPTY_TITLE, SHORT_CONTENT, STALE_DATE (covers both parse failure and recency), MISSING_FIELD, INVALID_URL. URL validation restricts to http:/https: protocols.
- `_processCrawledArticles` signature updated: `(pool, sourceId, items, source)` ??pool forwarded for Story 2.3. Logs per-article failures with `console.warn`. Throws on zero valid items when input non-empty (signals FULL_RUN_FAILURE to existing catch in `runCrawlerExecution`).
- `_insertValidatedArticles` no-op stub added ??Story 2.3 extension point, not exported.
- `runCrawlerExecution` call site updated to pass `pool` as first arg.
- `DEFAULT_MIN_BODY_LENGTH = 100`, `DEFAULT_RECENCY_WINDOW_DAYS = 1` constants defined.
- Per-source overrides applied via `source?.minBodyLength ?? DEFAULT` and `source?.recencyWindowDays ?? DEFAULT`.
- Stale test data in existing Story 2.1 `runCrawlerExecution` test updated to use `makeValidItem()`.
- No new files created ??all changes additive to existing files.

### Change Log

| Date | Change |
|------|--------|
| 2026-05-24 | Story created ??comprehensive developer guide for article validation service |
| 2026-05-24 | Implementation complete ??all tasks done, 83/83 tests pass, status ??review |

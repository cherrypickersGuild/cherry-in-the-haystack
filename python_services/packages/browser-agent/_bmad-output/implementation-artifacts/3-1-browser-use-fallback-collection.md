# Story 3.1: browser-use Fallback Collection

**Status:** review
**Story ID:** 3.1
**Epic:** 3 ??Fallback Collection & Self-Healing
**Created:** 2026-05-25

---

## Tasks / Subtasks

- [x] Task 1: DB migration ??add CRAWLER_FALLBACK enum value
  - [x] 1.1 Create `db/migrations/20260525000001_add_crawler_fallback_enum.sql`
  - [x] 1.2 Add `ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_FALLBACK'`

- [x] Task 2: Python model ??add FallbackRequest to `python_services/api/models/crawler.py`
  - [x] 2.1 Add `FallbackRequest(source_id: UUID, url: str)` Pydantic model

- [x] Task 3: Python prompt ??create `python_services/api/prompts/crawler_fallback.py`
  - [x] 3.1 Write `CRAWLER_FALLBACK_PROMPT` template (see Dev Notes for content)
  - [x] 3.2 Add `FALLBACK_PROMPT_NAME` and `FALLBACK_PROMPT_VERSION` constants

- [x] Task 4: Python endpoint ??add `POST /crawler/fallback` to `python_services/api/routers/crawler.py`
  - [x] 4.1 Add `FallbackRequest` to model imports
  - [x] 4.2 Add `_FALLBACK_TIMEOUT: float = 60.0`
  - [x] 4.3 Implement `@router.post("/fallback")` endpoint following execute pattern
  - [x] 4.4 Implement `_do_fallback(source_id, url, browser_config)` internal helper
  - [x] 4.5 Implement `_parse_fallback_result(raw_output)` JSON parser for browser-use output

- [x] Task 5: Python test ??create `python_services/api/routers/tests/test_crawler_fallback.py`
  - [x] 5.1 Success path: returns 200 with source_id and items array
  - [x] 5.2 run_log written with CRAWLER_FALLBACK kind on success and failure
  - [x] 5.3 Timeout ??422 TIMEOUT + run_log FAILED
  - [x] 5.4 Browser-use failure ??422 + run_log FAILED
  - [x] 5.5 Empty result ??200 with `items: []` (NOT a 422 ??empty page is not an error)
  - [x] 5.6 Response shape: `source_id` + `items` with 6-field objects

- [x] Task 6: TypeScript ??`packages/pipeline/src/jobs/browser-crawl.ts` new functions
  - [x] 6.1 Add `callFallback(sourceId, url)` HTTP helper
  - [x] 6.2 Add `_runFallbackForSource(pool, sourceId, source, triggerCode)` orchestration
  - [x] 6.3 Add `_processFallbackArticles(pool, sourceId, items, source)` ??validate only, no registry reset
  - [x] 6.4 Add `_insertFallbackArticles(pool, sourceId, items)` ??dedup + insert + `resetSourceStats` only

- [x] Task 7: TypeScript ??modify `runCrawlerExecution()` in `browser-crawl.ts`
  - [x] 7.1 Add browser_use_only loop BEFORE `getAllActiveRegistryCrawlers` call
  - [x] 7.2 Remove `incrementSourceConsecutiveFailures` from crawl4ai catch block (moved to `_runFallbackForSource`)
  - [x] 7.3 Add `_runFallbackForSource()` call at end of crawl4ai catch block
  - [x] 7.4 Pass `sourceConfig` (with URL) to `_runFallbackForSource` ??it requires `SourceConfig.url`

- [x] Task 8: TypeScript ??update `browser-crawl.test.ts` (existing tests + new tests)
  - [x] 8.1 Update "skips browser_use_only" test ??LinkedIn now calls fallback
  - [x] 8.2 Update all crawl4ai failure-path tests ??now include fetch mock for fallback
  - [x] 8.3 Update all-invalid validation failure tests ??fallback now triggered
  - [x] 8.4 Add `describe('Story 3.1 ??browser_use_only fallback path')` test block
  - [x] 8.5 Add `describe('Story 3.1 ??crawl4ai failure triggers fallback')` test block
  - [x] 8.6 Add `describe('Story 3.1 ??fallback article processing')` test block

---

## User Story

As an engineer,
I want the system to collect articles via browser-use vision when a crawl4ai crawler produces zero valid articles, and to run browser-use on every cycle for `browser_use_only` sources,
so that LinkedIn and other browser_use_only sources are always collected, and no data is lost when a crawl4ai crawler breaks.

---

## Acceptance Criteria

**AC1 ??crawl4ai failure triggers browser-use fallback:**
**Given** a crawl4ai crawler run (`POST /crawler/execute`) that results in a full-run failure (zero valid articles)
**When** the fallback logic evaluates the result
**Then** browser-use is invoked for that source via `POST /crawler/fallback` to visually read the page and extract content
**And** the extracted content is structured into the `content.article_raw` schema fields: `title`, `body`, `published_at`, `author`, `url`

**AC2 ??browser_use_only sources always use fallback:**
**Given** a source configured with `browser_use_only: true` (including LinkedIn)
**When** the daily scheduler runs
**Then** browser-use is invoked directly for that source on every cycle without attempting Playwright execution (FR-6.1, FR-6.5)

**AC3 ??fallback output through standard pipeline:**
**Given** fallback browser-use collection succeeds
**When** the output is processed
**Then** it passes through the same validation (Story 2.2 `validateArticle`) ??dedup ??insert (`content.article_raw`) flow as a normal Playwright crawl (FR-6.3)

**AC4 ??fallback event logging:**
**Given** any fallback invocation (success or failure)
**When** the run completes
**Then** a structured log entry is written containing: source name, timestamp, triggering error code (or `BROWSER_USE_ONLY` marker), and whether collection succeeded (FR-6.4)

**AC5 ??Threads treated like any non-browser_use_only source:**
**Given** a Threads source that fails crawl4ai execution validation
**When** fallback runs
**Then** it is treated identically to any other non-browser_use_only source ??fallback fires, and the crawl4ai failure counter increments (FR-6.6)

**AC6 ??fallback failure tracking:**
**Given** fallback collection itself fails (browser-use returns error or 422)
**When** the run completes
**Then** the failure is logged with the source name and error detail
**And** `content.source.consecutive_failures` is incremented (via `incrementSourceConsecutiveFailures`)

---

## Dev Notes

### ?�� CRITICAL: Counter Ownership Change in Task 7.2

Story 2.3 put `incrementSourceConsecutiveFailures` in the crawl4ai catch block alongside `incrementConsecutiveFailures`. Story 3.1 moves it to the fallback failure path. This is a semantic fix:

- **Before (Story 2.3)**: crawl4ai failure always increments `content.source.consecutive_failures`
- **After (Story 3.1)**: `content.source.consecutive_failures` only increments when ALL collection methods fail (crawl4ai AND fallback both fail)

**New catch block in `runCrawlerExecution`:**
```typescript
} catch (err) {
  console.error(`[crawler-exec] FULL_RUN_FAILURE source=${crawler.sourceUrl}:`, err)
  try {
    await incrementConsecutiveFailures(pool, crawler.sourceId)  // crawler_registry ONLY
    // incrementSourceConsecutiveFailures removed ??now owned by _runFallbackForSource
  } catch (dbErr) {
    console.error(`[crawler-exec] failed to update consecutive_failures for source=${crawler.sourceUrl}:`, dbErr)
  }
  // Fallback: browser-use collection when crawl4ai fails (FR-6.1)
  const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
  if (sourceConfig) {
    const triggerCode = (err as Error).message.split('\n')[0] ?? 'FULL_RUN_FAILURE'
    await _runFallbackForSource(pool, crawler.sourceId, sourceConfig, triggerCode)
  }
}
```

---

### New Function: `callFallback()` (Task 6.1)

Add alongside `callExecute()`. Takes `sourceId` AND `url` explicitly because:
- browser_use_only sources (LinkedIn) may not have a crawler_registry entry to look up the URL from
- crawl4ai-failure sources: URL is already available via `SourceConfig.url`
- Python side uses the URL directly (no DB join needed for fallback)

```typescript
async function callFallback(
  sourceId: string,
  url: string,
): Promise<{ source_id: string; items: CrawledItem[] }> {
  const res = await fetch(`${getCrawlerApiUrl()}/crawler/fallback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, url }),
    signal: AbortSignal.timeout(65_000),  // 60s Python timeout + 5s buffer
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/fallback failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<{ source_id: string; items: CrawledItem[] }>
}
```

---

### New Function: `_runFallbackForSource()` (Task 6.2)

Structured fallback log + conditional `incrementSourceConsecutiveFailures`:

```typescript
async function _runFallbackForSource(
  pool: Pool,
  sourceId: string,
  source: SourceConfig,
  triggerCode: string,
): Promise<void> {
  const startTs = new Date().toISOString()
  console.log(
    `[fallback] START source=${source.sourceName} trigger=${triggerCode} timestamp=${startTs}`,
  )
  try {
    const result = await callFallback(sourceId, source.url)
    await _processFallbackArticles(pool, sourceId, result.items, source)
    console.log(
      `[fallback] SUCCESS source=${source.sourceName} timestamp=${new Date().toISOString()} items=${result.items.length}`,
    )
  } catch (err) {
    console.error(
      `[fallback] FAILED source=${source.sourceName} timestamp=${new Date().toISOString()} error:`,
      err,
    )
    try {
      await incrementSourceConsecutiveFailures(pool, sourceId)
    } catch (dbErr) {
      console.error(
        `[fallback] failed to update consecutive_failures for source=${source.sourceName}:`,
        dbErr,
      )
    }
  }
}
```

**Wrap each browser_use_only source iteration in its own try/catch** (same pattern as `processSource` in `runBrowserCrawlJob`) so one source failing doesn't halt the batch.

---

### New Function: `_processFallbackArticles()` (Task 6.3)

Nearly identical to `_processCrawledArticles` but calls `_insertFallbackArticles` (not `_insertValidatedArticles`):

```typescript
async function _processFallbackArticles(
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
        `[fallback-validation] source=${source?.sourceName ?? sourceId} url=${item.url || '(missing)'} codes=${errors.join(',')}`,
      )
    } else {
      validItems.push(item)
    }
  }
  if (items.length > 0 && validItems.length === 0) {
    throw new Error(
      `[fallback-validation] FULL_RUN_FAILURE: 0/${items.length} articles passed validation for source=${source?.sourceName ?? sourceId}`,
    )
  }
  await _insertFallbackArticles(pool, sourceId, validItems, source)
}
```

---

### New Function: `_insertFallbackArticles()` (Task 6.4)

Identical to `_insertValidatedArticles` EXCEPT:
- Calls `resetSourceStats` (resets `content.source.consecutive_failures`)
- Does **NOT** call `resetConsecutiveFailures` (leaves `crawler_registry.consecutive_failures` intact for Story 3.2)

```typescript
async function _insertFallbackArticles(
  pool: Pool,
  sourceId: string,
  items: CrawledItem[],
  _source: SourceConfig | undefined,
): Promise<void> {
  if (items.length === 0) return

  const representativeKeys = items.map(buildRepresentativeKey)
  const existingKeys = await getExistingRepresentativeKeys(pool, representativeKeys)
  const newItems = items.filter((item) => !existingKeys.has(buildRepresentativeKey(item)))

  console.log(
    `[fallback-insert] source=${sourceId} new=${newItems.length} skipped_dup=${existingKeys.size}`,
  )

  if (newItems.length > 0) {
    const toInsert: ArticleRawInsert[] = newItems.map((item) => ({
      title: item.title,
      content_raw: item.body,
      published_at: item.published_at,
      author: item.author,
      url: item.url,
      canonical_url: item.canonical_url,
      representative_key: buildRepresentativeKey(item),
      content_hash: sha256AsBuffer(item.body),
    }))
    await insertArticlesRaw(pool, sourceId, toInsert)
  }

  await resetSourceStats(pool, sourceId)  // reset content.source stats on fallback success
  // NOTE: resetConsecutiveFailures (crawler_registry) intentionally omitted ??  // crawler_registry.consecutive_failures tracks crawl4ai failures only (Story 3.2 concern)
}
```

---

### Modified `runCrawlerExecution()` structure (Task 7)

```typescript
export async function runCrawlerExecution(
  pool: Pool,
  sources: SourceConfig[],
): Promise<void> {
  // PHASE A: browser_use_only sources ??fallback on every cycle (FR-6.1, FR-6.5)
  for (const source of sources.filter((s) => s.browserUseOnly)) {
    try {
      const sourceId = await resolveSourceId(pool, source)  // upserts if needed
      await _runFallbackForSource(pool, sourceId, source, 'BROWSER_USE_ONLY')
    } catch (err) {
      console.error(`[fallback] error resolving source for ${source.sourceName}:`, err)
    }
  }

  // PHASE B: active crawl4ai crawlers
  const browserUseOnlyUrls = new Set(
    sources.filter((s) => s.browserUseOnly).map((s) => s.url),
  )
  const activeCrawlers = await getAllActiveRegistryCrawlers(pool)

  for (const crawler of activeCrawlers) {
    if (browserUseOnlyUrls.has(crawler.sourceUrl)) {
      console.log(`[crawler-exec] skip browser_use_only: ${crawler.sourceUrl}`)
      continue
    }

    try {
      const result = await callExecute(crawler.sourceId)
      console.log(`[crawler-exec] source=${crawler.sourceUrl} items=${result.items.length}`)
      const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
      await _processCrawledArticles(pool, crawler.sourceId, result.items, sourceConfig)
    } catch (err) {
      console.error(`[crawler-exec] FULL_RUN_FAILURE source=${crawler.sourceUrl}:`, err)
      try {
        await incrementConsecutiveFailures(pool, crawler.sourceId)  // crawler_registry only
      } catch (dbErr) {
        console.error(`[crawler-exec] failed to update consecutive_failures:`, dbErr)
      }
      const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
      if (sourceConfig) {
        const triggerCode = (err as Error).message.split('\n')[0] ?? 'FULL_RUN_FAILURE'
        await _runFallbackForSource(pool, crawler.sourceId, sourceConfig, triggerCode)
      }
    }
  }
}
```

**Key ordering**: PHASE A (browser_use_only) runs BEFORE `getAllActiveRegistryCrawlers`. Tests must mock DB calls in this order.

**`sourceConfig` for fallback**: `sources.find((s) => s.url === crawler.sourceUrl)` can return `undefined` if the source was removed from the YAML config. Always guard with `if (sourceConfig)` before calling `_runFallbackForSource`.

---

### Python: `POST /crawler/fallback` (Task 4)

Follows the same structure as `POST /crawler/execute`. Key differences:
- Takes `url` directly (no DB lookup needed)
- Uses browser-use Agent (not crawl4ai) ??deferred import pattern
- Timeout: 60s (browser-use is slow)
- Returns `items: []` on empty page (NOT 422) ??empty is valid
- run_kind: `CRAWLER_FALLBACK`

**Pydantic model** (add to `models/crawler.py`):
```python
class FallbackRequest(BaseModel):
    source_id: UUID
    url: str
```

**Endpoint skeleton** (add to `routers/crawler.py`):
```python
_FALLBACK_TIMEOUT: float = 60.0

@router.post("/fallback")
async def fallback_crawler(req: FallbackRequest, request: Request) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_FALLBACK", status="running")
    try:
        items = await asyncio.wait_for(
            _do_fallback(req.source_id, req.url, request.app.state.browser_config),
            timeout=_FALLBACK_TIMEOUT,
        )
        await db.update_run_log(run_log_id, status="COMPLETED")
        return JSONResponse(content={
            "source_id": str(req.source_id),
            "items": items,
        })
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "TIMEOUT", "detail": "Fallback exceeded 60-second time limit"},
        )
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )
```

**`_do_fallback()` internal helper**:
```python
async def _do_fallback(source_id: UUID, url: str, browser_config) -> list[dict]:
    """Use browser-use Agent to visually extract articles from the page."""
    from browser_use import Agent  # deferred import
    from langchain_anthropic import ChatAnthropic

    llm = ChatAnthropic(
        model=_llm_model_name(),
        api_key=os.environ["ANTHROPIC_API_KEY"],
    )
    agent = Agent(
        task=CRAWLER_FALLBACK_PROMPT.format(url=url),
        llm=llm,
    )
    history = await agent.run()
    raw_output: str | None = history.final_result()
    if not raw_output:
        return []  # Empty page is not an error ??return []
    return _parse_fallback_result(raw_output)
```

**`_parse_fallback_result()` parser**:
```python
def _parse_fallback_result(raw_output: str) -> list[dict]:
    """
    Parse browser-use agent output as a JSON array of article items.
    Maps raw fields to the 6-field CrawledItem shape.
    Returns [] if parsing fails (graceful degradation).
    """
    text = raw_output.strip()
    # Strip markdown fences
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end > start:
            text = text[start:end + 1]
        else:
            return []
    try:
        raw_items = json.loads(text)
    except json.JSONDecodeError:
        return []
    return [
        {
            "title": str(item.get("title", "")),
            "body": str(item.get("body", "")),
            "published_at": str(item.get("published_at", "")),
            "author": str(item.get("author", "")),
            "url": str(item.get("url", "")),
            "canonical_url": str(item.get("canonical_url", item.get("url", ""))),
        }
        for item in raw_items
        if isinstance(item, dict)
    ]
```

---

### Python: `CRAWLER_FALLBACK_PROMPT` (Task 3)

Create `python_services/api/prompts/crawler_fallback.py`:

```python
FALLBACK_PROMPT_NAME = "crawler_fallback_v1"
FALLBACK_PROMPT_VERSION = "1.0"

CRAWLER_FALLBACK_PROMPT = """
Navigate to {url} and extract all visible article or post content from the page.

For each article, post, or item visible on the page, extract these fields:
- title: the article headline or title text
- body: the main body text content (extract as much as available)
- published_at: the publication date/time (ISO 8601 format if possible, e.g. "2026-05-25T10:00:00")
- author: the author name (empty string if not shown)
- url: the direct URL to the article (use the page URL if individual URLs are not shown)
- canonical_url: same as url if no separate canonical is shown

Return ONLY a JSON array with no other text:
[
  {
    "title": "Article headline",
    "body": "Article body text...",
    "published_at": "2026-05-25T10:00:00",
    "author": "Author Name",
    "url": "https://example.com/article",
    "canonical_url": "https://example.com/article"
  }
]

If no articles are found, return an empty array: []
""".strip()
```

**Import in `routers/crawler.py`**:
```python
from ..prompts.crawler_fallback import CRAWLER_FALLBACK_PROMPT
```

---

### ?�� CRITICAL: Test Impact Analysis (Task 8)

#### Tests that BREAK and need updating

**Test 1: `runCrawlerExecution describe('AC1, AC2') ??"skips browser_use_only"`**

Current test has LinkedIn (`browserUseOnly: true`) in `activeCrawlers` (via `mockPoolQuery` for `getAllActiveRegistryCrawlers`). After Story 3.1:
- LinkedIn is processed FIRST in the browser_use_only loop (Phase A) via `resolveSourceId` + `callFallback`
- It still appears in `activeCrawlers` (data inconsistency guard), but is skipped in Phase B

**Updated mock order for this test:**
```typescript
// Phase A: LinkedIn browser_use_only
mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-2' }] })  // getSourceByUrl (LinkedIn)
mockFetchJson({ source_id: 'src-2', items: [] })                   // callFallback (LinkedIn)
// fallback with 0 items ??_processFallbackArticles: 0 items ??returns immediately (no DB calls)

// Phase B:
mockPoolQuery.mockResolvedValueOnce({                               // getAllActiveRegistryCrawlers
  rows: [
    { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://techcrunch.com/blog' },
    { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://www.linkedin.com/feed' },
  ],
})
mockFetchJson({ source_id: 'src-1', items: [] })                   // callExecute (TechCrunch)
// TechCrunch: 0 items ??_processCrawledArticles: 0 > 0 is false ??_insertValidatedArticles([], ...) ??returns
```

Assertion changes:
- `expect(mockFetch).toHaveBeenCalledTimes(2)` ??was 1, now 2 (LinkedIn fallback + TechCrunch execute)
- `expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/crawler/fallback', ...)` ??new assertion
- `expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/crawler/execute', ...)` ??unchanged

**Test 2: `runCrawlerExecution describe('AC4 batch resilience') ??"continues when /crawler/execute returns 422"`**

Current mock sequence (2 sources, source1 fails, source2 succeeds):
```
mockPoolQuery × 1: getAllActiveRegistryCrawlers
mockFetch × 1: source1 fails (422)
mockFetch × 1: source2 succeeds
mockPoolQuery × 1: incrementConsecutiveFailures (for source1 catch)
```

After Story 3.1 (sources have no `browserUseOnly: true`, so Phase A is empty):
```
// Phase A: no browser_use_only sources ??no DB/fetch calls
mockPoolQuery × 1: getAllActiveRegistryCrawlers
mockFetch × 1: source1 fails (422) ??catch block
mockPoolQuery × 1: incrementConsecutiveFailures (crawler_registry, source1)  [still 1 call]
mockFetch × 1: callFallback for source1 ??fails (mock as 422 or success)
  IF fails: mockPoolQuery × 1: incrementSourceConsecutiveFailures (source1 content.source)
  IF succeeds with items: more DB mocks needed
mockFetch × 1: source2 succeeds (unchanged)
```

Simplest fix: mock fallback for source1 as 422 failure:
```typescript
mockFetchJson({ error: 'TIMEOUT', detail: 'exceeded 60s' }, false)  // source1 execute: 422
mockPoolQuery.mockResolvedValueOnce({ rows: [] })                     // incrementConsecutiveFailures (crawler_registry)
mockFetchJson({ error: 'BROWSER_USE_FAILED', detail: '...' }, false) // source1 fallback: 422
mockPoolQuery.mockResolvedValueOnce({ rows: [] })                     // incrementSourceConsecutiveFailures (content.source)
mockFetchJson({ source_id: 'src-2', items: [] })                     // source2 execute: success
```

**Test 3: `runCrawlerExecution describe('AC4') ??"continues when fetch throws a network error"`**

Same pattern as Test 2 ??add fallback mock after network error catch.

**Test 4: `validation integration describe('AC3 all invalid') ??"all-invalid signal full-run failure"`**

This test has 2 sources: source1 (all-invalid ??validation failure ??catch), source2 (valid).

After Story 3.1 with source1 failing validation:
- catch block: `incrementConsecutiveFailures` (crawler_registry)
- Then `_runFallbackForSource` for source1
- Need mock for `callFallback` for source1

Add before source2 processing:
```typescript
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementConsecutiveFailures (src-1, crawler_registry)
mockFetchJson({ source_id: 'src-1', items: [] }, false)  // callFallback src-1 fails ??422
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (src-1, content.source)
// then source2 processing mocks (unchanged)
```

**Test 5: `validation integration describe('AC4') ??"article below custom minBodyLength"`**

Source1 fails validation ??catch ??fallback. Add fallback mock:
```typescript
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementConsecutiveFailures (crawler_registry) ??was x1
// ADD: fallback mock
mockFetchJson({ source_id: 'src-1', items: [] }, false)  // callFallback fails
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source) ??moved from catch
```

**Test 6: `Story 2.3 describe ??"consecutive_failures" ??"increments when execute returns 422"`**

Currently expects 2 `consecutive_failures + 1` pool calls. After Story 3.1:
- catch block: 1 call (crawler_registry only)
- fallback: needs fetch mock, if fails ??1 call (content.source)
```typescript
mockFetchJson({ error: 'TIMEOUT', detail: 'exceeded 30s' }, false)  // crawl4ai execute fails
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementConsecutiveFailures (crawler_registry)
// ADD:
mockFetchJson({ error: 'BROWSER_USE_FAILED', detail: '...' }, false)  // callFallback fails
mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source)
```

**Test 7: `Story 2.3 ??"increments when all articles fail validation"`**

Same pattern as Test 6: add fallback fetch mock.

**Test 8: `Story 2.3 ??"does NOT increment on successful execution"`**

This test has a valid item (success path). After Story 3.1, no catch block fires, no fallback. Unchanged.

**Test 9: `Story 2.3 ??"resets consecutive_failures to 0 after successful insert"`**

Success path unchanged. Still expects 2 `consecutive_failures = 0` pool calls (resetConsecutiveFailures + resetSourceStats). Unchanged.

#### New tests to add

```typescript
describe('Story 3.1 ??browser_use_only fallback collection', () => {
  it('calls /crawler/fallback (not /crawler/execute) for browser_use_only source', ...)
  it('resolves source_id for browser_use_only source via getSourceByUrl', ...)
  it('inserts new source into content.source if browser_use_only source not found in DB', ...)
  it('fallback items pass through validate ??dedup ??insert pipeline', ...)
  it('fallback success resets content.source.consecutive_failures', ...)
  it('fallback failure increments content.source.consecutive_failures', ...)
  it('does NOT reset crawler_registry.consecutive_failures on fallback success', ...)
  it('continues processing other sources when browser_use_only fallback fails', ...)
})

describe('Story 3.1 ??crawl4ai failure triggers fallback', () => {
  it('calls /crawler/fallback after crawl4ai execute returns 422', ...)
  it('catch block increments crawler_registry.consecutive_failures only (not content.source)', ...)
  it('fallback success resets content.source stats after crawl4ai failure', ...)
  it('fallback failure increments content.source.consecutive_failures after crawl4ai failure', ...)
})

describe('Story 3.1 ??fallback log format', () => {
  it('logs START with source name, trigger code, timestamp', ...)
  it('logs SUCCESS with items count on fallback success', ...)
  it('logs FAILED on fallback error', ...)
})
```

---

### Architecture Compliance

- `resolveSourceId()` is private to `browser-crawl.ts` ??called directly in the browser_use_only loop (same file, no export needed)
- `_runFallbackForSource`, `_processFallbackArticles`, `_insertFallbackArticles` are private (no export)
- `callFallback` is private (no export) ??mirrors `callExecute` and `callAnalyze`
- `sha256AsBuffer` and `buildRepresentativeKey` are already available in the same file ??reuse them in `_insertFallbackArticles`
- `validateArticle` is already exported ??reuse in `_processFallbackArticles`
- No new packages or DB functions needed ??all DB functions already exist in `crawler-db.ts`

---

### File Structure

```
db/
  migrations/
    20260525000001_add_crawler_fallback_enum.sql   ??NEW

python_services/api/
  models/
    crawler.py                                     ??MODIFY: add FallbackRequest
  prompts/
    crawler_fallback.py                            ??NEW: CRAWLER_FALLBACK_PROMPT
  routers/
    crawler.py                                     ??MODIFY: add /fallback endpoint
    tests/
      test_crawler_fallback.py                     ??NEW: Python fallback tests

packages/pipeline/src/
  jobs/
    browser-crawl.ts                               ??MODIFY: add callFallback, _runFallbackForSource,
                                                              _processFallbackArticles, _insertFallbackArticles;
                                                              modify runCrawlerExecution
    __tests__/
      browser-crawl.test.ts                        ??MODIFY: update failure-path tests;
                                                              add Story 3.1 test blocks
```

**Do NOT create new TypeScript files** ??all changes extend `browser-crawl.ts`.
**Do NOT modify `crawler-db.ts`** ??all needed DB functions already exist.

---

### Architecture Compliance Checklist

- [x] `_insertFallbackArticles` calls `resetSourceStats` but NOT `resetConsecutiveFailures`
- [x] catch block in `runCrawlerExecution` calls `incrementConsecutiveFailures` (crawler_registry) only ??`incrementSourceConsecutiveFailures` removed from here
- [x] `_runFallbackForSource` calls `incrementSourceConsecutiveFailures` on fallback failure only
- [x] browser_use_only loop runs BEFORE `getAllActiveRegistryCrawlers` (Phase A before Phase B)
- [x] each browser_use_only iteration wrapped in try/catch (one failure doesn't halt batch)
- [x] `callFallback` timeout: 65_000ms (60s Python timeout + 5s buffer)
- [x] fallback log entries include source name, trigger code, timestamp, success/failure
- [x] Python endpoint returns `items: []` (not 422) when browser-use finds no articles
- [x] Python endpoint returns 422 only on browser-use invocation failure or timeout
- [x] `FallbackRequest` model added to `models/crawler.py` before use in router

---

### Previous Story Intelligence (Story 2.3 Learnings)

- Mock call ORDER is critical: `mockPoolQuery.mockResolvedValueOnce` must be set up in the exact DB call order before invoking the function
- For the browser_use_only loop (Phase A), mocks fire BEFORE the `getAllActiveRegistryCrawlers` mock
- `jest.clearAllMocks()` in `beforeEach` prevents cross-test pollution ??already in place
- `makeSource({ browserUseOnly: true })` is how to create browser_use_only test sources
- The `makeSource()` helper defaults `browserUseOnly: false` ??always set explicitly for LinkedIn tests
- In the Python tests, use `patch("api.routers.crawler._do_fallback", ...)` pattern (same as `_do_execute`)
- Python tests use `ASGITransport` + `AsyncClient` ??`app.state.browser_config` must be set as `MagicMock()` in the fixture

---

## File List

- `db/migrations/20260525000001_add_crawler_fallback_enum.sql` ??NEW: add `CRAWLER_FALLBACK` to `core.run_kind_enum`
- `python_services/api/models/crawler.py` ??MODIFY: add `FallbackRequest` model
- `python_services/api/prompts/crawler_fallback.py` ??NEW: `CRAWLER_FALLBACK_PROMPT`, constants
- `python_services/api/routers/crawler.py` ??MODIFY: add `POST /crawler/fallback`, `_FALLBACK_TIMEOUT`, `_do_fallback()`, `_parse_fallback_result()`; import `FallbackRequest` and `CRAWLER_FALLBACK_PROMPT`
- `python_services/api/routers/tests/test_crawler_fallback.py` ??NEW: Python fallback tests
- `packages/pipeline/src/jobs/browser-crawl.ts` ??MODIFY: add `callFallback`, `_runFallbackForSource`, `_processFallbackArticles`, `_insertFallbackArticles`; modify `runCrawlerExecution` (Phase A + Phase B restructure + catch block change)
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` ??MODIFY: update 7 existing failure-path tests; add Story 3.1 describe blocks

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- pre-existing failures in `test_crawler_analyze.py` (2 tests) ??`content_selector` fixture data mismatch unrelated to this story; not introduced by this implementation

### Completion Notes List

- All 8 task groups implemented and tested end-to-end
- Python: 26 new tests in `test_crawler_fallback.py`, all passing (100/102 suite total ??2 pre-existing analyze test failures unchanged)
- TypeScript: 52 tests in `browser-crawl.test.ts` (9 new Story 3.1 tests + 43 updated existing), all passing; full pipeline suite 115/115 passing
- Counter ownership: `incrementSourceConsecutiveFailures` moved from crawl4ai catch block ??`_runFallbackForSource` catch block; only increments when ALL collection methods fail
- `_insertFallbackArticles` intentionally does NOT call `resetConsecutiveFailures` ??crawler_registry counter preserved for Story 3.2 regeneration trigger
- Phase A mock order in tests: `resolveSourceId` DB calls fire BEFORE `getAllActiveRegistryCrawlers` ??critical for `mockResolvedValueOnce` ordering

### Change Log

| Date | Change |
|------|--------|
| 2026-05-25 | Story created ??comprehensive developer guide for browser-use fallback collection |
| 2026-05-25 | Story implemented ??all 8 task groups complete, 52 TS tests + 26 Python tests passing |

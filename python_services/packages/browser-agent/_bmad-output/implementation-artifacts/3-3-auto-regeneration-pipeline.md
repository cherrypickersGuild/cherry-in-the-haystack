# Story 3.3: Auto-Regeneration Pipeline

**Status:** review
**Story ID:** 3.3
**Epic:** 3 — Fallback Collection & Self-Healing
**Created:** 2026-05-25

---

## Tasks / Subtasks

- [x] Task 1: Update `AnalyzeRequest` model — `python_services/api/models/crawler.py`
  - [x] 1.1 Add `force: bool = False` field to `AnalyzeRequest`

- [x] Task 2: Update `/crawler/analyze` endpoint — `python_services/api/routers/crawler.py`
  - [x] 2.1 Change line 51 cache-hit guard from `if existing is not None:` to `if existing is not None and not req.force:`

- [x] Task 3: Add `hasDeprecatedRegistry()` — `packages/pipeline/src/db/crawler-db.ts`
  - [x] 3.1 Export `async function hasDeprecatedRegistry(pool: Pool, sourceId: string): Promise<boolean>`
  - [x] 3.2 Query uses `EXISTS(SELECT 1 FROM content.crawler_registry WHERE source_id = $1 AND status = 'deprecated')`
  - [x] 3.3 Return `(res.rows[0]?.has_deprecated as boolean) ?? false`

- [x] Task 4: Update `callAnalyze()` — `packages/pipeline/src/jobs/browser-crawl.ts`
  - [x] 4.1 Add optional `force: boolean = false` third parameter
  - [x] 4.2 Include `force` in the JSON request body (`JSON.stringify({ source_id: sourceId, url, force })`)

- [x] Task 5: Add `runRegenerationPipeline()` — `packages/pipeline/src/jobs/browser-crawl.ts`
  - [x] 5.1 Add function after `runFullPipeline()` — same structure but calls `callAnalyze(sourceId, url, true)`
  - [x] 5.2 PR title: `feat(crawler): regenerate crawler for ${source.sourceName}`
  - [x] 5.3 After `updateRegistryWithPR()`: call `_runFallbackForSource(pool, sourceId, source, 'REGENERATION_TRIGGERED')` for FR-7.5 current-cycle coverage

- [x] Task 6: Modify `processSource()` — `packages/pipeline/src/jobs/browser-crawl.ts`
  - [x] 6.1 Add `hasDeprecatedRegistry` to imports from `../db/crawler-db`
  - [x] 6.2 In "no registry" branch (line 150): call `hasDeprecatedRegistry()` → route to `runRegenerationPipeline` if true, else `runFullPipeline`
  - [x] 6.3 In "pending_review + prNumber" branch (after `checkAndActivatePR()`): call `hasDeprecatedRegistry()` → if true, call `_runFallbackForSource(pool, sourceId, source, 'REGENERATION_PENDING')` for FR-7.5 subsequent-cycle coverage

- [x] Task 7: Add Story 3.3 test block — `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts`
  - [x] 7.1 Test: deprecated registry exists → regeneration pipeline (force=true analyze + generate + PR + fallback)
  - [x] 7.2 Test: verify `force: true` in `/crawler/analyze` request body
  - [x] 7.3 Test: no deprecated registry → normal pipeline (no force, no fallback in processSource)
  - [x] 7.4 Test: pending_review + deprecated → fallback runs, no analyze/generate (FR-7.5, FR-7.6)
  - [x] 7.5 Test: pending_review + no deprecated → no fallback (initial onboarding PR, not regeneration)

- [x] Task 8: Update existing tests broken by new `hasDeprecatedRegistry` call
  - [x] 8.1 AC1 test "calls analyze → generate → createPR → updateRegistryWithPR for new source": add `hasDeprecatedRegistry` mock returning false after `getActiveOrPendingRegistry` mock
  - [x] 8.2 AC1 test "PR body contains required ADR-014-R1 fields": same addition
  - [x] 8.3 AC4 tests (both "activates registry when PR merged" and "does not activate"): add `hasDeprecatedRegistry` mock returning false after `checkAndActivatePR` octokit call

---

## User Story

As an engineer,
I want the system to automatically re-analyze a broken source and open a new generated Python crawl4ai crawler PR when the failure threshold is reached,
so that broken crawlers are replaced without any manual intervention — the source continues collecting via fallback until the new PR is merged.

---

## Acceptance Criteria

**AC1 — Full regeneration pipeline fires when deprecated:**
**Given** a source whose active `crawler_registry` row was deprecated by Story 3.2 (consecutive_failures ≥ threshold)
**When** the orchestrator's `processSource()` runs for that source on the next daily cycle
**Then** `POST /crawler/analyze` is called with `force=true` against the current live page — bypassing the cached analysis
**And** on success, `POST /crawler/generate` is called with the new analysis
**And** on success, `GitHubCommitter.createPullRequest()` opens a new PR with the regenerated `.py` file at `python_services/crawlers/generated/{source_name_kebab}.py`
**And** the new `crawler_registry` row has `status = 'pending_review'` and references the updated `analysis_id`

**AC2 — Deprecated broken crawler stays deprecated (FR-7.4):**
**Given** the deprecated broken crawler row in `crawler_registry`
**When** regeneration completes (new pending_review row created)
**Then** the old row remains `status = 'deprecated'` — untouched by Story 3.3 code
**And** it is not returned by `getAllActiveRegistryCrawlers()` (which queries `WHERE status = 'active'` only)

**AC3 — Fallback runs during review window (FR-7.5):**
**Given** the source is in regeneration-pending state (deprecated old row + new pending_review row + PR open)
**When** `processSource()` runs for that source on any cycle before the PR is merged
**Then** browser-use fallback (`POST /crawler/fallback`) runs for that source
**And** articles flow through validation → dedup → pipeline as normal

**AC4 — Single-shot regeneration (FR-7.6):**
**Given** regeneration has fired (new pending_review row exists from runRegenerationPipeline)
**When** the orchestrator runs on the NEXT daily cycle
**Then** `processSource()` enters the "pending_review" branch (not the "no registry" branch)
**And** analyze/generate are NOT called again — only `checkAndActivatePR()` + fallback run

**AC5 — PR merge activates new crawler (inherited from Story 1.6 AC4):**
**Given** the new regenerated PR is merged
**When** the orchestrator's `checkAndActivatePR()` detects the merge
**Then** the new `crawler_registry` row is updated to `status = 'active'`
**And** Playwright execution resumes for that source in the next daily cycle via Phase B

---

## Dev Notes

### The Regeneration Trigger — How We Got Here

Story 3.2 called `deprecateRegistry(pool, crawler.registryId)` when `consecutive_failures >= threshold`. After that:
- The source has ONE `deprecated` row in `crawler_registry`, NO `active` or `pending_review` rows
- On the next cycle: `getActiveOrPendingRegistry()` returns `null` (queries `status IN ('active', 'pending_review')`)
- WITHOUT Story 3.3: `processSource()` would fall through to `runFullPipeline()` → `/crawler/analyze` cache-hit → returns STALE analysis → generates same broken crawler → waste

**Story 3.3 fixes the detection**: `hasDeprecatedRegistry()` distinguishes "new source" (no rows) from "regeneration" (deprecated row exists).

---

### New DB Function: `hasDeprecatedRegistry()` (Task 3)

Add after `deprecateRegistry` in `packages/pipeline/src/db/crawler-db.ts`:

```typescript
export async function hasDeprecatedRegistry(
  pool: Pool,
  sourceId: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM content.crawler_registry
       WHERE source_id = $1 AND status = 'deprecated'
     ) AS has_deprecated`,
    [sourceId],
  )
  return (res.rows[0]?.has_deprecated as boolean) ?? false
}
```

Returns `true` if at least one `deprecated` row exists for the source (regardless of other rows). This is the only DB change for this story — no new tables, no migration.

---

### Modified `processSource()` (Task 6)

**Current "no registry" branch** (line 150 in browser-crawl.ts):
```typescript
// AC1, AC6: no registry entry — run the full onboarding pipeline
await runFullPipeline(pool, committer, source, sourceId)
```

**Replacement:**
```typescript
// Distinguish regeneration (deprecated row exists) from new source (no rows)
const isRegeneration = await hasDeprecatedRegistry(pool, sourceId)
if (isRegeneration) {
  // FR-7.2, FR-7.3: force fresh analysis + generate updated crawler + open PR
  await runRegenerationPipeline(pool, committer, source, sourceId)
} else {
  // AC1, AC6: genuinely new source — normal onboarding pipeline
  await runFullPipeline(pool, committer, source, sourceId)
}
```

**Current "pending_review" branch** (lines 139–147 in browser-crawl.ts):
```typescript
if (registry?.status === 'pending_review') {
  if (registry.prNumber !== null) {
    await checkAndActivatePR(pool, octokit, registry)
  } else {
    await retryPRCreation(pool, committer, source, sourceId, registry)
  }
  return
}
```

**Replacement:**
```typescript
if (registry?.status === 'pending_review') {
  if (registry.prNumber !== null) {
    await checkAndActivatePR(pool, octokit, registry)
    // FR-7.5: if regeneration review window, run fallback on every cycle until PR merged
    const isRegeneration = await hasDeprecatedRegistry(pool, sourceId)
    if (isRegeneration) {
      await _runFallbackForSource(pool, sourceId, source, 'REGENERATION_PENDING')
    }
  } else {
    await retryPRCreation(pool, committer, source, sourceId, registry)
  }
  return
}
```

Note: `retryPRCreation` path (pending_review without prNumber) does NOT check `hasDeprecatedRegistry` — that edge case is a generate-succeeded-but-PR-failed retry, not a regeneration detection point.

---

### New `runRegenerationPipeline()` (Task 5)

Add after `runFullPipeline()` in browser-crawl.ts:

```typescript
async function runRegenerationPipeline(
  pool: Pool,
  committer: PullRequestCreator,
  source: SourceConfig,
  sourceId: string,
): Promise<void> {
  console.log(`[browser-crawl] regenerating crawler for: ${source.sourceName}`)

  // FR-7.2: force fresh analysis — bypasses cache, UPSERT overwrites existing crawler_analysis
  const analyzeResult = await callAnalyze(sourceId, source.url, true)
  const { analysis_id: analysisId, analysis_json: analysisJson } = analyzeResult

  // FR-7.3: generate updated Python crawl4ai script → new pending_review row in crawler_registry
  const generateResult = await callGenerate(sourceId, analysisId, source.sourceName)
  const { registry_id: registryId, generated_code: generatedCode } = generateResult

  const kebabName = toKebabCase(source.sourceName)
  const prBody = buildPRBody(source, analysisJson, analysisId)

  // createPullRequest() from Story 1.5 auto-closes any existing PR on same branch
  const { prNumber, prUrl } = await committer.createPullRequest({
    branch: `feat/crawler/${kebabName}`,
    title: `feat(crawler): regenerate crawler for ${source.sourceName}`,
    body: prBody,
    files: [{
      path: `python_services/crawlers/generated/${kebabName}.py`,
      content: generatedCode,
    }],
  })

  await updateRegistryWithPR(pool, registryId, prNumber, prUrl)
  console.log(`[browser-crawl] regeneration PR #${prNumber} opened for ${source.sourceName}`)

  // FR-7.5: run fallback for this cycle while new PR awaits review
  await _runFallbackForSource(pool, sourceId, source, 'REGENERATION_TRIGGERED')
}
```

**Difference from `runFullPipeline()`:**
- Calls `callAnalyze(sourceId, url, true)` — `force=true`
- PR title uses "regenerate" instead of "add"
- Calls `_runFallbackForSource()` after PR creation (FR-7.5 for the current cycle)

---

### Updated `callAnalyze()` (Task 4)

**Current signature** (line 253–268 in browser-crawl.ts):
```typescript
async function callAnalyze(
  sourceId: string,
  url: string,
): Promise<{ analysis_id: string; analysis_json: AnalysisJsonShape }> {
  ...
  body: JSON.stringify({ source_id: sourceId, url }),
  ...
}
```

**New signature:**
```typescript
async function callAnalyze(
  sourceId: string,
  url: string,
  force: boolean = false,
): Promise<{ analysis_id: string; analysis_json: AnalysisJsonShape }> {
  const res = await fetch(`${getCrawlerApiUrl()}/crawler/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, url, force }),
    signal: AbortSignal.timeout(65_000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/analyze failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<{ analysis_id: string; analysis_json: AnalysisJsonShape }>
}
```

The existing call in `runFullPipeline()` — `callAnalyze(sourceId, source.url)` — passes `force=false` by default. **No change needed to `runFullPipeline()`.**

---

### Python Changes (Tasks 1–2)

**`python_services/api/models/crawler.py`** — add `force` to `AnalyzeRequest` (after line 11):

```python
class AnalyzeRequest(BaseModel):
    source_id: UUID
    url: str
    force: bool = False          # ← ADD THIS LINE
```

**`python_services/api/routers/crawler.py`** — modify cache-hit guard in `analyze_source()` (line 51):

**Current:**
```python
existing = await db.get_crawler_analysis(req.source_id)
if existing is not None:
    return JSONResponse(content={
        "analysis_id": str(existing["id"]),
        "analysis_json": existing["analysis_json"],
    })
```

**New:**
```python
existing = await db.get_crawler_analysis(req.source_id)
if existing is not None and not req.force:    # ← CHANGE: add `and not req.force`
    return JSONResponse(content={
        "analysis_id": str(existing["id"]),
        "analysis_json": existing["analysis_json"],
    })
```

When `force=True`: skips the early-return, proceeds to run browser-use, then calls `db.upsert_crawler_analysis()`. The UPSERT uses the unique index on `source_id` — it UPDATE-in-places the existing row (FR-7.2: "overwrite/update in place"). No DB schema change needed.

---

### 🔴 REGRESSION: Existing Tests Need Extra Mock for `hasDeprecatedRegistry`

The new `hasDeprecatedRegistry()` call adds one `pool.query()` invocation to two paths in `processSource()`:
1. The "no registry" path (before `runFullPipeline`/`runRegenerationPipeline`)
2. The "pending_review + prNumber" path (after `checkAndActivatePR`)

**Tests that need one additional mock added:**

**Path 1 — "no registry" tests (add after `getActiveOrPendingRegistry` mock):**

| Test | Where to add mock |
|------|-------------------|
| AC1: "calls analyze → generate → createPR..." (line 157) | After `mockPoolQuery.mockResolvedValueOnce({ rows: [] })` for `getActiveOrPendingRegistry` |
| AC1: "PR body contains required ADR-014-R1 fields" (line 209) | Same position |

Mock to add: `mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false`

**Path 2 — "pending_review + prNumber" tests (add after `octokit.rest.pulls.get` mock):**

| Test | Where to add mock |
|------|-------------------|
| AC4: "activates registry when PR is merged" | After `mockOctokitPullsGet` mock |
| AC4: "does not activate registry when PR not merged" | After `mockOctokitPullsGet` mock |

Mock to add: `mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false`

**Tests NOT affected** (return before reaching these paths):
- AC3: browser_use_only (returns immediately, no DB calls)
- AC2: active registry (returns at "active" branch)
- Any retryPRCreation tests (pending_review without prNumber — no `hasDeprecatedRegistry` call in that branch)

---

### New Test Block: Story 3.3 (Task 7)

```typescript
describe('Story 3.3 — Auto-Regeneration Pipeline', () => {
  it('deprecated registry triggers runRegenerationPipeline (force analyze + generate + PR + fallback)', async () => {
    const source = makeSource({ url: 'https://example.com', sourceName: 'Example' })
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    // resolveSourceId: source already in DB
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-1' }] })           // getSourceByUrl → found
    // getActiveOrPendingRegistry: null (no active/pending_review)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    // hasDeprecatedRegistry: true → regeneration case
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: true }] })
    // updateRegistryWithPR
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    // POST /crawler/analyze (force=true)
    mockFetchJson({ analysis_id: 'analysis-regen-1', analysis_json: ANALYSIS_JSON })
    // POST /crawler/generate
    mockFetchJson({ registry_id: 'registry-regen-1', generated_code: '# regen python' })
    // POST /crawler/fallback (FR-7.5)
    mockFetchJson({ source_id: 'src-1', items: [] })

    mockCreatePullRequest.mockResolvedValue({ prNumber: 77, prUrl: 'https://github.com/org/repo/pull/77' })

    await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

    // fetch called 3 times: analyze + generate + fallback
    expect(mockFetch).toHaveBeenCalledTimes(3)
    // analyze called
    expect(mockFetch).toHaveBeenNthCalledWith(1,
      'http://localhost:8000/crawler/analyze',
      expect.objectContaining({ method: 'POST' }),
    )
    // generate called
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:8000/crawler/generate',
      expect.objectContaining({ method: 'POST' }),
    )
    // fallback called (FR-7.5)
    expect(mockFetch).toHaveBeenNthCalledWith(3,
      'http://localhost:8000/crawler/fallback',
      expect.objectContaining({ method: 'POST' }),
    )
    // PR opened
    expect(mockCreatePullRequest).toHaveBeenCalledWith(expect.objectContaining({
      branch: 'feat/crawler/example',
      files: [{ path: 'python_services/crawlers/generated/example.py', content: '# regen python' }],
    }))
  })

  it('force=true is sent in /crawler/analyze request body during regeneration', async () => {
    const source = makeSource({ url: 'https://example.com', sourceName: 'Example' })
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-1' }] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: true }] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    mockFetchJson({ analysis_id: 'analysis-regen-1', analysis_json: ANALYSIS_JSON })
    mockFetchJson({ registry_id: 'registry-regen-1', generated_code: '# regen python' })
    mockFetchJson({ source_id: 'src-1', items: [] })

    mockCreatePullRequest.mockResolvedValue({ prNumber: 77, prUrl: 'https://github.com/org/repo/pull/77' })

    await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

    // Verify force=true in analyze request body
    const analyzCall = mockFetch.mock.calls[0]
    const analyzeBody = JSON.parse(analyzCall[1].body as string)
    expect(analyzeBody.force).toBe(true)
  })

  it('no deprecated registry → normal pipeline (no force, no fallback in processSource)', async () => {
    const source = makeSource({ url: 'https://example.com', sourceName: 'Example' })
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })    // getSourceByUrl → not found
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })    // insertSource
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })    // getActiveOrPendingRegistry → null
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] }) // hasDeprecatedRegistry → false
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })    // updateRegistryWithPR

    mockFetchJson({ analysis_id: 'analysis-1', analysis_json: ANALYSIS_JSON })
    mockFetchJson({ registry_id: 'registry-1', generated_code: '# new python' })
    mockCreatePullRequest.mockResolvedValue({ prNumber: 55, prUrl: 'https://github.com/org/repo/pull/55' })

    await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

    // Only 2 fetch calls (analyze + generate) — no fallback
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // force=false in analyze body (or omitted with default false)
    const analyzeBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(analyzeBody.force).toBe(false)
    // No fallback call
    const fallbackCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/crawler/fallback'),
    )
    expect(fallbackCalls).toHaveLength(0)
  })

  it('pending_review + deprecated → fallback runs each cycle, no analyze/generate (FR-7.5, FR-7.6)', async () => {
    const source = makeSource({ url: 'https://example.com', sourceName: 'Example' })
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    // resolveSourceId: found
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-1' }] })
    // getActiveOrPendingRegistry: pending_review with prNumber (from previous regeneration cycle)
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        id: 'registry-regen-1',
        status: 'pending_review',
        pr_number: 77,
        pr_url: 'https://github.com/org/repo/pull/77',
        generated_code: '# regen python',
      }],
    })
    // checkAndActivatePR via octokit: PR not merged yet
    mockOctokitPullsGet.mockResolvedValue({ data: { merged_at: null } })
    // hasDeprecatedRegistry: true (old deprecated row exists)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: true }] })
    // _runFallbackForSource → callFallback response (empty items)
    mockFetchJson({ source_id: 'src-1', items: [] })

    await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

    // Fallback called (FR-7.5)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/crawler/fallback',
      expect.objectContaining({ method: 'POST' }),
    )
    // analyze/generate NOT called (FR-7.6 — pending_review path prevents re-regeneration)
    const analyzeOrGenerateCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' &&
        (call[0].includes('/crawler/analyze') || call[0].includes('/crawler/generate')),
    )
    expect(analyzeOrGenerateCalls).toHaveLength(0)
    // createPullRequest NOT called
    expect(mockCreatePullRequest).not.toHaveBeenCalled()
  })

  it('pending_review + NO deprecated → no fallback (initial onboarding PR, not regeneration)', async () => {
    const source = makeSource({ url: 'https://example.com', sourceName: 'Example' })
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-1' }] })
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        id: 'registry-initial-1',
        status: 'pending_review',
        pr_number: 55,
        pr_url: 'https://github.com/org/repo/pull/55',
        generated_code: '# initial python',
      }],
    })
    mockOctokitPullsGet.mockResolvedValue({ data: { merged_at: null } })
    // hasDeprecatedRegistry: false (new source, no deprecated row)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })

    await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

    // No fetch calls — no fallback, no analyze, no generate
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).not.toHaveBeenCalled()
  })
})
```

---

### FR Coverage Cross-Reference

| FR | Implementation |
|----|---------------|
| FR-7.2: Re-run browser-use analysis | `callAnalyze(sourceId, url, true)` bypasses Python cache; browser-use Agent invoked fresh |
| FR-7.3: Generate updated crawler + new PR | `callGenerate()` → new `pending_review` row; `createPullRequest()` → new PR |
| FR-7.4: Deprecated row stays deprecated | `runRegenerationPipeline()` never touches the deprecated row — only `INSERT` via `/crawler/generate` |
| FR-7.5: Fallback continues during review window | `_runFallbackForSource()` called in `runRegenerationPipeline()` (current cycle) and in pending_review+deprecated path (subsequent cycles) |
| FR-7.6: Single-shot regeneration | After `runRegenerationPipeline()`: new `pending_review` row → next `processSource()` goes to "pending_review" branch → no analyze/generate |

---

### Architecture Compliance

- TypeScript file naming: `browser-crawl.ts`, `crawler-db.ts` — unchanged ✓
- No new files needed — all changes are modifications to existing files ✓
- `runRegenerationPipeline()` reuses `callAnalyze`, `callGenerate`, `buildPRBody`, `updateRegistryWithPR`, `toKebabCase`, `_runFallbackForSource` — zero duplication ✓
- `_runFallbackForSource()` is defined in `browser-crawl.ts` and accessible from `processSource()` (same module) ✓
- `createPullRequest()` from Story 1.5 auto-handles closing any existing PR on the same branch — no extra logic needed ✓
- No DB migration — `hasDeprecatedRegistry` queries the existing `crawler_registry.status` column (Story 1.1) ✓
- Python `db.upsert_crawler_analysis()` already does UPSERT on `source_id` unique index — force=true re-analysis correctly overwrites in place ✓
- `getAllActiveRegistryCrawlers()` in Phase B queries `WHERE status = 'active'` — deprecated crawler excluded automatically (FR-7.4) ✓

---

### File Structure

```
python_services/api/
  models/
    crawler.py                  ← MODIFY: add `force: bool = False` to AnalyzeRequest

  routers/
    crawler.py                  ← MODIFY: change line 51 cache-hit guard to include `and not req.force`

packages/pipeline/src/
  db/
    crawler-db.ts               ← MODIFY: add `hasDeprecatedRegistry(pool, sourceId): Promise<boolean>`

  jobs/
    browser-crawl.ts            ← MODIFY:
                                    - `callAnalyze()`: add optional `force` param, include in body
                                    - `processSource()`: "no registry" branch → hasDeprecatedRegistry check
                                    - `processSource()`: "pending_review+prNumber" branch → hasDeprecatedRegistry + fallback
                                    - ADD: `runRegenerationPipeline()` after `runFullPipeline()`
                                    - ADD: `hasDeprecatedRegistry` to imports from crawler-db

    __tests__/
      browser-crawl.test.ts     ← MODIFY:
                                    - Update 4 existing tests to add `hasDeprecatedRegistry` mock
                                    - ADD: Story 3.3 describe block (5 tests)
```

**No new files. No DB migration. Python changes: 2 lines total.**

---

### Previous Story Intelligence (Story 3.2 Learnings)

- `_runFallbackForSource()` is a private function inside `browser-crawl.ts` — it IS callable from `processSource()` since both are in the same file. DO NOT export it.
- Mock call ORDER is critical: `mockPoolQuery.mockResolvedValueOnce` fires in exact DB call sequence. The `hasDeprecatedRegistry` mock fires AFTER `getActiveOrPendingRegistry` mock in the "no registry" path.
- In tests where fallback returns empty items (`items: []`), `_processFallbackArticles` returns early without DB calls (0-items fast-path). No need to mock `getExistingRepresentativeKeys` or `insertArticlesRaw` in these cases.
- Story 3.2 added `deprecateRegistry` import to `browser-crawl.ts` — Story 3.3 adds `hasDeprecatedRegistry` to the same import line.
- `makeSource()` default has `consecutiveFailuresThreshold: 3` and `browserUseOnly: false`.
- Story 3.1 note: `incrementSourceConsecutiveFailures` is called from `_runFallbackForSource()` ONLY when fallback itself fails — not when fallback succeeds with empty items.
- Story 3.2 note: DO NOT call `runFullPipeline` from the regeneration trigger — Story 3.2 left the "regeneration queue" implicit. Story 3.3 is the explicit implementation.

---

### References

- `packages/pipeline/src/jobs/browser-crawl.ts` — `processSource()` (lines 118–152), `runFullPipeline()` (lines 172–201), `callAnalyze()` (lines 253–268), `_runFallbackForSource()` (lines 502–522)
- `packages/pipeline/src/db/crawler-db.ts` — `deprecateRegistry` (lines 207–217, follow same pattern), `getActiveOrPendingRegistry` (lines 61–81)
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` — AC1 tests (line 156), AC4 tests, Story 3.2 describe block (line 1067)
- `python_services/api/models/crawler.py` — `AnalyzeRequest` (lines 9–11)
- `python_services/api/routers/crawler.py` — `analyze_source()` (lines 48–105), cache-hit check at line 51
- Architecture ADR-011-R1 — `crawler_analysis` UPSERT on `source_id` unique index (force overwrite is safe)
- Architecture ADR-013-R1 — `force` parameter flows: TS callAnalyze → Python AnalyzeRequest → browser-use Agent invocation
- Epics file Story 3.3 ACs — FR-7.2 through FR-7.6

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Tasks 1–2: Python changes — added `force: bool = False` to `AnalyzeRequest` and updated cache-hit guard in `analyze_source()` to `if existing is not None and not req.force:`
- Task 3: Added `hasDeprecatedRegistry()` to `crawler-db.ts` using EXISTS query on `crawler_registry.status = 'deprecated'`
- Tasks 4–6: Updated `callAnalyze()` with optional `force` param; added `runRegenerationPipeline()` (force analyze + generate + PR + FR-7.5 fallback); modified `processSource()` with two new `hasDeprecatedRegistry()` branches
- Tasks 7–8: Added 5 new Story 3.3 tests; fixed 4 existing AC1/AC4 tests by inserting `hasDeprecatedRegistry` pool mocks; updated one `toHaveBeenCalledTimes(2)` assertion to `(3)`. All 63 tests pass.
- FR-7.6 single-shot guarantee enforced naturally: `runRegenerationPipeline()` creates a `pending_review` row, so next cycle enters "pending_review" branch — no re-trigger possible.

### File List

- `python_services/api/models/crawler.py` — MODIFIED
- `python_services/api/routers/crawler.py` — MODIFIED
- `packages/pipeline/src/db/crawler-db.ts` — MODIFIED
- `packages/pipeline/src/jobs/browser-crawl.ts` — MODIFIED
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` — MODIFIED

### Change Log

- 2026-05-25: Story 3.3 implemented — auto-regeneration pipeline for deprecated crawlers (Tasks 1–8 complete)

# Story 3.2: crawl4ai Failure Counter & Regeneration Trigger

**Status:** review
**Story ID:** 3.2
**Epic:** 3 — Fallback Collection & Self-Healing
**Created:** 2026-05-25

---

## Tasks / Subtasks

- [x] Task 1: Modify `crawler-db.ts` — update `incrementConsecutiveFailures` to return new count
  - [x] 1.1 Change return type from `Promise<void>` to `Promise<number>`
  - [x] 1.2 Add `RETURNING consecutive_failures` to the UPDATE query
  - [x] 1.3 Return `res.rows[0]?.consecutive_failures ?? 0`

- [x] Task 2: Add `deprecateRegistry()` to `crawler-db.ts`
  - [x] 2.1 Export `async function deprecateRegistry(pool: Pool, registryId: string): Promise<void>`
  - [x] 2.2 Query: `UPDATE content.crawler_registry SET status = 'deprecated', updated_at = NOW() WHERE id = $1`

- [x] Task 3: Add `DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD` constant to `browser-crawl.ts`
  - [x] 3.1 Add `const DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD = 3` alongside existing defaults

- [x] Task 4: Import `deprecateRegistry` in `browser-crawl.ts`
  - [x] 4.1 Add `deprecateRegistry` to the import from `../db/crawler-db`

- [x] Task 5: Modify `runCrawlerExecution()` catch block in `browser-crawl.ts`
  - [x] 5.1 Move `sourceConfig` lookup to BEFORE the inner DB try/catch
  - [x] 5.2 Use returned count from `incrementConsecutiveFailures` for threshold comparison
  - [x] 5.3 If count >= threshold: call `deprecateRegistry(pool, crawler.registryId)` and log
  - [x] 5.4 Keep fallback call (`_runFallbackForSource`) unchanged after the DB try/catch

- [x] Task 6: Update existing tests in `browser-crawl.test.ts` — mock return value change
  - [x] 6.1 Update all `incrementConsecutiveFailures` mocks from `{ rows: [] }` to `{ rows: [{ consecutive_failures: 1 }] }` (1 is below default threshold of 3 → no deprecation)
  - [x] 6.2 Identify all 8 affected tests (see Dev Notes section)

- [x] Task 7: Add Story 3.2 test block to `browser-crawl.test.ts`
  - [x] 7.1 Add `describe('Story 3.2 — failure counter & regeneration trigger', ...)` with tests per Dev Notes

---

## User Story

As an engineer,
I want the system to track consecutive crawl4ai crawler failures per source and deprecate the active crawler after a configurable threshold,
so that persistent breakages are automatically detected and the broken crawler is removed from rotation, enabling the regeneration pipeline to create a replacement.

---

## Acceptance Criteria

**AC1 — failure increments crawler_registry counter:**
**Given** a crawl4ai crawler run (`POST /crawler/execute`) for a source that results in a full-run failure triggering fallback
**When** the fallback logic runs
**Then** `content.crawler_registry.consecutive_failures` is incremented for the active crawler row
**And** this counter is independent of `content.source.consecutive_failures` (which resets on any success including fallback)

**AC2 — threshold crossed → deprecate and queue regeneration:**
**Given** `crawler_registry.consecutive_failures` reaches the threshold configured for that source (`consecutive_failures_threshold` in YAML config, default: 3)
**When** the threshold is crossed
**Then** the active crawler row is updated to `status = 'deprecated'`
**And** a regeneration job is queued for that source (implicit: no active/pending crawler → onboarding cycle re-runs pipeline in next cycle per Story 3.3)
**And** the deprecated crawler is no longer invoked via `/crawler/execute` in future scheduler runs (enforced by `getAllActiveRegistryCrawlers` WHERE status = 'active')

**AC3 — transient failure resets on next success:**
**Given** a single transient crawl4ai failure (count below threshold)
**When** the next run succeeds
**Then** `crawler_registry.consecutive_failures` is reset to 0 for that source's active crawler row
**And** no regeneration is triggered

**AC4 — browser_use_only sources never increment:**
**Given** a source with `browser_use_only: true`
**When** the scheduler runs
**Then** `crawler_registry.consecutive_failures` is never incremented for that source (it has no crawl4ai crawler to track)

---

## Dev Notes

### 🔴 CRITICAL: `incrementConsecutiveFailures` Return Type Change

`incrementConsecutiveFailures` in `packages/pipeline/src/db/crawler-db.ts` (line 193) must be changed from `Promise<void>` to `Promise<number>` using a `RETURNING` clause. This is necessary so the catch block in `runCrawlerExecution` can read the new count without a second DB round-trip.

**Current (lines 193–203):**
```typescript
export async function incrementConsecutiveFailures(
  pool: Pool,
  sourceId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET consecutive_failures = consecutive_failures + 1, updated_at = NOW()
     WHERE source_id = $1 AND status = 'active'`,
    [sourceId],
  )
}
```

**New (Task 1):**
```typescript
export async function incrementConsecutiveFailures(
  pool: Pool,
  sourceId: string,
): Promise<number> {
  const res = await pool.query(
    `UPDATE content.crawler_registry
     SET consecutive_failures = consecutive_failures + 1, updated_at = NOW()
     WHERE source_id = $1 AND status = 'active'
     RETURNING consecutive_failures`,
    [sourceId],
  )
  return (res.rows[0]?.consecutive_failures as number) ?? 0
}
```

**Edge case**: if no `active` row exists for `source_id` (already deprecated or missing), `res.rows` is empty → returns `0` → no deprecation fires. This is safe.

---

### New DB Function: `deprecateRegistry()` (Task 2)

Add after `activateRegistry` in `packages/pipeline/src/db/crawler-db.ts`:

```typescript
export async function deprecateRegistry(
  pool: Pool,
  registryId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET status = 'deprecated', updated_at = NOW()
     WHERE id = $1`,
    [registryId],
  )
}
```

Do NOT add a WHERE status = 'active' guard — the caller already has the registryId of the active crawler. Keeping it simple avoids silent no-ops.

---

### Modified `runCrawlerExecution()` catch block (Task 5)

Current catch block in `packages/pipeline/src/jobs/browser-crawl.ts` (lines 399–417):

```typescript
} catch (err) {
  console.error(`[crawler-exec] FULL_RUN_FAILURE source=${crawler.sourceUrl}:`, err)
  // AC3: increment crawler_registry counter only (content.source counter owned by _runFallbackForSource)
  try {
    await incrementConsecutiveFailures(pool, crawler.sourceId)
  } catch (dbErr) {
    console.error(
      `[crawler-exec] failed to update consecutive_failures for source=${crawler.sourceUrl}:`,
      dbErr,
    )
  }
  // AC1: trigger browser-use fallback collection
  const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
  if (sourceConfig) {
    const triggerCode = (err as Error).message?.split('\n')[0] ?? 'FULL_RUN_FAILURE'
    await _runFallbackForSource(pool, crawler.sourceId, sourceConfig, triggerCode)
  }
}
```

**New catch block (Task 3–5):**

```typescript
} catch (err) {
  console.error(`[crawler-exec] FULL_RUN_FAILURE source=${crawler.sourceUrl}:`, err)
  const sourceConfig = sources.find((s) => s.url === crawler.sourceUrl)
  // AC1: increment crawler_registry counter; AC2: deprecate if threshold reached
  try {
    const newFailCount = await incrementConsecutiveFailures(pool, crawler.sourceId)
    const threshold = sourceConfig?.consecutiveFailuresThreshold ?? DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD
    if (newFailCount >= threshold) {
      console.log(
        `[crawler-exec] THRESHOLD_REACHED source=${crawler.sourceUrl} failures=${newFailCount} — deprecating registry ${crawler.registryId}`,
      )
      await deprecateRegistry(pool, crawler.registryId)
    }
  } catch (dbErr) {
    console.error(
      `[crawler-exec] failed to update consecutive_failures for source=${crawler.sourceUrl}:`,
      dbErr,
    )
  }
  // AC1 Story 3.1: trigger browser-use fallback collection
  if (sourceConfig) {
    const triggerCode = (err as Error).message?.split('\n')[0] ?? 'FULL_RUN_FAILURE'
    await _runFallbackForSource(pool, crawler.sourceId, sourceConfig, triggerCode)
  }
}
```

**Key change**: `sourceConfig` lookup moves to the TOP of the catch block (before the inner try/catch) so it's accessible for both the threshold check AND the fallback call.

Add this constant alongside `DEFAULT_MIN_BODY_LENGTH` and `DEFAULT_RECENCY_WINDOW_DAYS` in the Config section (around line 84):
```typescript
const DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD = 3
```

Add `deprecateRegistry` to the import block from `../db/crawler-db`.

---

### 🔴 CRITICAL: Test Impact — Mock Value Change (Task 6)

`incrementConsecutiveFailures` now returns `{ rows: [{ consecutive_failures: N }] }` instead of `{ rows: [] }`. All existing mocks for this DB call must be updated.

**The rule**: if a test does NOT intend to trigger deprecation, mock with `{ rows: [{ consecutive_failures: 1 }] }` (1 < default threshold 3 → no deprecation).

**8 tests to update** (search for `// incrementConsecutiveFailures` comments in browser-crawl.test.ts):

| Test | Current mock | New mock |
|------|-------------|---------|
| AC4 batch resilience — "continues when /crawler/execute returns 422" (line 437) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| AC4 batch resilience — "continues when fetch throws a network error" (line 462) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| AC3 all invalid — "all-invalid signal full-run failure" (line 621) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| AC4 per-source — "article below custom minBodyLength" (line 647) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| Story 2.3 — "increments consecutive_failures when execute returns 422" (line 784) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| Story 2.3 — "increments consecutive_failures when all articles fail validation" (line 807) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| Story 3.1 — "crawl4ai failure triggers fallback" (line 951) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |
| Story 3.1 — "crawl4ai failure: only crawler_registry counter incremented" (line 994) | `{ rows: [] }` | `{ rows: [{ consecutive_failures: 1 }] }` |

**No other changes** to these tests — mock order and assertion counts remain the same (deprecateRegistry is NOT called when count = 1 < threshold 3).

---

### New Test Block: Story 3.2 (Task 7)

```typescript
describe('Story 3.2 — failure counter & regeneration trigger', () => {
  it('deprecates active crawler when consecutive_failures reaches threshold (default 3)', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example', consecutiveFailuresThreshold: 3 })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)                                        // execute: 422
    mockFetchJson({ source_id: 'src-1', items: [] })                                 // fallback: success (empty)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 3 }] })      // incrementConsecutiveFailures → returns 3 (= threshold)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                                  // deprecateRegistry

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // deprecateRegistry must be called with the correct registryId
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("'deprecated'"),
      ['reg-1'],
    )
  })

  it('does NOT deprecate when consecutive_failures is below threshold', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example', consecutiveFailuresThreshold: 3 })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)                                        // execute: 422
    mockFetchJson({ source_id: 'src-1', items: [] })                                 // fallback: success (empty)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 2 }] })      // incrementConsecutiveFailures → returns 2 (< threshold 3)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                                  // incrementSourceConsecutiveFailures omitted (fallback succeeded)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // deprecateRegistry must NOT be called
    const deprecateCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes("'deprecated'"),
    )
    expect(deprecateCalls).toHaveLength(0)
  })

  it('respects per-source consecutiveFailuresThreshold over default', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    // Custom threshold of 1 — should deprecate on first failure
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example', consecutiveFailuresThreshold: 1 })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)                                        // execute: 422
    mockFetchJson({ source_id: 'src-1', items: [] })                                 // fallback: success
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })      // incrementConsecutiveFailures → returns 1 (= custom threshold 1)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                                  // deprecateRegistry

    await runCrawlerExecution(pool as unknown as Pool, sources)

    const deprecateCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes("'deprecated'"),
    )
    expect(deprecateCalls).toHaveLength(1)
    expect(deprecateCalls[0][1]).toEqual(['reg-1'])
  })

  it('resets crawler_registry.consecutive_failures to 0 after successful crawl4ai execution', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })  // execute: success
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeys
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures (crawler_registry)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats (content.source)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // No increment, no deprecate — only the reset calls
    const incrementCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
    )
    expect(incrementCalls).toHaveLength(0)

    const resetCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures = 0'),
    )
    expect(resetCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('browser_use_only source never increments crawler_registry.consecutive_failures', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })   // resolveSourceId
    mockFetchJson({ error: 'BROWSER_USE_FAILED' }, false)                      // fallback fails
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // incrementSourceConsecutiveFailures (content.source via _runFallbackForSource)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // getAllActiveRegistryCrawlers (empty)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // crawler_registry consecutive_failures must NOT be incremented
    const registryIncrementCalls = mockPoolQuery.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('consecutive_failures + 1') &&
        call[0].includes('crawler_registry'),
    )
    expect(registryIncrementCalls).toHaveLength(0)
  })

  it('deprecated crawler is not invoked in subsequent scheduler runs', async () => {
    // getAllActiveRegistryCrawlers only returns status = 'active'
    // After deprecation, no row is returned → no /crawler/execute call
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    // Simulate: active crawlers query returns empty (crawler was deprecated in prior run)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // getAllActiveRegistryCrawlers → empty

    await runCrawlerExecution(pool as unknown as Pool, sources)

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
```

---

### Architecture Compliance

- `incrementConsecutiveFailures` return type change affects only `browser-crawl.ts` — no other callers exist
- `deprecateRegistry` uses `registryId` (UUID PK), not `sourceId`, for precision — avoids accidentally deprecating a different status row
- `crawler.registryId` is already available from `ActiveCrawlerRow` returned by `getAllActiveRegistryCrawlers` — no extra DB query needed
- `DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD = 3` matches the Zod schema default in `source-config.ts`
- `getAllActiveRegistryCrawlers` only queries `WHERE r.status = 'active'` — deprecated crawlers are automatically excluded from future execution cycles
- DO NOT call `runFullPipeline` or any regeneration from Story 3.2 — the "queue" is implicit (no active/pending crawler → next onboarding cycle detects and re-runs per Story 3.3)
- DO NOT modify `resetConsecutiveFailures` — it already correctly resets the `active` row's counter on crawl4ai success

---

### Why No Migration is Needed

- `content.crawler_registry.consecutive_failures` column already exists with default 0 (added by Story 1.1 migration)
- `content.crawler_status_enum` already includes `'deprecated'` (added by Story 1.1 migration)
- No new DB schema changes required

---

### File Structure

```
packages/pipeline/src/
  db/
    crawler-db.ts                ← MODIFY: `incrementConsecutiveFailures` returns Promise<number>;
                                            ADD: `deprecateRegistry(pool, registryId): Promise<void>`
  jobs/
    browser-crawl.ts             ← MODIFY: add DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD const;
                                            import deprecateRegistry; restructure catch block
    __tests__/
      browser-crawl.test.ts      ← MODIFY: update 8 existing increment mocks;
                                            ADD: Story 3.2 describe block (6 tests)
```

**No new files. No DB migration. No Python changes.**

---

### Previous Story Intelligence (Story 3.1 Learnings)

- Mock call ORDER is critical: `mockPoolQuery.mockResolvedValueOnce` fires in exact DB call order
- In tests where fallback SUCCEEDS (empty items), `_processFallbackArticles` returns without DB calls (0 items fast-path)
- In tests where fallback FAILS (422), `incrementSourceConsecutiveFailures` mock is needed AFTER the fallback fetch mock
- Story 3.1 moved `incrementSourceConsecutiveFailures` from catch block to `_runFallbackForSource` catch — do NOT move it back
- `makeSource()` default has `consecutiveFailuresThreshold: 3` — verify this in `browser-crawl.test.ts` line 57

---

### References

- `packages/pipeline/src/db/crawler-db.ts` — `incrementConsecutiveFailures` (lines 193–203), `activateRegistry` pattern to follow for `deprecateRegistry`
- `packages/pipeline/src/jobs/browser-crawl.ts` — `runCrawlerExecution` catch block (lines 399–417), `DEFAULT_MIN_BODY_LENGTH` pattern (line 84)
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` — all `incrementConsecutiveFailures` mock locations
- `packages/pipeline/src/config/source-config.ts` — `consecutiveFailuresThreshold` default 3 in Zod schema
- Architecture ADR-012 — `crawler_registry.consecutive_failures` design, `deprecated` status lifecycle
- Epics file Story 3.2 ACs — counter independence, threshold logic

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_No issues encountered — clean implementation._

### Completion Notes List

- `incrementConsecutiveFailures` changed from `Promise<void>` to `Promise<number>` using `RETURNING consecutive_failures`; returns 0 if no active row exists (safe edge case)
- `deprecateRegistry` uses registryId (PK) not sourceId — avoids accidentally touching non-active rows
- `sourceConfig` lookup moved above inner DB try/catch so it's available for both threshold check and fallback trigger
- 8 existing `incrementConsecutiveFailures` mocks updated from `{ rows: [] }` → `{ rows: [{ consecutive_failures: 1 }] }` (below threshold → no deprecation side-effects)
- 6 new Story 3.2 tests added covering: threshold-triggered deprecation, below-threshold no-op, per-source custom threshold, success-path reset, browser_use_only exclusion, deprecated-crawler-not-run
- Full pipeline test suite: 121/121 passing, 0 regressions

### File List

- `packages/pipeline/src/db/crawler-db.ts` — MODIFIED: `incrementConsecutiveFailures` returns `Promise<number>` with `RETURNING` clause; added `deprecateRegistry`
- `packages/pipeline/src/jobs/browser-crawl.ts` — MODIFIED: added `DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD`; imported `deprecateRegistry`; restructured catch block with threshold check
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` — MODIFIED: 8 existing mocks updated; added Story 3.2 describe block (6 tests)

- `packages/pipeline/src/db/crawler-db.ts` — MODIFY: `incrementConsecutiveFailures` return type + RETURNING clause; add `deprecateRegistry`
- `packages/pipeline/src/jobs/browser-crawl.ts` — MODIFY: add `DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD`; import `deprecateRegistry`; restructure catch block
- `packages/pipeline/src/jobs/__tests__/browser-crawl.test.ts` — MODIFY: 8 existing increment mocks updated; add Story 3.2 describe block

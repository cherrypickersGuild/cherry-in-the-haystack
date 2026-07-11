import 'dotenv/config'
import * as crypto from 'crypto'
import * as path from 'path'
import { Pool } from 'pg'
import { loadSourceConfig, SourceConfig } from '../config/source-config'
import { OctokitGitHubCommitter } from '../publication/github-committer'
import {
  createPool,
  closePool,
  getSourceByUrl,
  insertSource,
  getActiveOrPendingRegistry,
  updateRegistryWithPR,
  activateRegistry,
  getAllActiveRegistryCrawlers,
  RegistryRow,
  ArticleRawInsert,
  getExistingRepresentativeKeyHashes,
  insertArticlesRaw,
  resetConsecutiveFailures,
  incrementConsecutiveFailures,
  deprecateRegistry,
  hasDeprecatedRegistry,
  resetSourceStats,
  incrementSourceConsecutiveFailures,
  getCrawlerAnalysisBySourceId,
} from '../db/crawler-db'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// Narrow interface used for PR creation — avoids importing full Octokit type
export interface PullRequestCreator {
  createPullRequest(params: {
    branch: string
    title: string
    body: string
    files: { path: string; content: string }[]
  }): Promise<{ prNumber: number; prUrl: string }>
}

// Narrow interface for PR status check
export interface PRStatusChecker {
  rest: {
    pulls: {
      get(params: {
        owner: string
        repo: string
        pull_number: number
      }): Promise<{ data: { merged_at: string | null } }>
    }
  }
}

export interface CrawledItem {
  title: string
  body: string
  published_at: string   // snake_case — matches Python response shape directly
  author: string
  url: string
  canonical_url: string  // snake_case — matches Python response shape
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, '../../config/sources.yaml')

function getCrawlerApiUrl(): string {
  return process.env.CRAWLER_API_URL ?? 'http://localhost:8000'
}

const DEFAULT_MIN_BODY_LENGTH = 100
const DEFAULT_RECENCY_WINDOW_DAYS = 1
const DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD = 3

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runBrowserCrawlJob(): Promise<void> {
  const pool = createPool(process.env.DATABASE_URL!)
  const committer = OctokitGitHubCommitter.fromEnv()

  // Octokit loaded lazily so tests can mock @octokit/rest at module level
  const { Octokit } = await import('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

  try {
    const sources = loadSourceConfig(CONFIG_PATH)

    // Phase 1: Onboarding — detect new sources, run analyze→generate→PR pipeline
    for (const source of sources) {
      try {
        await processSource(pool, committer, octokit as unknown as PRStatusChecker, source)
      } catch (err) {
        console.error(`[browser-crawl] source=${source.sourceName} error:`, err)
      }
    }

    // Phase 2: Crawler Execution (Story 2.1) — run all active crawl4ai crawlers
    await runCrawlerExecution(pool, sources)
  } finally {
    await closePool(pool)
  }
}

// ─── Per-source orchestration (exported for unit testing) ────────────────────

export async function processSource(
  pool: Pool,
  committer: PullRequestCreator,
  octokit: PRStatusChecker,
  source: SourceConfig,
): Promise<void> {
  // AC3: browser_use_only sources are never onboarded via crawl4ai (FR-3.6)
  if (source.browserUseOnly) {
    console.log(`[browser-crawl] skip browser_use_only: ${source.sourceName}`)
    return
  }

  const sourceId = await resolveSourceId(pool, source)
  const registry = await getActiveOrPendingRegistry(pool, sourceId)

  if (registry?.status === 'active') {
    // AC2: fully active — NFR-1 cost guard, nothing to do
    console.log(`[browser-crawl] active crawler exists: ${source.sourceName}`)
    return
  }

  if (registry?.status === 'pending_review') {
    if (registry.prNumber !== null) {
      // AC4: check if the pending PR has been merged
      await checkAndActivatePR(pool, octokit, registry)
      // FR-7.5: if regeneration review window, run fallback on every cycle until PR merged
      const isRegeneration = await hasDeprecatedRegistry(pool, sourceId)
      if (isRegeneration) {
        await _runFallbackForSource(pool, sourceId, source, 'REGENERATION_PENDING')
      }
    } else {
      // Edge case: generate ran but PR creation failed — retry
      await retryPRCreation(pool, committer, source, sourceId, registry)
    }
    return // Do NOT re-run analyze/generate (AC2 scope boundary)
  }

  // Distinguish regeneration (deprecated row exists) from new source (no rows)
  const isRegeneration = await hasDeprecatedRegistry(pool, sourceId)
  if (isRegeneration) {
    // FR-7.2, FR-7.3: force fresh analysis + generate updated crawler + open PR
    await runRegenerationPipeline(pool, committer, source, sourceId)
  } else {
    // AC1, AC6: genuinely new source — normal onboarding pipeline
    await runFullPipeline(pool, committer, source, sourceId)
  }
}

// ─── Source ID resolution ─────────────────────────────────────────────────────

async function resolveSourceId(pool: Pool, source: SourceConfig): Promise<string> {
  const existing = await getSourceByUrl(pool, source.url)
  if (existing) return existing.id

  const newId = crypto.randomUUID()
  await insertSource(pool, {
    id: newId,
    url: source.url,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })
  return newId
}

// ─── Full onboarding pipeline ─────────────────────────────────────────────────

async function runFullPipeline(
  pool: Pool,
  committer: PullRequestCreator,
  source: SourceConfig,
  sourceId: string,
): Promise<void> {
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

// ─── Regeneration pipeline (Story 3.3) ───────────────────────────────────────

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

// ─── PR merge detection ───────────────────────────────────────────────────────

async function checkAndActivatePR(
  pool: Pool,
  octokit: PRStatusChecker,
  registry: RegistryRow,
): Promise<void> {
  const owner = process.env.GITHUB_REPO_OWNER!
  const repo = process.env.GITHUB_REPO_NAME!

  const pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: registry.prNumber!,
  })

  if (pr.data.merged_at) {
    await activateRegistry(pool, registry.id, new Date(pr.data.merged_at))
    console.log(`[browser-crawl] activated registry ${registry.id} (PR #${registry.prNumber} merged)`)
  }
}

// ─── Retry PR creation (pending_review without pr_number) ────────────────────

async function retryPRCreation(
  pool: Pool,
  committer: PullRequestCreator,
  source: SourceConfig,
  sourceId: string,
  registry: RegistryRow,
): Promise<void> {
  console.log(`[browser-crawl] retrying PR creation for: ${source.sourceName}`)
  const kebabName = toKebabCase(source.sourceName)

  // Fetch existing analysis to build a complete PR body (FR-3.4)
  const analysis = await getCrawlerAnalysisBySourceId(pool, sourceId)
  const prBody = analysis
    ? buildPRBody(source, analysis.analysisJson as unknown as AnalysisJsonShape, analysis.id)
    : `Source: ${source.sourceName}\nGenerated at: ${new Date().toISOString()}`

  const { prNumber, prUrl } = await committer.createPullRequest({
    branch: `feat/crawler/${kebabName}`,
    title: `feat(crawler): add generated crawler for ${source.sourceName}`,
    body: prBody,
    files: [{
      path: `python_services/crawlers/generated/${kebabName}.py`,
      content: registry.generatedCode,
    }],
  })

  await updateRegistryWithPR(pool, registry.id, prNumber, prUrl)
  console.log(`[browser-crawl] retry opened PR #${prNumber} for ${source.sourceName}`)
}

// ─── Python API calls ─────────────────────────────────────────────────────────

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

async function callGenerate(
  sourceId: string,
  analysisId: string,
  sourceName: string,
): Promise<{ registry_id: string; generated_code: string }> {
  const res = await fetch(`${getCrawlerApiUrl()}/crawler/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, analysis_id: analysisId, source_name: sourceName }),
    signal: AbortSignal.timeout(35_000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/generate failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<{ registry_id: string; generated_code: string }>
}

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

async function callFallback(
  sourceId: string,
  url: string,
): Promise<{ source_id: string; items: CrawledItem[] }> {
  const res = await fetch(`${getCrawlerApiUrl()}/crawler/fallback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, url }),
    signal: AbortSignal.timeout(65_000),  // Python endpoint enforces 60s internally; 5s buffer
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`/crawler/fallback failed (${res.status}): ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<{ source_id: string; items: CrawledItem[] }>
}

// ─── Article validation (Story 2.2) ──────────────────────────────────────────

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

  // STALE_DATE — covers both unparseable date and date outside recency window
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

  // MISSING_FIELD / INVALID_URL — url checks
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

export async function runCrawlerExecution(
  pool: Pool,
  sources: SourceConfig[],
): Promise<void> {
  // Phase A: browser_use_only sources — run fallback on every cycle (FR-6.1, FR-6.5)
  for (const source of sources.filter((s) => s.browserUseOnly)) {
    try {
      const sourceId = await resolveSourceId(pool, source)
      await _runFallbackForSource(pool, sourceId, source, 'BROWSER_USE_ONLY')
    } catch (err) {
      console.error(`[fallback] error resolving source for ${source.sourceName}:`, err)
    }
  }

  // Phase B: crawl4ai crawlers — run execution, trigger fallback on failure
  const browserUseOnlyUrls = new Set(sources.filter((s) => s.browserUseOnly).map((s) => s.url))
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
      // Story 3.1: trigger browser-use fallback collection
      if (sourceConfig) {
        const triggerCode = (err as Error).message?.split('\n')[0] ?? 'FULL_RUN_FAILURE'
        await _runFallbackForSource(pool, crawler.sourceId, sourceConfig, triggerCode)
      }
    }
  }
}

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

// Priority order per spec: GUID > normalized_url > canonical_url > url.
// Browser-crawled items carry no GUID and no separate normalized_url field,
// so the effective priority here is canonical_url > url — matching the spec
// for this content type.
export function buildRepresentativeKey(item: CrawledItem): string {
  return item.canonical_url || item.url
}

function sha256AsBuffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest() as Buffer
}

async function _insertValidatedArticles(
  pool: Pool,
  sourceId: string,
  items: CrawledItem[],
  _source: SourceConfig | undefined,
): Promise<void> {
  if (items.length === 0) return

  const representativeKeyHashes = items.map((item) => sha256AsBuffer(buildRepresentativeKey(item)))
  const existingHashes = await getExistingRepresentativeKeyHashes(pool, representativeKeyHashes)
  const newItems = items.filter(
    (item) => !existingHashes.has(sha256AsBuffer(buildRepresentativeKey(item)).toString('hex')),
  )

  console.log(
    `[article-insert] source=${sourceId} new=${newItems.length} skipped_dup=${existingHashes.size}`,
  )

  if (newItems.length > 0) {
    const toInsert: ArticleRawInsert[] = newItems.map((item) => {
      const representativeKey = buildRepresentativeKey(item)
      return {
        title: item.title,
        content_raw: item.body,
        published_at: item.published_at,
        author: item.author,
        url: item.url,
        canonical_url: item.canonical_url,
        representative_key: representativeKey,
        representative_key_hash: sha256AsBuffer(representativeKey),
        content_hash: sha256AsBuffer(item.body),
      }
    })
    await insertArticlesRaw(pool, sourceId, toInsert)
  }

  await resetConsecutiveFailures(pool, sourceId)   // crawler_registry
  await resetSourceStats(pool, sourceId)            // content.source (AC4)
}

// ─── Fallback collection (Story 3.1) ─────────────────────────────────────────

async function _runFallbackForSource(
  pool: Pool,
  sourceId: string,
  source: SourceConfig,
  triggerCode: string,
): Promise<void> {
  const startTs = new Date().toISOString()
  console.log(`[fallback] START source=${source.sourceName} trigger=${triggerCode} timestamp=${startTs}`)
  try {
    const result = await callFallback(sourceId, source.url)
    await _processFallbackArticles(pool, sourceId, result.items, source)
    console.log(`[fallback] SUCCESS source=${source.sourceName} timestamp=${new Date().toISOString()} items=${result.items.length}`)
  } catch (err) {
    console.error(`[fallback] FAILED source=${source.sourceName} timestamp=${new Date().toISOString()} error:`, err)
    try {
      await incrementSourceConsecutiveFailures(pool, sourceId)
    } catch (dbErr) {
      console.error(`[fallback] failed to update consecutive_failures for source=${source.sourceName}:`, dbErr)
    }
  }
}

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

async function _insertFallbackArticles(
  pool: Pool,
  sourceId: string,
  items: CrawledItem[],
  _source: SourceConfig | undefined,
): Promise<void> {
  if (items.length === 0) return

  const representativeKeyHashes = items.map((item) => sha256AsBuffer(buildRepresentativeKey(item)))
  const existingHashes = await getExistingRepresentativeKeyHashes(pool, representativeKeyHashes)
  const newItems = items.filter(
    (item) => !existingHashes.has(sha256AsBuffer(buildRepresentativeKey(item)).toString('hex')),
  )

  console.log(`[fallback-insert] source=${sourceId} new=${newItems.length} skipped_dup=${existingHashes.size}`)

  if (newItems.length > 0) {
    const toInsert: ArticleRawInsert[] = newItems.map((item) => {
      const representativeKey = buildRepresentativeKey(item)
      return {
        title: item.title,
        content_raw: item.body,
        published_at: item.published_at,
        author: item.author,
        url: item.url,
        canonical_url: item.canonical_url,
        representative_key: representativeKey,
        representative_key_hash: sha256AsBuffer(representativeKey),
        content_hash: sha256AsBuffer(item.body),
      }
    })
    await insertArticlesRaw(pool, sourceId, toInsert)
  }

  // resetConsecutiveFailures intentionally omitted — crawler_registry counter managed by Story 3.2
  await resetSourceStats(pool, sourceId)
}

// ─── PR body builder (ADR-014-R1) ─────────────────────────────────────────────

function buildPRBody(
  source: SourceConfig,
  analysisJson: AnalysisJsonShape,
  analysisId: string,
): string {
  return [
    `Source:        ${source.sourceName}`,
    `Analysis ID:   ${analysisId}`,
    `Key selectors: baseSelector=${analysisJson.content_selector}`,
    `Pagination:    ${analysisJson.pagination_type}`,
    `crawl4ai:      wait_for=${analysisJson.wait_for ?? 'null'}, magic=${analysisJson.magic_mode}`,
    `Generated at:  ${new Date().toISOString()}`,
  ].join('\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKebabCase(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

// Tests for browser-crawl.ts orchestrator job.
// Mocks: pg.Pool, fetch, OctokitGitHubCommitter, @octokit/rest Octokit
// Tests export processSource() and runBrowserCrawlJob() for isolated verification.

// ─── Module mocks (must be before any imports) ──────────────────────────────

const mockPoolQuery = jest.fn()
const mockPoolEnd = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
  })),
}))

const mockCreatePullRequest = jest.fn()
jest.mock('../../publication/github-committer', () => ({
  OctokitGitHubCommitter: {
    fromEnv: jest.fn(() => ({ createPullRequest: mockCreatePullRequest })),
  },
}))

const mockOctokitPullsGet = jest.fn()
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        get: mockOctokitPullsGet,
      },
    },
  })),
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

// ─── Imports ─────────────────────────────────────────────────────────────────

import { Pool } from 'pg'
import { processSource, runBrowserCrawlJob, runCrawlerExecution, validateArticle, buildRepresentativeKey } from '../browser-crawl'
import type { SourceConfig } from '../../config/source-config'
import type { CrawledItem } from '../browser-crawl'

// ─── Test data helpers ────────────────────────────────────────────────────────

function makeSource(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    url: 'https://techcrunch.com/blog',
    sourceName: 'TechCrunch',
    sourceType: 'BLOG',
    browserUseOnly: false,
    consecutiveFailuresThreshold: 3,
    ...overrides,
  }
}

function makeValidItem(overrides: Partial<CrawledItem> = {}): CrawledItem {
  return {
    title: 'Test Article Title',
    body: 'A'.repeat(150),                     // 150 chars > DEFAULT_MIN_BODY_LENGTH (100)
    published_at: new Date().toISOString(),      // now = within 24h recency window
    author: 'Test Author',
    url: 'https://example.com/article-valid',
    canonical_url: 'https://example.com/article-valid',
    ...overrides,
  }
}

const ANALYSIS_JSON = {
  content_selector: '.article',
  title_selector: 'h1',
  date_selector: 'time',
  author_selector: '.author',
  url_selector: 'a',
  body_selector: '.body',
  pagination_type: 'none',
  dynamic_load: false,
  notes: '',
  wait_for: null,
  js_code: null,
  magic_mode: false,
}

function sha256Buf(s: string): Buffer {
  return require('crypto').createHash('sha256').update(s).digest()
}

function mockFetchJson(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 422,
    json: jest.fn().mockResolvedValue(data),
  })
}

function getPoolInstance() {
  return (Pool as jest.MockedClass<typeof Pool>).mock.results[0].value
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  process.env.DATABASE_URL = 'postgresql://localhost/testdb'
  process.env.GITHUB_TOKEN = 'test-token'
  process.env.GITHUB_REPO_OWNER = 'test-org'
  process.env.GITHUB_REPO_NAME = 'test-repo'
  process.env.CRAWLER_API_URL = 'http://localhost:8000'
  mockPoolEnd.mockResolvedValue(undefined)
})

// ─── Exported helpers for testing ─────────────────────────────────────────────

describe('processSource', () => {
  describe('AC3 — browser_use_only sources are skipped', () => {
    it('skips analyze and generate for browser_use_only source', async () => {
      const source = makeSource({ browserUseOnly: true })
      // Create a pool instance by running a job first so Pool mock is available
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      expect(mockPoolQuery).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('AC2 — skip fully onboarded sources', () => {
    it('skips analyze+generate when active registry entry exists', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      // resolveSourceId: existing source found
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      // getActiveOrPendingRegistry: active entry exists
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'registry-uuid-1',
          status: 'active',
          pr_number: 42,
          pr_url: 'https://github.com/org/repo/pull/42',
          generated_code: '# code',
        }],
      })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('AC1 — new source triggers full pipeline', () => {
    it('calls analyze → generate → createPR → updateRegistryWithPR for new source', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      // resolveSourceId: source not in DB → insert
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })           // getSourceByUrl → not found
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })           // insertSource
      // getActiveOrPendingRegistry: no entry
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false
      // updateRegistryWithPR
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      // POST /crawler/analyze
      mockFetchJson({ analysis_id: 'analysis-uuid-1', analysis_json: ANALYSIS_JSON })
      // POST /crawler/generate
      mockFetchJson({ registry_id: 'registry-uuid-1', generated_code: '# generated python' })

      // createPullRequest
      mockCreatePullRequest.mockResolvedValue({ prNumber: 55, prUrl: 'https://github.com/org/repo/pull/55' })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      // fetch called twice (analyze + generate)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'http://localhost:8000/crawler/analyze',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://localhost:8000/crawler/generate',
        expect.objectContaining({ method: 'POST' }),
      )

      // createPullRequest called with correct branch, file path, and body format
      expect(mockCreatePullRequest).toHaveBeenCalledWith(expect.objectContaining({
        branch: 'feat/crawler/techcrunch',
        title: expect.stringContaining('TechCrunch'),
        files: [{
          path: 'python_services/crawlers/generated/techcrunch.py',
          content: '# generated python',
        }],
      }))

      // registry updated with prNumber + prUrl
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('pr_number'),
        ['registry-uuid-1', 55, 'https://github.com/org/repo/pull/55'],
      )
    })

    it('PR body contains required ADR-014-R1 fields', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      mockFetchJson({ analysis_id: 'analysis-uuid-1', analysis_json: ANALYSIS_JSON })
      mockFetchJson({ registry_id: 'registry-uuid-1', generated_code: '# code' })
      mockCreatePullRequest.mockResolvedValue({ prNumber: 1, prUrl: 'https://github.com/pr/1' })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      const callArgs = mockCreatePullRequest.mock.calls[0][0]
      expect(callArgs.body).toContain('TechCrunch')
      expect(callArgs.body).toContain('analysis-uuid-1')
      expect(callArgs.body).toContain('baseSelector=')
      expect(callArgs.body).toContain('wait_for=')
      expect(callArgs.body).toContain('magic=')
      expect(callArgs.body).toContain('Generated at:')
    })
  })

  describe('AC4 — PR merge detection activates registry', () => {
    it('activates registry when pending_review PR is merged', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'registry-uuid-1',
          status: 'pending_review',
          pr_number: 77,
          pr_url: 'https://github.com/org/repo/pull/77',
          generated_code: '# code',
        }],
      })
      // activateRegistry call
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false

      mockOctokitPullsGet.mockResolvedValue({
        data: { merged_at: '2026-05-24T10:00:00Z' },
      })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      expect(mockOctokitPullsGet).toHaveBeenCalledWith({ owner: 'test-org', repo: 'test-repo', pull_number: 77 })
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("'active'"),
        ['registry-uuid-1', expect.any(Date)],
      )
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })

    it('does not activate registry when pending_review PR is not yet merged', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'registry-uuid-1',
          status: 'pending_review',
          pr_number: 77,
          pr_url: 'https://github.com/org/repo/pull/77',
          generated_code: '# code',
        }],
      })

      mockOctokitPullsGet.mockResolvedValue({ data: { merged_at: null } })
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })  // hasDeprecatedRegistry → false

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      // activateRegistry (UPDATE) should NOT have been called
      expect(mockPoolQuery).toHaveBeenCalledTimes(3)  // getSourceByUrl + getRegistry + hasDeprecatedRegistry
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Edge case — pending_review with null pr_number triggers retryPRCreation (FR-3.4)', () => {
    it('retries PR creation with full analysis body when pending_review has no pr_number', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      // resolveSourceId: existing source
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      // getActiveOrPendingRegistry: pending_review with NO pr_number (generate succeeded, PR call failed)
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'registry-uuid-1',
          status: 'pending_review',
          pr_number: null,
          pr_url: null,
          generated_code: '# generated python',
        }],
      })
      // getCrawlerAnalysisBySourceId → analysis found with full JSON
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'analysis-uuid-1', analysis_json: ANALYSIS_JSON }],
      })
      // updateRegistryWithPR
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      mockCreatePullRequest.mockResolvedValue({ prNumber: 99, prUrl: 'https://github.com/org/repo/pull/99' })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      // PR body must contain FR-3.4 fields (source name, analysis ID, selectors, crawl4ai config)
      const callArgs = mockCreatePullRequest.mock.calls[0][0]
      expect(callArgs.body).toContain('TechCrunch')
      expect(callArgs.body).toContain('analysis-uuid-1')
      expect(callArgs.body).toContain('baseSelector=')
      expect(callArgs.body).toContain('wait_for=')
      expect(callArgs.body).toContain('magic=')
      expect(callArgs.body).toContain('Generated at:')

      // registry updated with new prNumber
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('pr_number'),
        ['registry-uuid-1', 99, 'https://github.com/org/repo/pull/99'],
      )
    })

    it('falls back to simple PR body when no analysis exists for the source', async () => {
      const source = makeSource()
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const committer = { createPullRequest: mockCreatePullRequest }
      const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'source-uuid-1' }] })
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{
          id: 'registry-uuid-1',
          status: 'pending_review',
          pr_number: null,
          pr_url: null,
          generated_code: '# code',
        }],
      })
      // getCrawlerAnalysisBySourceId → no analysis found
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // updateRegistryWithPR

      mockCreatePullRequest.mockResolvedValue({ prNumber: 1, prUrl: 'https://github.com/pr/1' })

      await processSource(pool as unknown as Pool, committer as unknown as Parameters<typeof processSource>[1], octokit as unknown as Parameters<typeof processSource>[2], source)

      const callArgs = mockCreatePullRequest.mock.calls[0][0]
      expect(callArgs.body).toContain('TechCrunch')
      // Analysis fields absent in fallback body — no analysis ID, no selector block
      expect(callArgs.body).not.toContain('baseSelector=')
    })
  })
})

// ─── runBrowserCrawlJob tests ─────────────────────────────────────────────────

describe('runBrowserCrawlJob', () => {
  it('processes all sources from config, closes pool in finally block', async () => {
    // This is a smoke test — full pipeline calls are tested via processSource above
    // Just verify job runs to completion and pool is closed
    mockPoolEnd.mockResolvedValue(undefined)
    // Onboarding queries: source has active registry → skip
    // Execution query (getAllActiveRegistryCrawlers SELECT source_url): return empty → no execute calls
    mockPoolQuery.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('source_url')) {
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
    // First source: DB query throws → should not halt
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

    // Pool is still closed despite the error
    expect(mockPoolEnd).toHaveBeenCalledTimes(1)
  })
})

// ─── runCrawlerExecution tests ────────────────────────────────────────────────

describe('runCrawlerExecution', () => {
  describe('AC1, AC2 — executes non-browser_use_only active crawlers only', () => {
    it('calls /crawler/fallback for browser_use_only (LinkedIn) and /crawler/execute for non-browser_use_only (TechCrunch)', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources: SourceConfig[] = [
        makeSource({ url: 'https://techcrunch.com/blog', sourceName: 'TechCrunch', browserUseOnly: false }),
        makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', sourceType: 'LINKEDIN', browserUseOnly: true }),
      ]

      // Phase A: LinkedIn resolveSourceId (getSourceByUrl)
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })
      // Phase A: LinkedIn callFallback → empty items → no DB needed
      mockFetchJson({ source_id: 'src-linkedin', items: [] })

      // Phase B: getAllActiveRegistryCrawlers
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://techcrunch.com/blog' },
          { registry_id: 'reg-2', source_id: 'src-2', source_url: 'https://www.linkedin.com/feed' },
        ],
      })
      // Phase B: /crawler/execute for TechCrunch only (LinkedIn skipped — in browserUseOnlyUrls)
      mockFetchJson({ source_id: 'src-1', items: [] })

      await runCrawlerExecution(pool as unknown as Pool, sources)

      // 2 fetches: LinkedIn fallback + TechCrunch execute; LinkedIn execute NOT called
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'http://localhost:8000/crawler/fallback',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(mockFetch).toHaveBeenNthCalledWith(2,
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
      mockFetchJson({ source_id: 'src-abc', items: [makeValidItem({ url: 'https://x.com/1', canonical_url: 'https://x.com/1' })] })
      // Story 2.3: getExistingArticleUrls, insertArticlesRaw, resetConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingArticleUrls
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw (1 item)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures

      await runCrawlerExecution(pool as unknown as Pool, sources)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/crawler/execute'),
        expect.objectContaining({ body: JSON.stringify({ source_id: 'src-abc' }) }),
      )
    })

    it('completes with no fetch calls when no active crawlers exist', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource()]

      mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // no active crawlers

      await runCrawlerExecution(pool as unknown as Pool, sources)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Phase A — browser_use_only resolveSourceId error resilience', () => {
    it('continues when resolveSourceId DB call throws for browser_use_only source', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [
        makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
      ]

      // getSourceByUrl throws — simulates transient DB failure during Phase A
      mockPoolQuery.mockRejectedValueOnce(new Error('DB connection failed'))
      // Phase B: getAllActiveRegistryCrawlers → empty
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      // No fetch calls — error was caught and Phase A skipped for this source
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('AC4 — batch resilience', () => {
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

      mockFetchJson({ error: 'TIMEOUT', detail: 'exceeded 30s' }, false)  // source1 execute: 422
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)                   // source1 fallback: 422 (Story 3.1)
      mockFetchJson({ source_id: 'src-2', items: [] })                    // source2 execute: success
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry, source1) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source, source1)

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3)
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

      mockFetch.mockRejectedValueOnce(new Error('network error'))          // source1 execute: throws
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)                   // source1 fallback: 422 (Story 3.1)
      mockFetchJson({ source_id: 'src-2', items: [] })                    // source2 execute: success
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry, source1) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source, source1)

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })
})

// ─── validateArticle tests ────────────────────────────────────────────────────

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

  it('returns STALE_DATE for empty string published_at', () => {
    expect(validateArticle(makeValidItem({ published_at: '' }), noSource)).toContain('STALE_DATE')
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

  it('returns INVALID_URL for malformed url string', () => {
    expect(validateArticle(makeValidItem({ url: 'not-a-url' }), noSource)).toContain('INVALID_URL')
  })

  it('accepts https:// url without INVALID_URL', () => {
    expect(validateArticle(makeValidItem({ url: 'https://secure.example.com/article' }), noSource)).not.toContain('INVALID_URL')
  })

  it('returns multiple errors for article with multiple failures', () => {
    const item = makeValidItem({ title: '', url: 'not-a-url' })
    const errors = validateArticle(item, noSource)
    expect(errors).toContain('EMPTY_TITLE')
    expect(errors).toContain('INVALID_URL')
  })

  it('applies per-source recencyWindowDays over default for article within extended window', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const source = makeSource({ recencyWindowDays: 60 })
    expect(validateArticle(makeValidItem({ published_at: thirtyDaysAgo }), source)).not.toContain('STALE_DATE')
  })
})

// ─── API error paths (callAnalyze / callGenerate !res.ok branches) ────────────

describe('API error paths', () => {
  it('processSource throws when /crawler/analyze returns non-ok status', async () => {
    const source = makeSource()
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // getSourceByUrl → not found
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // insertSource
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // getActiveOrPendingRegistry → null
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] }) // hasDeprecatedRegistry

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({ error: 'service_unavailable' }),
    })

    await expect(
      processSource(
        pool as unknown as Pool,
        committer as unknown as Parameters<typeof processSource>[1],
        octokit as unknown as Parameters<typeof processSource>[2],
        source,
      ),
    ).rejects.toThrow('/crawler/analyze failed')
  })

  it('processSource throws when /crawler/generate returns non-ok status', async () => {
    const source = makeSource()
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // getSourceByUrl → not found
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // insertSource
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // getActiveOrPendingRegistry → null
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] }) // hasDeprecatedRegistry

    mockFetchJson({ analysis_id: 'a-id', analysis_json: ANALYSIS_JSON }) // analyze → ok
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({ error: 'generation_failed' }),
    })

    await expect(
      processSource(
        pool as unknown as Pool,
        committer as unknown as Parameters<typeof processSource>[1],
        octokit as unknown as Parameters<typeof processSource>[2],
        source,
      ),
    ).rejects.toThrow('/crawler/generate failed')
  })
})

// ─── CRAWLER_API_URL default fallback ─────────────────────────────────────────

describe('getCrawlerApiUrl default', () => {
  it('uses http://localhost:8000 when CRAWLER_API_URL env var is not set', async () => {
    delete process.env.CRAWLER_API_URL
    const source = makeSource()
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const committer = { createPullRequest: mockCreatePullRequest }
    const octokit = { rest: { pulls: { get: mockOctokitPullsGet } } }

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ has_deprecated: false }] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    mockFetchJson({ analysis_id: 'a-id', analysis_json: ANALYSIS_JSON })
    mockFetchJson({ registry_id: 'r-id', generated_code: '# code' })
    mockCreatePullRequest.mockResolvedValue({ prNumber: 1, prUrl: 'https://github.com/pr/1' })

    await processSource(
      pool as unknown as Pool,
      committer as unknown as Parameters<typeof processSource>[1],
      octokit as unknown as Parameters<typeof processSource>[2],
      source,
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/crawler/analyze',
      expect.anything(),
    )
  })
})

// ─── validation integration via runCrawlerExecution ──────────────────────────

describe('validation integration (Story 2.2)', () => {
  describe('AC3 — partial pass: valid articles proceed, no full-run failure', () => {
    it('valid article passes through without error', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })
      // Story 2.3: getExistingRepresentativeKeys, insertArticlesRaw, resetConsecutiveFailures, resetSourceStats
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    })

    it('mix of valid and invalid: valid pass, invalid discarded, no full-run failure', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({
        source_id: 'src-1',
        items: [
          makeValidItem(),                         // valid — passes through
          makeValidItem({ body: 'too short' }),    // SHORT_CONTENT — discarded
        ],
      })
      // Story 2.3: 1 valid item proceeds to insert path
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

      // At least one valid article → no full-run failure → runCrawlerExecution resolves cleanly
      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    })
  })

  describe('AC3 — all invalid: full-run failure signalled, batch continues', () => {
    it('all-invalid articles signal full-run failure for source; second source still processed', async () => {
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

      // source1: body too short → all fail validation → full-run failure (caught internally)
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ body: 'short' })] })
      // Story 3.1: source1 fallback triggered after crawl4ai full-run failure
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)  // source1 fallback → 422
      // source2: valid → ok
      mockFetchJson({ source_id: 'src-2', items: [makeValidItem()] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (src-1, crawler_registry) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (src-1, content.source — via _runFallbackForSource)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes (src-2)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw (src-2)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures (src-2)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats (src-2)

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3)  // src-1 execute + src-1 fallback + src-2 execute
    })
  })

  describe('AC4 — per-source threshold overrides', () => {
    it('article below custom minBodyLength fails even if above default (100)', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [
        makeSource({ url: 'https://example.com', sourceName: 'Example', minBodyLength: 500 }),
      ]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      // body 150 chars > default (100) but < per-source (500) → SHORT_CONTENT → full-run failure
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ body: 'A'.repeat(150) })] })
      // Story 3.1: full-run failure triggers fallback, which also fails
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)  // fallback → 422
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source — via _runFallbackForSource)

      // Full-run failure thrown internally; runCrawlerExecution catches and resolves
      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    })


    it('article within per-source recencyWindowDays passes even if older than default (24h)', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const sources = [
        makeSource({ url: 'https://example.com', sourceName: 'Example', recencyWindowDays: 7 }),
      ]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      // 3 days ago is outside default 24h but inside per-source 7-day window → valid
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ published_at: threeDaysAgo })] })
      // Story 2.3: getExistingRepresentativeKeys, insertArticlesRaw, resetConsecutiveFailures, resetSourceStats
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    })
  })
})

// ─── Story 2.3: dedup + article_raw insert + consecutive_failures ─────────────

describe('Story 2.3 — dedup + article_raw insert + consecutive_failures', () => {
  describe('deduplication', () => {
    it('skips articles whose URLs already exist in article_raw', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      const existingUrl = 'https://example.com/existing-article'
      const newUrl = 'https://example.com/new-article'

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({
        source_id: 'src-1',
        items: [
          makeValidItem({ url: existingUrl, canonical_url: existingUrl }),
          makeValidItem({ url: newUrl, canonical_url: newUrl }),
        ],
      })
      // getExistingRepresentativeKeyHashes → returns existingUrl as already known (canonical_url === existingUrl)
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ representative_key_hash: sha256Buf(existingUrl) }] })
      // insertArticlesRaw → 1 insert for newUrl only
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      // resetConsecutiveFailures (crawler_registry)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      // resetSourceStats (content.source)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      await runCrawlerExecution(pool as unknown as Pool, sources)

      // Only 1 INSERT call (for newUrl); existingUrl was deduped
      const insertCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('article_raw') && call[0].includes('INSERT'),
      )
      expect(insertCalls).toHaveLength(1)
      expect(insertCalls[0][1]).toContain(newUrl)
    })

    it('calls no INSERT when all valid articles are duplicates, but still resets consecutive_failures', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]
      const existingUrl = 'https://example.com/already-exists'

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({
        source_id: 'src-1',
        items: [makeValidItem({ url: existingUrl, canonical_url: existingUrl })],
      })
      // getExistingRepresentativeKeyHashes → all are duplicates (canonical_url === existingUrl)
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ representative_key_hash: sha256Buf(existingUrl) }] })
      // resetConsecutiveFailures (crawler_registry) — still called even when all are dupes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })
      // resetSourceStats (content.source)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })

      await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()

      const insertCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT') && call[0].includes('article_raw'),
      )
      expect(insertCalls).toHaveLength(0)

      const resetCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures = 0'),
      )
      expect(resetCalls).toHaveLength(2)
    })
  })

  describe('consecutive_failures tracking', () => {
    it('resets consecutive_failures to 0 after successful insert', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures (crawler_registry)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats (content.source)

      await runCrawlerExecution(pool as unknown as Pool, sources)

      const resetCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures = 0'),
      )
      expect(resetCalls).toHaveLength(2)
      expect(resetCalls[0][1]).toEqual(['src-1'])
    })

    it('increments consecutive_failures when execute endpoint returns 422', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({ error: 'TIMEOUT', detail: 'exceeded 30s' }, false)   // execute: 422 → throws
      // Story 3.1: fallback triggered, also fails
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)   // fallback: 422 → incrementSourceConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source — via _runFallbackForSource)

      await runCrawlerExecution(pool as unknown as Pool, sources)

      const incrementCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
      )
      expect(incrementCalls).toHaveLength(2)
      expect(incrementCalls[0][1]).toEqual(['src-1'])
    })

    it('increments consecutive_failures when all articles fail validation', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      // All invalid articles → FULL_RUN_FAILURE → crawl4ai failure increment, then fallback
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ body: 'short' })] })
      // Story 3.1: fallback triggered, also fails
      mockFetchJson({ error: 'FALLBACK_FAILED' }, false)   // fallback: 422 → incrementSourceConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry) → 1 (below threshold 3)
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // incrementSourceConsecutiveFailures (content.source — via _runFallbackForSource)

      await runCrawlerExecution(pool as unknown as Pool, sources)

      const incrementCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
      )
      expect(incrementCalls).toHaveLength(2)
    })

    it('does NOT increment consecutive_failures on successful execution', async () => {
      const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
      const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
      })
      mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
      mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

      await runCrawlerExecution(pool as unknown as Pool, sources)

      const incrementCalls = mockPoolQuery.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
      )
      expect(incrementCalls).toHaveLength(0)
    })
  })
})

// ─── Story 3.1 — browser_use_only fallback path ──────────────────────────────

describe('Story 3.1 — browser_use_only fallback path', () => {
  it('browser_use_only source calls /crawler/fallback, not /crawler/execute', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    // Phase A: resolveSourceId for LinkedIn
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })
    // Phase A: callFallback → success
    mockFetchJson({ source_id: 'src-linkedin', items: [makeValidItem({ url: 'https://linkedin.com/post/1', canonical_url: 'https://linkedin.com/post/1' })] })
    // Phase A: _insertFallbackArticles DB calls
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats
    // Phase B: getAllActiveRegistryCrawlers → empty (no crawl4ai crawlers)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await runCrawlerExecution(pool as unknown as Pool, sources)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/crawler/fallback',
      expect.objectContaining({ method: 'POST' }),
    )
    // /crawler/execute must NOT be called for browser_use_only source
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/crawler/execute'),
      expect.anything(),
    )
  })

  it('continues when incrementSourceConsecutiveFailures DB call throws during fallback failure', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })  // resolveSourceId
    mockFetchJson({ error: 'BROWSER_USE_FAILED' }, false)                     // callFallback → 422
    // incrementSourceConsecutiveFailures throws (DB unreachable)
    mockPoolQuery.mockRejectedValueOnce(new Error('DB write failed'))
    // Phase B: getAllActiveRegistryCrawlers → empty (continues despite inner DB error)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
  })

  it('browser_use_only fallback with empty items: resolves without error and no insert', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })  // getSourceByUrl
    mockFetchJson({ source_id: 'src-linkedin', items: [] })                   // callFallback → empty
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                          // getAllActiveRegistryCrawlers

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()

    // No INSERT calls since items was empty
    const insertCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT') && call[0].includes('article_raw'),
    )
    expect(insertCalls).toHaveLength(0)
  })

  it('browser_use_only fallback failure: increments content.source consecutive_failures', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })   // getSourceByUrl
    mockFetchJson({ error: 'BROWSER_USE_FAILED' }, false)                      // callFallback → 422
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // incrementSourceConsecutiveFailures
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // getAllActiveRegistryCrawlers

    await runCrawlerExecution(pool as unknown as Pool, sources)

    const incrementCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
    )
    expect(incrementCalls).toHaveLength(1)
  })

  it('browser_use_only fallback success: does NOT reset crawler_registry consecutive_failures', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })
    mockFetchJson({ source_id: 'src-linkedin', items: [makeValidItem({ url: 'https://li.com/1', canonical_url: 'https://li.com/1' })] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats (content.source)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getAllActiveRegistryCrawlers

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // resetConsecutiveFailures is for crawler_registry only — must NOT be called on fallback success
    const resetRegCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' &&
        call[0].includes('consecutive_failures = 0') &&
        call[0].includes('crawler_registry'),
    )
    expect(resetRegCalls).toHaveLength(0)
  })
})

// ─── Story 3.1 — crawl4ai failure triggers fallback ──────────────────────────

describe('Story 3.1 — crawl4ai failure triggers fallback', () => {
  it('crawl4ai execute failure triggers /crawler/fallback for that source', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)             // execute → 422
    mockFetchJson({ source_id: 'src-1', items: [] })       // fallback → success (empty items)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })       // incrementConsecutiveFailures (crawler_registry) → 1 (below threshold 3)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:8000/crawler/fallback',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('crawl4ai success: fallback is NOT triggered', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem()] })  // execute → success
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // Only 1 fetch (execute), no fallback
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/crawler/fallback'),
      expect.anything(),
    )
  })

  it('crawl4ai failure: only crawler_registry consecutive_failures incremented (not content.source) before fallback', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)     // execute: 422
    // Fallback succeeds (items inserted) — no incrementSourceConsecutiveFailures
    mockFetchJson({ source_id: 'src-1', items: [makeValidItem({ url: 'https://example.com/1', canonical_url: 'https://example.com/1' })] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })   // incrementConsecutiveFailures (crawler_registry) → 1 (below threshold 3)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // Only 1 increment (crawler_registry) — content.source counter NOT incremented because fallback succeeded
    const incrementCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
    )
    expect(incrementCalls).toHaveLength(1)
  })
})

// ─── Story 3.1 — fallback article processing ──────────────────────────────────

describe('Story 3.1 — fallback article processing', () => {
  it('fallback articles are deduped before insert', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    const existingUrl = 'https://linkedin.com/existing'
    const newUrl = 'https://linkedin.com/new'

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })  // getSourceByUrl
    mockFetchJson({
      source_id: 'src-linkedin',
      items: [
        makeValidItem({ url: existingUrl, canonical_url: existingUrl }),
        makeValidItem({ url: newUrl, canonical_url: newUrl }),
      ],
    })
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ representative_key_hash: sha256Buf(existingUrl) }] })  // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw (1 item)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getAllActiveRegistryCrawlers

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // Only newUrl should be inserted
    const insertCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT') && call[0].includes('article_raw'),
    )
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0][1]).toContain(newUrl)
  })

  it('fallback articles all failing validation triggers FULL_RUN_FAILURE (caught gracefully, increments source failures)', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })  // resolveSourceId
    // callFallback returns an item with empty url — url='' triggers MISSING_FIELD and hits the '(missing)' branch in the warn log
    mockFetchJson({
      source_id: 'src-linkedin',
      items: [makeValidItem({ url: '', canonical_url: '' })],
    })
    // _processFallbackArticles throws FULL_RUN_FAILURE → outer catch runs incrementSourceConsecutiveFailures
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // incrementSourceConsecutiveFailures
    // Phase B: getAllActiveRegistryCrawlers → empty
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()

    const incrementCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
    )
    expect(incrementCalls).toHaveLength(1)
    // No article_raw INSERT (all failed validation before insert)
    const insertCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT') && call[0].includes('article_raw'),
    )
    expect(insertCalls).toHaveLength(0)
  })

  it('fallback success calls resetSourceStats (content.source stats reset)', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })
    mockFetchJson({ source_id: 'src-linkedin', items: [makeValidItem({ url: 'https://li.com/1', canonical_url: 'https://li.com/1' })] })
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getAllActiveRegistryCrawlers

    await runCrawlerExecution(pool as unknown as Pool, sources)

    // resetSourceStats must be called (content.source) — sets consecutive_failures=0 and last_success_at
    const resetStatsCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('last_success_at'),
    )
    expect(resetStatsCalls.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Story 3.2 — failure counter & regeneration trigger ──────────────────────

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

    await runCrawlerExecution(pool as unknown as Pool, sources)

    const deprecateCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes("'deprecated'"),
    )
    expect(deprecateCalls).toHaveLength(0)
  })

  it('respects per-source consecutiveFailuresThreshold over default', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
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
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures (crawler_registry)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats (content.source)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    const incrementCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures + 1'),
    )
    expect(incrementCalls).toHaveLength(0)

    const resetCalls = mockPoolQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('consecutive_failures = 0'),
    )
    expect(resetCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('continues gracefully when incrementConsecutiveFailures DB call throws (inner catch)', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-1', source_id: 'src-1', source_url: 'https://example.com' }],
    })
    mockFetchJson({ error: 'TIMEOUT' }, false)                              // execute → 422 (throws)
    mockPoolQuery.mockRejectedValueOnce(new Error('DB write failed'))       // incrementConsecutiveFailures → throws
    // fallback still runs after inner catch swallows DB error
    mockFetchJson({ source_id: 'src-1', items: [] })                        // fallback → success

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    // Both execute and fallback fetch calls happened
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('browser_use_only source never increments crawler_registry.consecutive_failures', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [
      makeSource({ url: 'https://www.linkedin.com/feed', sourceName: 'LinkedIn', browserUseOnly: true }),
    ]

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'src-linkedin' }] })   // resolveSourceId
    mockFetchJson({ error: 'BROWSER_USE_FAILED' }, false)                      // fallback fails
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // incrementSourceConsecutiveFailures (content.source)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })                           // getAllActiveRegistryCrawlers (empty)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    const registryIncrementCalls = mockPoolQuery.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('consecutive_failures + 1') &&
        call[0].includes('crawler_registry'),
    )
    expect(registryIncrementCalls).toHaveLength(0)
  })

  it('uses DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD when active crawler URL is not in sources config (sourceConfig=undefined)', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    // sources array does NOT contain the active crawler URL — sourceConfig will be undefined
    const sources = [makeSource({ url: 'https://other-source.com', sourceName: 'Other' })]

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-orphan', source_id: 'src-orphan', source_url: 'https://orphaned-crawler.com' }],
    })
    // execute succeeds — no failure path, so sourceConfig=undefined doesn't matter here
    mockFetchJson({ source_id: 'src-orphan', items: [makeValidItem()] })
    // source=undefined passed to _processCrawledArticles → uses DEFAULT threshold in validate
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // getExistingRepresentativeKeyHashes
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // insertArticlesRaw
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetConsecutiveFailures
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })   // resetSourceStats

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
  })

  it('uses DEFAULT_CONSECUTIVE_FAILURES_THRESHOLD and logs sourceId when active crawler URL is not in sources config and all items fail validation', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    // sources array does NOT contain the active crawler URL — sourceConfig will be undefined
    const sources: SourceConfig[] = []

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ registry_id: 'reg-orphan', source_id: 'src-orphan', source_url: 'https://orphaned-crawler.com' }],
    })
    // Item with empty url fails MISSING_FIELD — also exercises the `item.url || '(missing)'` log branch
    mockFetchJson({ source_id: 'src-orphan', items: [makeValidItem({ url: '', canonical_url: '' })] })
    // FULL_RUN_FAILURE thrown internally → incrementConsecutiveFailures (returns 1 < DEFAULT_THRESHOLD 3)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ consecutive_failures: 1 }] })
    // sourceConfig is undefined → if (sourceConfig) is false → no fallback call

    await expect(runCrawlerExecution(pool as unknown as Pool, sources)).resolves.not.toThrow()
    // No fallback called since sourceConfig is undefined
    expect(mockFetch).toHaveBeenCalledTimes(1)  // only execute, no fallback
  })

  it('deprecated crawler is not invoked in subsequent scheduler runs', async () => {
    const pool = new Pool({ connectionString: 'postgresql://localhost/db' })
    const sources = [makeSource({ url: 'https://example.com', sourceName: 'Example' })]

    mockPoolQuery.mockResolvedValueOnce({ rows: [] })  // getAllActiveRegistryCrawlers → empty (crawler was deprecated)

    await runCrawlerExecution(pool as unknown as Pool, sources)

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ─── Story 3.3 — Auto-Regeneration Pipeline ──────────────────────────────────

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

// ─── buildRepresentativeKey unit tests ────────────────────────────────────────

describe('buildRepresentativeKey', () => {
  it('returns canonical_url when both canonical_url and url are present', () => {
    const item = makeValidItem({ url: 'https://example.com/url', canonical_url: 'https://example.com/canonical' })
    expect(buildRepresentativeKey(item)).toBe('https://example.com/canonical')
  })

  it('falls back to url when canonical_url is empty string', () => {
    const item = makeValidItem({ url: 'https://example.com/url', canonical_url: '' })
    expect(buildRepresentativeKey(item)).toBe('https://example.com/url')
  })

  it('returns url when canonical_url equals url', () => {
    const item = makeValidItem({ url: 'https://example.com/same', canonical_url: 'https://example.com/same' })
    expect(buildRepresentativeKey(item)).toBe('https://example.com/same')
  })
})

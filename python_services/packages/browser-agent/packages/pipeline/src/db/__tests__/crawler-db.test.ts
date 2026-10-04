// Tests for crawler-db.ts — pg mock-based unit tests

const mockQuery = jest.fn()
const mockEnd = jest.fn()

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
      end: mockEnd,
    })),
  }
})

import { Pool } from 'pg'
import {
  createPool,
  closePool,
  getSourceByUrl,
  insertSource,
  getActiveOrPendingRegistry,
  updateRegistryWithPR,
  activateRegistry,
  getAllActiveRegistryCrawlers,
  getExistingRepresentativeKeyHashes,
  insertArticlesRaw,
  resetConsecutiveFailures,
  incrementConsecutiveFailures,
  resetSourceStats,
  incrementSourceConsecutiveFailures,
  getCrawlerAnalysisBySourceId,
  hasDeprecatedRegistry,
} from '../crawler-db'

const getPoolInstance = () => (Pool as jest.MockedClass<typeof Pool>).mock.results[0].value

describe('createPool', () => {
  it('creates a pg Pool with the given connection string', () => {
    const pool = createPool('postgresql://user:pass@localhost/testdb')
    expect(Pool).toHaveBeenCalledWith({ connectionString: 'postgresql://user:pass@localhost/testdb' })
    expect(pool).toBeDefined()
  })
})

describe('closePool', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls pool.end()', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockEnd.mockResolvedValue(undefined)
    await closePool(pool)
    expect(mockEnd).toHaveBeenCalledTimes(1)
  })
})

describe('getSourceByUrl', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns { id } when source exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [{ id: 'source-uuid-123' }] })
    const result = await getSourceByUrl(pool, 'https://example.com/blog')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.source'),
      ['https://example.com/blog'],
    )
    expect(result).toEqual({ id: 'source-uuid-123' })
  })

  it('returns null when source does not exist', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const result = await getSourceByUrl(pool, 'https://unknown.com')
    expect(result).toBeNull()
  })
})

describe('insertSource', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts a new source row and returns the id', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const returned = await insertSource(pool, {
      id: 'new-uuid-456',
      url: 'https://techcrunch.com',
      sourceName: 'TechCrunch',
      sourceType: 'BLOG',
    })
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.source'),
      expect.arrayContaining(['new-uuid-456', 'https://techcrunch.com', 'TechCrunch', 'BLOG']),
    )
    expect(returned).toBe('new-uuid-456')
  })
})

describe('getActiveOrPendingRegistry', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns registry row when active entry exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'registry-uuid-1',
        status: 'active',
        pr_number: 42,
        pr_url: 'https://github.com/org/repo/pull/42',
        generated_code: '# crawler code',
      }],
    })
    const result = await getActiveOrPendingRegistry(pool, 'source-uuid-123')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.crawler_registry'),
      ['source-uuid-123'],
    )
    expect(result).toEqual({
      id: 'registry-uuid-1',
      status: 'active',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      generatedCode: '# crawler code',
    })
  })

  it('returns pending_review row with null prNumber', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'registry-uuid-2',
        status: 'pending_review',
        pr_number: null,
        pr_url: null,
        generated_code: '# generated',
      }],
    })
    const result = await getActiveOrPendingRegistry(pool, 'source-uuid-123')
    expect(result).toEqual({
      id: 'registry-uuid-2',
      status: 'pending_review',
      prNumber: null,
      prUrl: null,
      generatedCode: '# generated',
    })
  })

  it('returns null when no active or pending_review entry exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const result = await getActiveOrPendingRegistry(pool, 'source-uuid-999')
    expect(result).toBeNull()
  })
})

describe('updateRegistryWithPR', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates pr_number and pr_url for the registry row', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await updateRegistryWithPR(pool, 'registry-uuid-1', 99, 'https://github.com/org/repo/pull/99')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('pr_number'),
      ['registry-uuid-1', 99, 'https://github.com/org/repo/pull/99'],
    )
  })
})

describe('activateRegistry', () => {
  beforeEach(() => jest.clearAllMocks())

  it("sets status='active' and pr_merged_at on the registry row", async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const mergedAt = new Date('2026-05-24T12:00:00Z')
    await activateRegistry(pool, 'registry-uuid-1', mergedAt)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("'active'"),
      ['registry-uuid-1', mergedAt],
    )
  })
})

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
    // No params array — query called with SQL string only
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

// ─── Story 2.3: article_raw + consecutive_failures ───────────────────────────

describe('getExistingRepresentativeKeyHashes', () => {
  beforeEach(() => jest.clearAllMocks())

  const makeHash = (s: string) => require('crypto').createHash('sha256').update(s).digest()

  it('returns empty Set without querying DB when hashes array is empty', async () => {
    const pool = createPool('postgresql://localhost/db')
    const result = await getExistingRepresentativeKeyHashes(pool, [])
    expect(mockQuery).not.toHaveBeenCalled()
    expect(result).toEqual(new Set())
  })

  it('returns Set of hex hashes that already exist in article_raw', async () => {
    const pool = createPool('postgresql://localhost/db')
    const existingHash = makeHash('https://example.com/article-1')
    mockQuery.mockResolvedValue({ rows: [{ representative_key_hash: existingHash }] })
    const hashes = [
      makeHash('https://example.com/article-1'),
      makeHash('https://example.com/article-2'),
    ]
    const result = await getExistingRepresentativeKeyHashes(pool, hashes)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('representative_key_hash'),
      [hashes],
    )
    expect(result).toEqual(new Set([existingHash.toString('hex')]))
  })

  it('returns empty Set when none of the hashes exist', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const result = await getExistingRepresentativeKeyHashes(pool, [makeHash('https://new.com/article')])
    expect(result).toEqual(new Set())
  })

  it('uses ANY($1) with the hashes array as a single parameter', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const hashes = [makeHash('https://a.com'), makeHash('https://b.com')]
    await getExistingRepresentativeKeyHashes(pool, hashes)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ANY($1)'),
      [hashes],
    )
  })
})

describe('insertArticlesRaw', () => {
  beforeEach(() => jest.clearAllMocks())

  const sha256 = (s: string) => require('crypto').createHash('sha256').update(s).digest()
  const makeItem = (url: string) => ({
    title: 'Test Article',
    content_raw: 'Body content here',
    published_at: '2026-05-24',
    author: 'Author Name',
    url,
    canonical_url: url,
    representative_key: url,
    representative_key_hash: sha256(url),
    content_hash: Buffer.from('a'.repeat(32)),
  })

  it('does not call query when items array is empty', async () => {
    const pool = createPool('postgresql://localhost/db')
    await insertArticlesRaw(pool, 'source-uuid-1', [])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('calls query once for a single item with all 11 fields', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    const item = makeItem('https://example.com/article-1')
    await insertArticlesRaw(pool, 'source-uuid-1', [item])
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.article_raw'),
      expect.arrayContaining([
        'source-uuid-1',
        item.title,
        item.content_raw,
        item.published_at,
        item.author,
        item.url,
        item.canonical_url,
        item.representative_key,
        item.representative_key_hash,
        item.content_hash,
      ]),
    )
  })

  it('calls query once per item for multiple items', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await insertArticlesRaw(pool, 'source-uuid-1', [
      makeItem('https://example.com/article-1'),
      makeItem('https://example.com/article-2'),
    ])
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('uses ON CONFLICT DO NOTHING to handle duplicate representative_key_hash gracefully', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await insertArticlesRaw(pool, 'source-uuid-1', [makeItem('https://example.com/article-1')])
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      expect.any(Array),
    )
  })
})

describe('resetConsecutiveFailures', () => {
  beforeEach(() => jest.clearAllMocks())

  it("sets consecutive_failures = 0 for the active registry of the given source", async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await resetConsecutiveFailures(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('consecutive_failures = 0'),
      ['source-uuid-1'],
    )
  })

  it("only targets rows with status = 'active'", async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await resetConsecutiveFailures(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("'active'"),
      expect.any(Array),
    )
  })
})

describe('incrementConsecutiveFailures', () => {
  beforeEach(() => jest.clearAllMocks())

  it("increments consecutive_failures by 1 for the active registry of the given source", async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await incrementConsecutiveFailures(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('consecutive_failures + 1'),
      ['source-uuid-1'],
    )
  })

  it("only targets rows with status = 'active'", async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await incrementConsecutiveFailures(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("'active'"),
      expect.any(Array),
    )
  })
})

describe('resetSourceStats', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets consecutive_failures = 0 and last_success_at = NOW() on content.source', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await resetSourceStats(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.source'),
      ['source-uuid-1'],
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('consecutive_failures = 0'),
      expect.any(Array),
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('last_success_at'),
      expect.any(Array),
    )
  })
})

describe('incrementSourceConsecutiveFailures', () => {
  beforeEach(() => jest.clearAllMocks())

  it('increments consecutive_failures by 1 on content.source', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })
    await incrementSourceConsecutiveFailures(pool, 'source-uuid-1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('content.source'),
      ['source-uuid-1'],
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('consecutive_failures + 1'),
      expect.any(Array),
    )
  })
})

// ─── getCrawlerAnalysisBySourceId (Story 1.5 retry path) ─────────────────────

describe('getCrawlerAnalysisBySourceId', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns analysis id and json when row exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    const analysisJson = { content_selector: '.article', title_selector: 'h1' }
    mockQuery.mockResolvedValue({
      rows: [{ id: 'analysis-uuid-1', analysis_json: analysisJson }],
    })

    const result = await getCrawlerAnalysisBySourceId(pool, 'source-uuid-1')

    expect(result).toEqual({ id: 'analysis-uuid-1', analysisJson })
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('crawler_analysis'),
      ['source-uuid-1'],
    )
  })

  it('returns null when no analysis exists for the source', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })

    const result = await getCrawlerAnalysisBySourceId(pool, 'source-uuid-1')

    expect(result).toBeNull()
  })
})

// ─── hasDeprecatedRegistry ────────────────────────────────────────────────────

describe('hasDeprecatedRegistry', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when a deprecated registry row exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [{ has_deprecated: true }] })

    const result = await hasDeprecatedRegistry(pool, 'source-uuid-1')

    expect(result).toBe(true)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('deprecated'),
      ['source-uuid-1'],
    )
  })

  it('returns false when no deprecated registry row exists', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [{ has_deprecated: false }] })

    const result = await hasDeprecatedRegistry(pool, 'source-uuid-1')

    expect(result).toBe(false)
  })

  it('returns false via nullish coalescing when query returns no rows', async () => {
    const pool = createPool('postgresql://localhost/db')
    mockQuery.mockResolvedValue({ rows: [] })

    const result = await hasDeprecatedRegistry(pool, 'source-uuid-1')

    expect(result).toBe(false)
  })
})

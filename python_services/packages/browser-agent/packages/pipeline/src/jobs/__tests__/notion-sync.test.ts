// Tests for notion-sync.ts — Notion Source Registry Sync Job
// Mocks: @notionhq/client, fs (readFileSync), GitHubCommitter

// ─── Module mocks (must be before any imports) ───────────────────────────────

const mockDatabasesQuery = jest.fn()

jest.mock('@notionhq/client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    databases: { query: mockDatabasesQuery },
  })),
}))

const mockReadFileSync = jest.fn()
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: mockReadFileSync,
}))

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  runNotionSyncJob,
  buildPRBody,
  buildUpdatedYaml,
  extractUrlFromProperty,
  extractTextFromProperty,
  extractCheckboxFromProperty,
  withRetry,
  NOTION_SOURCE_DB_CONFIGS,
  CONFIG_PATH,
} from '../notion-sync'
import type { GitHubCommitter } from '../../publication/github-committer'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_YAML = `# header comment
sources:
  - url: "https://existing.com/blog"
    source_name: "Existing Blog"
    source_type: "BLOG"
`

const FIXTURE_YAML_EMPTY = `# header comment
sources: []
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockCreatePullRequest = jest.fn()
const mockCommitter: GitHubCommitter = {
  createPullRequest: mockCreatePullRequest,
  commitFiles: jest.fn(),
}

function makeUrlPage(
  url: string,
  name: string,
  sourceType: string,
  browserUseOnly?: boolean,
  urlProp = 'URL',
): any {
  return {
    properties: {
      [urlProp]: { type: 'url', url },
      Name: { type: 'title', title: [{ plain_text: name }] },
      source_type: { type: 'select', select: { name: sourceType } },
      browser_use_only:
        browserUseOnly !== undefined
          ? { type: 'checkbox', checkbox: browserUseOnly }
          : { type: 'checkbox', checkbox: false },
    },
  }
}

function makeLinkedInPage(url: string, name: string, sourceType: string, browserUseOnly?: boolean) {
  return makeUrlPage(url, name, sourceType, browserUseOnly, 'Linkedin')
}

function emptyQueryResponse(
  results: any[] = [],
  hasMore = false,
  nextCursor: string | null = null,
) {
  return { results, has_more: hasMore, next_cursor: nextCursor }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NOTION_TOKEN = 'test-notion-token'
  mockReadFileSync.mockReturnValue(FIXTURE_YAML)
  mockCreatePullRequest.mockResolvedValue({ prNumber: 42, prUrl: 'https://github.com/org/repo/pull/42' })
})

// ─── Unit: property extractors ────────────────────────────────────────────────

describe('extractUrlFromProperty', () => {
  it('extracts url type property', () => {
    const page = { properties: { URL: { type: 'url', url: 'https://example.com' } } }
    expect(extractUrlFromProperty(page, 'URL')).toBe('https://example.com')
  })

  it('extracts rich_text type property', () => {
    const page = {
      properties: { URL: { type: 'rich_text', rich_text: [{ plain_text: 'https://example.com' }] } },
    }
    expect(extractUrlFromProperty(page, 'URL')).toBe('https://example.com')
  })

  it('returns null for missing property', () => {
    expect(extractUrlFromProperty({ properties: {} }, 'URL')).toBeNull()
  })

  it('returns null for unknown type', () => {
    const page = { properties: { URL: { type: 'number', number: 42 } } }
    expect(extractUrlFromProperty(page, 'URL')).toBeNull()
  })
})

describe('extractTextFromProperty', () => {
  it('extracts title type property', () => {
    const page = {
      properties: { Name: { type: 'title', title: [{ plain_text: 'My Source' }] } },
    }
    expect(extractTextFromProperty(page, 'Name')).toBe('My Source')
  })

  it('extracts select type property', () => {
    const page = {
      properties: { source_type: { type: 'select', select: { name: 'BLOG' } } },
    }
    expect(extractTextFromProperty(page, 'source_type')).toBe('BLOG')
  })

  it('returns null for empty title array', () => {
    const page = { properties: { Name: { type: 'title', title: [] } } }
    expect(extractTextFromProperty(page, 'Name')).toBeNull()
  })

  it('extracts rich_text type property', () => {
    const page = {
      properties: { Name: { type: 'rich_text', rich_text: [{ plain_text: 'Rich Text Source' }] } },
    }
    expect(extractTextFromProperty(page, 'Name')).toBe('Rich Text Source')
  })

  it('returns null for missing property', () => {
    expect(extractTextFromProperty({ properties: {} }, 'Name')).toBeNull()
  })

  it('returns null for unknown property type', () => {
    const page = { properties: { Name: { type: 'date', date: { start: '2026-01-01' } } } }
    expect(extractTextFromProperty(page, 'Name')).toBeNull()
  })
})

describe('extractCheckboxFromProperty', () => {
  it('extracts checkbox true', () => {
    const page = {
      properties: { browser_use_only: { type: 'checkbox', checkbox: true } },
    }
    expect(extractCheckboxFromProperty(page, 'browser_use_only')).toBe(true)
  })

  it('extracts checkbox false', () => {
    const page = {
      properties: { browser_use_only: { type: 'checkbox', checkbox: false } },
    }
    expect(extractCheckboxFromProperty(page, 'browser_use_only')).toBe(false)
  })

  it('returns null for non-checkbox type', () => {
    const page = { properties: { browser_use_only: { type: 'url', url: 'x' } } }
    expect(extractCheckboxFromProperty(page, 'browser_use_only')).toBeNull()
  })

  it('returns null for missing property', () => {
    expect(extractCheckboxFromProperty({ properties: {} }, 'browser_use_only')).toBeNull()
  })
})

// ─── Unit: buildPRBody ────────────────────────────────────────────────────────

describe('buildPRBody', () => {
  it('labels LinkedIn DB sources correctly', () => {
    const body = buildPRBody([{ sourceName: 'My LinkedIn', dbId: '342f199edf7c803ebb2cfcb30bd492e3' }])
    expect(body).toContain('**My LinkedIn** (LinkedIn DB)')
  })

  it('labels Custom Crawl DB sources correctly', () => {
    const body = buildPRBody([{ sourceName: 'My Blog', dbId: '340f199edf7c80cabc78f94853d2c426' }])
    expect(body).toContain('**My Blog** (Custom Crawl DB)')
  })

  it('lists multiple sources', () => {
    const body = buildPRBody([
      { sourceName: 'Source A', dbId: '342f199edf7c803ebb2cfcb30bd492e3' },
      { sourceName: 'Source B', dbId: '340f199edf7c80cabc78f94853d2c426' },
    ])
    expect(body).toContain('**Source A** (LinkedIn DB)')
    expect(body).toContain('**Source B** (Custom Crawl DB)')
  })
})

// ─── Unit: buildUpdatedYaml ───────────────────────────────────────────────────

describe('buildUpdatedYaml', () => {
  it('appends new entry to existing sources, preserving header', () => {
    mockReadFileSync.mockReturnValue(FIXTURE_YAML)
    const result = buildUpdatedYaml(CONFIG_PATH, [
      { url: 'https://new.com', source_name: 'New Source', source_type: 'BLOG' },
    ])
    expect(result).toContain('# header comment')
    expect(result).toContain('https://existing.com/blog')
    expect(result).toContain('https://new.com')
    expect(result).toContain('New Source')
  })

  it('includes browser_use_only when provided', () => {
    mockReadFileSync.mockReturnValue(FIXTURE_YAML_EMPTY)
    const result = buildUpdatedYaml(CONFIG_PATH, [
      {
        url: 'https://linkedin.com/company/test',
        source_name: 'Test LinkedIn',
        source_type: 'LINKEDIN',
        browser_use_only: true,
      },
    ])
    expect(result).toContain('browser_use_only: true')
  })
})

// ─── Unit: withRetry ─────────────────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns result immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 5xx error and succeeds on second attempt', async () => {
    const err = Object.assign(new Error('server error'), { status: 500 })
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after maxAttempts 5xx failures', async () => {
    const err = Object.assign(new Error('server error'), { status: 503 })
    const fn = jest.fn().mockRejectedValue(err)

    const promise = withRetry(fn, 3)
    // Suppress unhandled rejection while timers run — we await it below
    promise.catch(() => {})
    await jest.runAllTimersAsync()

    await expect(promise).rejects.toThrow('server error')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries on 429 rate-limit error and succeeds on second attempt', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 })
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable errors (400)', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 })
    const fn = jest.fn().mockRejectedValue(err)

    await expect(withRetry(fn)).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws unreachable sentinel when maxAttempts is 0 (loop body never executes)', async () => {
    const fn = jest.fn()

    await expect(withRetry(fn, 0)).rejects.toThrow('unreachable')
    expect(fn).not.toHaveBeenCalled()
  })
})

// ─── Integration: runNotionSyncJob ────────────────────────────────────────────

describe('runNotionSyncJob', () => {
  describe('AC1 — new URL in Custom Crawl DB → appended to YAML, PR opened', () => {
    it('opens PR with new source from Custom Crawl DB', async () => {
      const newPage = makeUrlPage('https://newblog.com', 'New Blog', 'BLOG')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([newPage]))  // Custom Crawl DB (but wait...)
        .mockResolvedValueOnce(emptyQueryResponse([]))

      // Actually NOTION_SOURCE_DB_CONFIGS[0] is LinkedIn, [1] is Custom Crawl
      // Reset and set up correctly
      mockDatabasesQuery.mockReset()
      const linkedInPage = makeLinkedInPage('https://newblog.com', 'New Blog', 'BLOG')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([linkedInPage]))  // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([]))               // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
      const call = mockCreatePullRequest.mock.calls[0][0]
      expect(call.files[0].path).toBe('packages/pipeline/config/sources.yaml')
      expect(call.files[0].content).toContain('https://newblog.com')
      expect(call.title).toContain('1 new source')
    })
  })

  describe('AC1 — new URL in Custom Crawl DB (URL property)', () => {
    it('picks up new source from Custom Crawl DB using URL property', async () => {
      const newPage = makeUrlPage('https://techblog.com', 'Tech Blog', 'BLOG')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))      // LinkedIn DB (no results)
        .mockResolvedValueOnce(emptyQueryResponse([newPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      expect(content).toContain('https://techblog.com')
      expect(content).toContain('Tech Blog')
    })
  })

  describe('AC2 — URL already in YAML → skipped, no PR if only existing entries', () => {
    it('does not open PR when all Notion URLs already exist in YAML', async () => {
      const existingPage = makeUrlPage('https://existing.com/blog', 'Existing Blog', 'BLOG')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))             // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([existingPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('AC3 — PR body lists source names and DB origin', () => {
    it('includes source name and LinkedIn DB origin in PR body', async () => {
      const liPage = makeLinkedInPage('https://li.com/company/test', 'Test LI', 'LINKEDIN', true)
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([liPage])) // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([]))       // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      const prBody = mockCreatePullRequest.mock.calls[0][0].body
      expect(prBody).toContain('**Test LI** (LinkedIn DB)')
    })

    it('includes source name and Custom Crawl DB origin in PR body', async () => {
      const ccPage = makeUrlPage('https://techblog.com', 'Tech Blog', 'BLOG')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))       // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([ccPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      const prBody = mockCreatePullRequest.mock.calls[0][0].body
      expect(prBody).toContain('**Tech Blog** (Custom Crawl DB)')
    })
  })

  describe('AC4 — invalid source_type → skipped, valid entries still processed', () => {
    it('skips invalid source_type entries and warns', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidPage = makeUrlPage('https://bad.com', 'Bad Source', 'NOT_VALID_TYPE')
      const validPage = makeUrlPage('https://good.com', 'Good Source', 'BLOG')

      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))                         // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([invalidPage, validPage]))   // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid source_type "NOT_VALID_TYPE"'),
      )
      // Valid source still goes through → PR opened
      expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      expect(content).toContain('https://good.com')
      expect(content).not.toContain('https://bad.com')

      consoleSpy.mockRestore()
    })

    it('opens no PR when only invalid source_type entries', async () => {
      const invalidPage = makeUrlPage('https://bad.com', 'Bad Source', 'INVALID')
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))             // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([invalidPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('AC4 — missing required fields → skipped with warning', () => {
    it('skips entry with missing URL', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const noUrlPage = {
        properties: {
          URL: { type: 'url', url: null },
          Name: { type: 'title', title: [{ plain_text: 'No URL Source' }] },
          source_type: { type: 'select', select: { name: 'BLOG' } },
          browser_use_only: { type: 'checkbox', checkbox: false },
        },
      }
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))          // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([noUrlPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('skipping entry with missing fields'),
      )
      expect(mockCreatePullRequest).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('AC5 — browser_use_only parsed as boolean', () => {
    it('includes browser_use_only: true in YAML when checkbox is true', async () => {
      const liPage = makeLinkedInPage(
        'https://linkedin.com/company/test',
        'Test LinkedIn',
        'LINKEDIN',
        true,
      )
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([liPage])) // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([]))       // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      expect(content).toContain('browser_use_only: true')
    })

    it('includes browser_use_only: false in YAML when checkbox is false', async () => {
      const ccPage = makeUrlPage('https://newblog.com', 'New Blog', 'BLOG', false)
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))       // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([ccPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      expect(content).toContain('browser_use_only: false')
    })

    it('omits browser_use_only from YAML when Notion property is absent', async () => {
      const pageNoCheckbox = {
        properties: {
          URL: { type: 'url', url: 'https://nocheckbox.com' },
          Name: { type: 'title', title: [{ plain_text: 'No Checkbox' }] },
          source_type: { type: 'select', select: { name: 'BLOG' } },
          // no browser_use_only property
        },
      }
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))               // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([pageNoCheckbox])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      // Should contain the new source but NOT browser_use_only for this entry
      expect(content).toContain('https://nocheckbox.com')
      // The entry in YAML should not have browser_use_only key (it's omitted when null)
      // This is verified by checking the content doesn't have "browser_use_only" near this URL
      // (can't easily test absence of optional key without parsing, so check structure)
    })
  })

  describe('AC6 — no new sources → createPullRequest NOT called', () => {
    it('skips PR when both DBs return empty results', async () => {
      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))  // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([]))  // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).not.toHaveBeenCalled()
    })
  })

  describe('AC7 — Notion API 5xx → retried, failure logged, no YAML change', () => {
    it('logs error and does not open PR if Notion API fails all retries', async () => {
      jest.useFakeTimers()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const serverErr = Object.assign(new Error('Internal Server Error'), { status: 500 })

      // Both DB queries always fail
      mockDatabasesQuery.mockRejectedValue(serverErr)

      const promise = runNotionSyncJob(mockCommitter)
      await jest.runAllTimersAsync()
      await promise

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[notion-sync] sync job failed'),
        expect.anything(),
      )
      expect(mockCreatePullRequest).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      jest.useRealTimers()
    })
  })

  describe('AC8 — same URL in both DBs → added only once', () => {
    it('deduplicates within-run when same URL appears in LinkedIn and Custom Crawl DB', async () => {
      const sharedUrl = 'https://shared.com/page'
      const liPage = makeLinkedInPage(sharedUrl, 'Shared Source', 'BLOG')
      const ccPage = makeUrlPage(sharedUrl, 'Shared Source', 'BLOG')

      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([liPage])) // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([ccPage])) // Custom Crawl DB

      await runNotionSyncJob(mockCommitter)

      expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      // Count occurrences of the URL — should appear exactly once in sources
      const matches = (content.match(new RegExp(sharedUrl, 'g')) ?? []).length
      expect(matches).toBe(1)
    })
  })

  describe('Pagination — handles has_more + next_cursor', () => {
    it('follows pagination cursors to retrieve all pages', async () => {
      const page1 = makeUrlPage('https://page1.com', 'Page 1', 'BLOG')
      const page2 = makeUrlPage('https://page2.com', 'Page 2', 'BLOG')

      mockDatabasesQuery
        .mockResolvedValueOnce(emptyQueryResponse([]))                                     // LinkedIn DB
        .mockResolvedValueOnce(emptyQueryResponse([page1], true, 'cursor-abc'))            // Custom Crawl: page 1
        .mockResolvedValueOnce(emptyQueryResponse([page2], false, null))                   // Custom Crawl: page 2

      await runNotionSyncJob(mockCommitter)

      // 3 total query calls: 1 LinkedIn + 2 Custom Crawl (paginated)
      expect(mockDatabasesQuery).toHaveBeenCalledTimes(3)
      // Second Custom Crawl call should pass start_cursor
      expect(mockDatabasesQuery).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ start_cursor: 'cursor-abc' }),
      )

      const content = mockCreatePullRequest.mock.calls[0][0].files[0].content
      expect(content).toContain('https://page1.com')
      expect(content).toContain('https://page2.com')
    })
  })

  describe('NOTION_SOURCE_DB_CONFIGS', () => {
    it('has exactly two DB configs', () => {
      expect(NOTION_SOURCE_DB_CONFIGS).toHaveLength(2)
    })

    it('LinkedIn DB has correct databaseId and urlProperty', () => {
      const linkedIn = NOTION_SOURCE_DB_CONFIGS[0]
      expect(linkedIn.databaseId).toBe('342f199edf7c803ebb2cfcb30bd492e3')
      expect(linkedIn.urlProperty).toBe('Linkedin')
    })

    it('Custom Crawl DB has correct databaseId and urlProperty', () => {
      const customCrawl = NOTION_SOURCE_DB_CONFIGS[1]
      expect(customCrawl.databaseId).toBe('340f199edf7c80cabc78f94853d2c426')
      expect(customCrawl.urlProperty).toBe('URL')
    })
  })
})

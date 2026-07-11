import { readFileSync } from 'fs'
import { loadSourceConfig, CONTENT_SOURCE_TYPES } from '../source-config'

jest.mock('fs')
jest.mock('js-yaml', () => ({ load: jest.fn() }))

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>
const { load: mockLoad } = jest.requireMock('js-yaml') as { load: jest.Mock }

const CONFIG_PATH = '/fake/sources.yaml'

function mockYaml(sources: unknown[]) {
  mockReadFileSync.mockReturnValue('mocked-yaml-content')
  mockLoad.mockReturnValue({ sources })
}

describe('loadSourceConfig', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  // ─── AC: valid config parses to correctly typed SourceConfig[] ───

  it('parses a valid source entry with all required fields', () => {
    mockYaml([
      { url: 'https://example.com/blog', source_name: 'Example Blog', source_type: 'BLOG' },
    ])
    const result = loadSourceConfig(CONFIG_PATH)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      url: 'https://example.com/blog',
      sourceName: 'Example Blog',
      sourceType: 'BLOG',
      browserUseOnly: false,
      consecutiveFailuresThreshold: 3,
    })
  })

  // ─── AC: browserUseOnly defaults ───

  it('defaults browserUseOnly to false for non-LinkedIn source when not specified', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'Example', source_type: 'BLOG' }])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.browserUseOnly).toBe(false)
  })

  it('defaults browserUseOnly to true for LINKEDIN source when not specified', () => {
    mockYaml([
      {
        url: 'https://linkedin.com/company/example',
        source_name: 'Example LinkedIn',
        source_type: 'LINKEDIN',
      },
    ])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.browserUseOnly).toBe(true)
  })

  it('respects explicit browser_use_only: true regardless of source_type', () => {
    mockYaml([
      {
        url: 'https://example.com',
        source_name: 'Example',
        source_type: 'BLOG',
        browser_use_only: true,
      },
    ])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.browserUseOnly).toBe(true)
  })

  it('respects explicit browser_use_only: false even for LINKEDIN source', () => {
    mockYaml([
      {
        url: 'https://linkedin.com/company/example',
        source_name: 'Example LinkedIn',
        source_type: 'LINKEDIN',
        browser_use_only: false,
      },
    ])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.browserUseOnly).toBe(false)
  })

  // ─── AC: per-source overrides accessible; defaults applied when absent ───

  it('exposes per-source overrides when present', () => {
    mockYaml([
      {
        url: 'https://example.com',
        source_name: 'Example',
        source_type: 'BLOG',
        min_body_length: 500,
        recency_window_days: 14,
        consecutive_failures_threshold: 5,
      },
    ])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.minBodyLength).toBe(500)
    expect(config.recencyWindowDays).toBe(14)
    expect(config.consecutiveFailuresThreshold).toBe(5)
  })

  it('leaves minBodyLength and recencyWindowDays undefined when not specified', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'Example', source_type: 'BLOG' }])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.minBodyLength).toBeUndefined()
    expect(config.recencyWindowDays).toBeUndefined()
  })

  it('defaults consecutiveFailuresThreshold to 3 when not specified', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'Example', source_type: 'BLOG' }])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.consecutiveFailuresThreshold).toBe(3)
  })

  it('uses provided consecutiveFailuresThreshold when specified', () => {
    mockYaml([
      {
        url: 'https://example.com',
        source_name: 'Example',
        source_type: 'BLOG',
        consecutive_failures_threshold: 7,
      },
    ])
    const [config] = loadSourceConfig(CONFIG_PATH)
    expect(config.consecutiveFailuresThreshold).toBe(7)
  })

  // ─── AC: invalid source_type throws listing allowed values ───

  it('throws with allowed values listed when source_type is invalid', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'Example', source_type: 'INVALID_TYPE' }])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow(
      `source_type must be one of: ${CONTENT_SOURCE_TYPES.join(', ')}`,
    )
  })

  // ─── AC: missing required field throws naming the field ───

  it('throws mentioning "url" when url is absent', () => {
    mockYaml([{ source_name: 'Example', source_type: 'BLOG' }])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('url')
  })

  it('throws mentioning "source_name" when source_name is absent', () => {
    mockYaml([{ url: 'https://example.com', source_type: 'BLOG' }])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('source_name')
  })

  it('throws mentioning "source_type" when source_type is absent', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'Example' }])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('source_type')
  })

  it('includes entry index in error message for multi-entry configs', () => {
    mockYaml([
      { url: 'https://example.com', source_name: 'Valid Entry', source_type: 'BLOG' },
      { url: 'https://bad.com', source_name: 'Bad Entry', source_type: 'NOT_REAL' },
    ])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('[1]')
  })

  it('includes source_name in error message when available', () => {
    mockYaml([{ url: 'https://example.com', source_name: 'My Source', source_type: 'NOPE' }])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('source_name: "My Source"')
  })

  it('omits source_name hint when entry has no source_name field', () => {
    mockYaml([{ url: 'https://example.com', source_type: 'INVALID_TYPE' }])
    const err = (() => { try { loadSourceConfig(CONFIG_PATH) } catch (e) { return e as Error } })()
    expect(err).toBeDefined()
    // nameHint is '' when source_name is absent — the hint format is (source_name: "...") with quotes
    expect(err!.message).not.toMatch(/\(source_name: ".*"\)/)
  })

  it('uses (root) path label when validation error has no field path', () => {
    // Passing null as a source entry causes a root-level Zod error (path = [])
    mockYaml([null])
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('(root)')
  })

  // ─── File/YAML error handling ───

  it('throws when config file cannot be read', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow(
      `Failed to read source config file at "${CONFIG_PATH}"`,
    )
  })

  it('throws when YAML parsing fails', () => {
    mockReadFileSync.mockReturnValue('bad: yaml: [')
    mockLoad.mockImplementation(() => {
      throw new Error('unexpected end of the stream')
    })
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('Failed to parse YAML')
  })

  it('throws when sources key is missing from YAML', () => {
    mockReadFileSync.mockReturnValue('content')
    mockLoad.mockReturnValue({ not_sources: [] })
    expect(() => loadSourceConfig(CONFIG_PATH)).toThrow('top-level "sources" array')
  })

  it('returns an empty array when sources list is empty', () => {
    mockYaml([])
    expect(loadSourceConfig(CONFIG_PATH)).toEqual([])
  })
})

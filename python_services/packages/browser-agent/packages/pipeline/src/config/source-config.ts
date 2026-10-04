import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { z } from 'zod'

// Must stay in sync with content.source_type_enum in the database.
// Before adding new values here, add them to the DB enum first (see Story 1.1 migration).
// Check whether a shared ContentSourceType already exists in the project's DB type layer
// (e.g. packages/pipeline/src/db/types.ts) and import from there instead of redeclaring.
export const CONTENT_SOURCE_TYPES = [
  'RSS',
  'TWITTER',
  'REDDIT',
  'LINKEDIN',
  'YOUTUBE',
  'BLOG',
  'COMPANY_BLOG',
  'NEWSLETTER',
  'GITHUB_TRENDING',
  'PRODUCT_HUNT',
  'THREADS',
  'CUSTOM',
] as const

export type ContentSourceType = (typeof CONTENT_SOURCE_TYPES)[number]

export interface SourceConfig {
  url: string
  sourceName: string
  sourceType: ContentSourceType
  browserUseOnly: boolean
  minBodyLength?: number
  recencyWindowDays?: number
  consecutiveFailuresThreshold: number
}

// ─── Zod schema for a single YAML source entry (snake_case keys as written in YAML) ───

const SourceEntrySchema = z.object({
  url: z.string().url({ message: 'url must be a valid URL' }),
  source_name: z.string().min(1, { message: 'source_name is required' }),
  source_type: z.enum(CONTENT_SOURCE_TYPES, {
    errorMap: () => ({
      message: `source_type must be one of: ${CONTENT_SOURCE_TYPES.join(', ')}`,
    }),
  }),
  browser_use_only: z.boolean().optional(),
  min_body_length: z.number().int().positive().optional(),
  recency_window_days: z.number().int().positive().optional(),
  consecutive_failures_threshold: z.number().int().positive().default(3),
})

type RawSourceEntry = z.infer<typeof SourceEntrySchema>

// Top-level YAML file must have a `sources` array key
const SourcesFileSchema = z.object({
  sources: z.array(z.unknown()),
})

// ─── Post-validation transform: apply browserUseOnly defaulting logic ───

function toSourceConfig(raw: RawSourceEntry): SourceConfig {
  // Explicit browser_use_only value always wins.
  // When absent: LINKEDIN defaults to true, all other source_types default to false.
  const browserUseOnly =
    raw.browser_use_only !== undefined
      ? raw.browser_use_only
      : raw.source_type === 'LINKEDIN'

  return {
    url: raw.url,
    sourceName: raw.source_name,
    sourceType: raw.source_type,
    browserUseOnly,
    minBodyLength: raw.min_body_length,
    recencyWindowDays: raw.recency_window_days,
    consecutiveFailuresThreshold: raw.consecutive_failures_threshold,
  }
}

// ─── Public API ───

/**
 * Reads and validates a YAML source config file.
 * Throws on file-not-found, invalid YAML, or any invalid entry.
 * Error messages name the invalid field and include the entry index for debuggability.
 */
export function loadSourceConfig(configPath: string): SourceConfig[] {
  let fileContents: string
  try {
    fileContents = readFileSync(configPath, 'utf8')
  } catch (err) {
    throw new Error(
      `Failed to read source config file at "${configPath}": ${(err as Error).message}`,
    )
  }

  let parsed: unknown
  try {
    parsed = load(fileContents)
  } catch (err) {
    throw new Error(
      `Failed to parse YAML in "${configPath}": ${(err as Error).message}`,
    )
  }

  const fileResult = SourcesFileSchema.safeParse(parsed)
  if (!fileResult.success) {
    throw new Error(
      `Invalid source config file: expected a top-level "sources" array`,
    )
  }

  return fileResult.data.sources.map((entry, index) => {
    const result = SourceEntrySchema.safeParse(entry)
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
        .join('; ')

      // Include source_name in the error when available to help engineers locate the entry
      const nameHint =
        entry != null &&
        typeof entry === 'object' &&
        'source_name' in entry &&
        typeof (entry as Record<string, unknown>).source_name === 'string'
          ? ` (source_name: "${(entry as Record<string, unknown>).source_name}")`
          : ''

      throw new Error(`Config entry [${index}]${nameHint}: ${errors}`)
    }
    return toSourceConfig(result.data)
  })
}

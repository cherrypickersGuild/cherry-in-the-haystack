import 'dotenv/config'
import { Client } from '@notionhq/client'
import { dump, load } from 'js-yaml'
import { readFileSync } from 'fs'
import * as path from 'path'
import { CONTENT_SOURCE_TYPES, ContentSourceType } from '../config/source-config'
import type { GitHubCommitter } from '../publication/github-committer'

// ─── Notion DB config (ADR-015) ───────────────────────────────────────────────

interface NotionSourceDbConfig {
  databaseId: string
  urlProperty: string
  nameProperty: string
  sourceTypeProperty: string
  browserUseOnlyProperty: string
}

export const NOTION_SOURCE_DB_CONFIGS: readonly NotionSourceDbConfig[] = [
  {
    databaseId: '342f199edf7c803ebb2cfcb30bd492e3',
    urlProperty: 'Linkedin',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
  {
    databaseId: '340f199edf7c80cabc78f94853d2c426',
    urlProperty: 'URL',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
] as const

const LINKEDIN_DB_ID = '342f199edf7c803ebb2cfcb30bd492e3'

export const CONFIG_PATH = path.join(__dirname, '../../config/sources.yaml')
const YAML_REPO_PATH = 'packages/pipeline/config/sources.yaml'

// ─── YAML entry shape (snake_case — matches sources.yaml format) ──────────────

interface SourceYamlEntry {
  url: string
  source_name: string
  source_type: string
  browser_use_only?: boolean
}

// ─── Notion property extractors ───────────────────────────────────────────────

export function extractUrlFromProperty(page: any, propertyName: string): string | null {
  const prop = page.properties?.[propertyName]
  if (!prop) return null
  if (prop.type === 'url') return prop.url ?? null
  if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text ?? null
  return null
}

export function extractTextFromProperty(page: any, propertyName: string): string | null {
  const prop = page.properties?.[propertyName]
  if (!prop) return null
  if (prop.type === 'title') return prop.title?.[0]?.plain_text ?? null
  if (prop.type === 'rich_text') return prop.rich_text?.[0]?.plain_text ?? null
  if (prop.type === 'select') return prop.select?.name ?? null
  return null
}

export function extractCheckboxFromProperty(page: any, propertyName: string): boolean | null {
  const prop = page.properties?.[propertyName]
  if (!prop || prop.type !== 'checkbox') return null
  return prop.checkbox
}

// ─── YAML management ──────────────────────────────────────────────────────────

export function buildUpdatedYaml(configPath: string, newEntries: SourceYamlEntry[]): string {
  const raw = readFileSync(configPath, 'utf8')
  const parsed = load(raw) as { sources: SourceYamlEntry[] }
  const allSources = [...(parsed.sources ?? []), ...newEntries]

  // Preserve the header comment block above 'sources:'
  const sourcesIdx = raw.indexOf('\nsources:')
  const headerBlock = sourcesIdx >= 0 ? raw.slice(0, sourcesIdx) : ''

  const sourcesDump = dump({ sources: allSources }, { lineWidth: -1, noRefs: true })
  return headerBlock + '\n' + sourcesDump
}

// ─── PR body ─────────────────────────────────────────────────────────────────

export function buildPRBody(added: Array<{ sourceName: string; dbId: string }>): string {
  const lines = [
    '## Notion Source Registry Sync',
    '',
    'New sources added from Notion:',
    '',
  ]
  for (const { sourceName, dbId } of added) {
    const origin = dbId === LINKEDIN_DB_ID ? 'LinkedIn DB' : 'Custom Crawl DB'
    lines.push(`- **${sourceName}** (${origin})`)
  }
  lines.push('')
  lines.push(
    'After merging, the browser-crawl job will pick up these sources on the next daily cycle.',
  )
  return lines.join('\n')
}

// ─── Retry helper for 5xx Notion errors ──────────────────────────────────────

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isRetryable =
        typeof err?.status === 'number' &&
        (err.status === 429 || (err.status >= 500 && err.status < 600))
      if (isRetryable && attempt < maxAttempts) {
        const delayMs = 1000 * Math.pow(2, attempt - 1) // 1s, 2s, 4s
        console.warn(
          `[notion-sync] attempt ${attempt} failed (${err.status}), retrying in ${delayMs}ms`,
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function runNotionSyncJob(committer: GitHubCommitter): Promise<void> {
  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN })

    const raw = readFileSync(CONFIG_PATH, 'utf8')
    const parsed = load(raw) as { sources: Array<{ url: string }> }
    const existingUrls = new Set((parsed.sources ?? []).map((e) => e.url))

    const added: Array<{ sourceName: string; dbId: string }> = []
    const newEntries: SourceYamlEntry[] = []

    for (const dbConfig of NOTION_SOURCE_DB_CONFIGS) {
      let cursor: string | undefined = undefined

      do {
        const response = await withRetry(() =>
          notion.databases.query({
            database_id: dbConfig.databaseId,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        )

        for (const page of response.results) {
          const url = extractUrlFromProperty(page, dbConfig.urlProperty)
          const name = extractTextFromProperty(page, dbConfig.nameProperty)
          const sourceType = extractTextFromProperty(page, dbConfig.sourceTypeProperty)
          const browserUseOnly = extractCheckboxFromProperty(page, dbConfig.browserUseOnlyProperty)

          if (!url || !name || !sourceType) {
            console.warn(
              `[notion-sync] skipping entry with missing fields in DB ${dbConfig.databaseId}`,
            )
            continue
          }

          if (!CONTENT_SOURCE_TYPES.includes(sourceType as ContentSourceType)) {
            console.warn(
              `[notion-sync] invalid source_type "${sourceType}" for "${name}" — skipping`,
            )
            continue
          }

          if (existingUrls.has(url)) continue // AC2, AC8: skip existing + within-run dedup

          const entry: SourceYamlEntry = { url, source_name: name, source_type: sourceType }
          if (browserUseOnly !== null) entry.browser_use_only = browserUseOnly

          newEntries.push(entry)
          existingUrls.add(url) // AC8: within-run dedup — prevent double-add across DBs
          added.push({ sourceName: name, dbId: dbConfig.databaseId })
        }

        cursor = response.next_cursor ?? undefined
      } while (cursor)
    }

    if (newEntries.length === 0) {
      console.log('[notion-sync] no new sources found — skipping PR')
      return
    }

    const updatedYaml = buildUpdatedYaml(CONFIG_PATH, newEntries)
    const branch = `feat/notion-sync/${new Date().toISOString().slice(0, 10)}`

    const { prNumber, prUrl } = await committer.createPullRequest({
      branch,
      title: `feat(notion-sync): add ${newEntries.length} new source(s) from Notion`,
      body: buildPRBody(added),
      files: [{ path: YAML_REPO_PATH, content: updatedYaml }],
    })

    console.log(
      `[notion-sync] opened PR #${prNumber} with ${newEntries.length} source(s): ${prUrl}`,
    )
  } catch (err) {
    console.error(
      '[notion-sync] sync job failed — existing config and pipeline unaffected:',
      err,
    )
  }
}

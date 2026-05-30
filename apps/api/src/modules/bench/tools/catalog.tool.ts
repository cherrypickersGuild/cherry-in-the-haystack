/**
 * Catalog tool — retrieves Cherry internal docs for Set 3 (Policy Expert).
 *
 * Exposes `search_catalog(query, limit)` to Claude.
 * For the demo, the catalog is a small fixed set of markdown docs keyed by id.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BenchTool } from './tool-registry'

interface CatalogDoc {
  id: string
  title: string
  keywords: string[]
  content: string
}

const SEED_DIR = join(__dirname, '..', 'seed')

function loadDoc(id: string, title: string, keywords: string[]): CatalogDoc {
  const content = readFileSync(join(SEED_DIR, `${id}.md`), 'utf-8')
  return { id, title, keywords, content }
}

let cached: CatalogDoc[] | null = null
function getCatalog(): CatalogDoc[] {
  if (!cached) {
    cached = [
      loadDoc('karma-v2', 'Cherry Karma Tier System v2', [
        'karma',
        'tier',
        'platinum',
        'gold',
        'silver',
        'bronze',
        'reward',
        'revenue share',
        'curator',
      ]),
    ]
  }
  return cached
}

export interface CatalogSearchInput {
  query: string
  limit?: number
}

export interface CatalogSearchResult {
  docs: Array<{ id: string; title: string; content: string }>
  source: 'cherry-catalog-seed'
}

/**
 * Scoring: a doc matches a token if token appears in id, title, or keywords
 * (case-insensitive). Each token hit = +1. Docs with score > 0 are returned,
 * sorted by score desc. Ties broken by doc id alphabetically.
 */
export function searchCatalog(
  input: CatalogSearchInput,
): CatalogSearchResult {
  const tokens = input.query.toLowerCase().split(/\s+/).filter(Boolean)
  const limit = input.limit ?? 3

  const scored = getCatalog().map((doc) => {
    const hay = (
      doc.id +
      ' ' +
      doc.title +
      ' ' +
      doc.keywords.join(' ')
    ).toLowerCase()
    const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0)
    return { doc, score }
  })

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .slice(0, limit)
    .map(({ doc }) => ({ id: doc.id, title: doc.title, content: doc.content }))

  return { docs: matched, source: 'cherry-catalog-seed' }
}

export const catalogTool: BenchTool = {
  definition: {
    name: 'search_catalog',
    description:
      'Search the Cherry internal documentation catalog. Returns { docs: [{ id, title, content }] }. Each doc has an id (e.g. "karma-v2") that should be cited in answers.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Search query, e.g. 'karma tier reward percentages'.",
        },
        limit: {
          type: 'number',
          description: 'Max number of docs to return. Default 3.',
        },
      },
      required: ['query'],
    },
  },
  execute: async (input) => {
    const query = String(input.query ?? '').trim()
    if (!query) throw new Error('[catalog] query is required')
    return searchCatalog({
      query,
      limit: typeof input.limit === 'number' ? input.limit : undefined,
    })
  },
}

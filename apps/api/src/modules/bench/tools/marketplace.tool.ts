/**
 * Marketplace tool — queries seeded listings for Set 2 (Marketplace Hunter).
 *
 * Exposes `search_marketplace(query, max_price, sealed_only)` to Claude.
 * The seed JSON is the single source of truth for Recall@3 evaluation.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BenchTool } from './tool-registry'

export interface MarketplaceListing {
  id: string
  title: string
  price: number
  seller: string
  posted_at: string
  sealed: boolean
  brand: string
  model: string
}

const SEED_PATH = join(__dirname, '..', 'seed', 'marketplace.seed.json')

// Lazily-loaded so test envs can override fs.
let cachedListings: MarketplaceListing[] | null = null
function loadListings(): MarketplaceListing[] {
  if (!cachedListings) {
    const raw = readFileSync(SEED_PATH, 'utf-8')
    cachedListings = JSON.parse(raw) as MarketplaceListing[]
  }
  return cachedListings
}

/**
 * Simple keyword match against brand + model + title.
 * Splits query into whitespace tokens; all tokens (case-insensitive) must hit.
 */
/** Normalize for matching: lowercase, strip punctuation, collapse whitespace,
 *  drop "inch" / "-inch" suffix variants so `16-inch` matches `16`. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/-inch\b|(?<=\d)"/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesQuery(listing: MarketplaceListing, query: string): boolean {
  if (!query) return true
  const hay = normalize(
    `${listing.brand} ${listing.model} ${listing.title}`,
  )
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  return tokens.every((t) => hay.includes(t))
}

export interface MarketplaceSearchInput {
  query: string
  max_price?: number
  sealed_only?: boolean
}

export interface MarketplaceSearchResult {
  listings: MarketplaceListing[]
  matchCount: number
  source: 'cherry-marketplace-seed'
}

export function searchMarketplace(
  input: MarketplaceSearchInput,
): MarketplaceSearchResult {
  const all = loadListings()
  const matched = all
    .filter((l) => matchesQuery(l, input.query))
    .filter((l) =>
      typeof input.max_price === 'number' ? l.price < input.max_price : true,
    )
    .filter((l) => (input.sealed_only ? l.sealed === true : true))
    .sort((a, b) => a.price - b.price)

  return {
    listings: matched,
    matchCount: matched.length,
    source: 'cherry-marketplace-seed',
  }
}

export const marketplaceTool: BenchTool = {
  definition: {
    name: 'search_marketplace',
    description:
      'Search the internal marketplace for listings matching a query and filters. Returns { listings: [{id, title, price, seller, posted_at, sealed, brand, model}], matchCount }. Results are sorted by price ascending.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Free-text query, e.g. 'LG Gram 16'.",
        },
        max_price: {
          type: 'number',
          description: 'Upper bound (exclusive) on price in USD.',
        },
        sealed_only: {
          type: 'boolean',
          description: 'If true, only return sealed items.',
        },
      },
      required: ['query'],
    },
  },
  execute: async (input) => {
    const query = String(input.query ?? '').trim()
    if (!query) throw new Error('[marketplace] query is required')
    return searchMarketplace({
      query,
      max_price:
        typeof input.max_price === 'number' ? input.max_price : undefined,
      sealed_only:
        typeof input.sealed_only === 'boolean'
          ? input.sealed_only
          : undefined,
    })
  },
}

/**
 * CoinGecko tool — real-time BTC/ETH prices for Set 1 (Market Oracle).
 * Uses the free public endpoint (no key required). Rate limit is ~10-30/min.
 *
 * Exposes `get_crypto_price(symbol)` to Claude.
 */

import type { BenchTool } from './tool-registry'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

/** Hardcoded map for the symbols we expect in demos. Extend as needed. */
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
}

export interface CryptoPriceResult {
  symbol: string
  coingeckoId: string
  priceUsd: number
  change24hPct: number
  fetchedAt: string
  /** `coingecko` for live fetch; includes a cache note when rate-limited fallback is served. */
  source: string
}

/* ── In-memory cache ──
 *  Free-tier CoinGecko caps at ~10-30 requests/min. One benchmark run triggers
 *  2+ lookups (ground-truth capture + the tool call inside Claude's loop), so
 *  back-to-back demo runs hit 429 fast.
 *
 *  Strategy:
 *   1. Cache per symbol for FRESH_TTL_MS → served without a network call.
 *   2. After TTL, refetch. If the refetch fails AND we still have a cached
 *      value younger than STALE_TTL_MS, serve the stale one (demo keeps
 *      working, price is at worst a few minutes old).
 *   3. If no cache and the API fails, throw a clear message. */

const FRESH_TTL_MS = 60_000      // 60s — fresh data window
const STALE_TTL_MS = 5 * 60_000  // 5min — acceptable fallback when rate-limited

interface CacheEntry {
  result: CryptoPriceResult
  fetchedAt: number
}
const priceCache = new Map<string, CacheEntry>()

async function fetchFromCoingecko(
  id: string,
  upper: string,
): Promise<CryptoPriceResult> {
  const url = `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
  const key = process.env.COINGECKO_API_KEY
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (key) headers['x-cg-demo-api-key'] = key

  const res = await fetch(url, { headers })
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        `[coingecko] rate-limited (HTTP 429). Wait ~60s or set COINGECKO_API_KEY for a higher tier.`,
      )
    }
    throw new Error(`[coingecko] HTTP ${res.status} for ${id}`)
  }
  const body = (await res.json()) as Record<
    string,
    { usd: number; usd_24h_change: number }
  >
  const row = body[id]
  if (!row) {
    throw new Error(`[coingecko] No data returned for ${id}`)
  }
  return {
    symbol: upper,
    coingeckoId: id,
    priceUsd: row.usd,
    change24hPct: Number(row.usd_24h_change.toFixed(2)),
    fetchedAt: new Date().toISOString(),
    source: 'coingecko',
  }
}

export async function fetchCryptoPrice(
  symbol: string,
): Promise<CryptoPriceResult> {
  const upper = symbol.toUpperCase()
  const id = SYMBOL_TO_ID[upper]
  if (!id) {
    throw new Error(
      `[coingecko] Unsupported symbol: ${symbol}. Supported: ${Object.keys(SYMBOL_TO_ID).join(', ')}`,
    )
  }

  const now = Date.now()
  const cached = priceCache.get(upper)

  // Fresh cache hit — no network call.
  if (cached && now - cached.fetchedAt < FRESH_TTL_MS) {
    return cached.result
  }

  // Try a fresh fetch.
  try {
    const fresh = await fetchFromCoingecko(id, upper)
    priceCache.set(upper, { result: fresh, fetchedAt: now })
    return fresh
  } catch (err) {
    // On failure, fall back to stale cache if it exists and is still
    // within the STALE window. Demo stays alive; accuracy still very high.
    if (cached && now - cached.fetchedAt < STALE_TTL_MS) {
      const ageSec = Math.round((now - cached.fetchedAt) / 1000)
      return {
        ...cached.result,
        // Annotate the fetchedAt with the ORIGINAL capture time so evaluators
        // still see a real timestamp; tool-call output also stays honest.
        source: `coingecko (cached ${ageSec}s ago — rate-limited)`,
      }
    }
    throw err
  }
}

export const coingeckoTool: BenchTool = {
  definition: {
    name: 'get_crypto_price',
    description:
      "Fetch the current USD price and 24h percent change for a cryptocurrency from CoinGecko. Returns { symbol, priceUsd, change24hPct, fetchedAt }.",
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: "Ticker symbol, e.g. 'BTC', 'ETH'.",
        },
      },
      required: ['symbol'],
    },
  },
  execute: async (input) => {
    const symbol = String(input.symbol ?? '').trim()
    if (!symbol) throw new Error('[coingecko] symbol is required')
    return fetchCryptoPrice(symbol)
  },
}

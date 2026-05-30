/**
 * SET 2 — Marketplace Hunter evaluator.
 *
 * Scores structured-listing answers against the seed DB. Metrics:
 *   - JSON schema pass (parse + required fields)
 *   - Listing authenticity (ids exist in DB)
 *   - Recall@3 (top-3 by price asc match expectedIds)
 *   - Price field exact match (each listing's price matches DB)
 */

import {
  searchMarketplace,
  type MarketplaceListing,
} from '../tools/marketplace.tool'
import type {
  EvalContext,
  EvalResult,
  Evaluator,
  Metric,
} from './types'

interface GroundTruth {
  expectedIds: string[]            // top-3 ids by price asc
  requiredFields: string[]
  allMatching: MarketplaceListing[] // for authenticity + price-match checks
}

export function captureHunterGroundTruth(
  expectedIds: string[],
  requiredFields: string[],
  filter: { brand: string; model: string; maxPrice: number; sealedOnly: true },
): GroundTruth {
  const all = searchMarketplace({
    query: `${filter.brand} ${filter.model}`,
    max_price: filter.maxPrice,
    sealed_only: filter.sealedOnly,
  }).listings
  return { expectedIds, requiredFields, allMatching: all }
}

/** Pull the first JSON array out of an answer, tolerating surrounding prose. */
function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim()
  // Direct parse first.
  try {
    const direct = JSON.parse(trimmed)
    if (Array.isArray(direct)) return direct
  } catch {
    /* fall through */
  }
  // Strip code fences.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1].trim())
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* fall through */
    }
  }
  // Find first [...] span heuristically.
  const firstBracket = trimmed.indexOf('[')
  const lastBracket = trimmed.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = trimmed.slice(firstBracket, lastBracket + 1)
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* ignore */
    }
  }
  return null
}

export const set2HunterEvaluator: Evaluator = {
  id: 'set-2-hunter',
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gt = ctx.groundTruth as GroundTruth
    const answer = ctx.answer ?? ''
    const metrics: Metric[] = []

    const parsed = extractJsonArray(answer)
    const hasJson = parsed !== null

    // ── Metric: Schema pass ──
    let schemaPass = false
    let itemsWithAllFields = 0
    if (hasJson && parsed) {
      itemsWithAllFields = parsed.filter((it) => {
        if (typeof it !== 'object' || it === null) return false
        const rec = it as Record<string, unknown>
        return gt.requiredFields.every((f) => f in rec)
      }).length
      schemaPass =
        parsed.length === 3 && itemsWithAllFields === parsed.length
    }
    metrics.push({
      id: 'schemaPass',
      label: 'Clean 3-item list with all fields',
      value: schemaPass ? 'Yes' : 'No',
      passed: schemaPass,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Metric: Listing authenticity ──
    const claimedIds: string[] = []
    if (hasJson && parsed) {
      for (const it of parsed) {
        if (typeof it === 'object' && it !== null && 'id' in (it as any)) {
          const id = String((it as any).id)
          if (id) claimedIds.push(id)
        }
      }
    }
    const authenticIds = claimedIds.filter((id) =>
      gt.allMatching.some((l) => l.id === id),
    )
    const authenticityRate =
      claimedIds.length === 0
        ? 0
        : authenticIds.length / claimedIds.length
    metrics.push({
      id: 'authenticity',
      label: 'Real listings (not invented)',
      value: `${authenticIds.length} / ${Math.max(claimedIds.length, 0)}`,
      passed:
        claimedIds.length > 0 && authenticityRate === 1,
      direction: 'higher-better',
      category: 'hallucination',
    })

    // ── Metric: Recall@3 ──
    const top3 = claimedIds.slice(0, 3)
    const recallHits = top3.filter((id) => gt.expectedIds.includes(id))
    const recallAt3 = recallHits.length
    metrics.push({
      id: 'recallAt3',
      label: 'Found the 3 cheapest correctly',
      value: `${recallAt3} / 3`,
      passed: recallAt3 === 3,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric: Price field exact match ──
    let priceMatches = 0
    if (hasJson && parsed) {
      for (const it of parsed) {
        if (typeof it !== 'object' || it === null) continue
        const rec = it as Record<string, unknown>
        const id = String(rec.id ?? '')
        const truth = gt.allMatching.find((l) => l.id === id)
        if (!truth) continue
        const claimedPrice =
          typeof rec.price === 'number'
            ? rec.price
            : parseFloat(String(rec.price ?? '').replace(/[^\d.]/g, ''))
        if (!Number.isNaN(claimedPrice) && claimedPrice === truth.price) {
          priceMatches++
        }
      }
    }
    const totalClaimable = Math.min(claimedIds.length, 3)
    const priceMatchRate =
      totalClaimable === 0 ? 0 : priceMatches / totalClaimable
    metrics.push({
      id: 'priceMatch',
      label: 'Prices match the real DB',
      value:
        totalClaimable === 0
          ? '—'
          : `${Math.round(priceMatchRate * 100)}%`,
      passed: totalClaimable > 0 && priceMatchRate === 1,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric: Tool calls ──
    metrics.push({
      id: 'toolCalls',
      label: 'Marketplace searches',
      value: ctx.toolCalls.length,
      direction: 'higher-better',
      category: 'tool',
    })

    return {
      metrics,
      diagnostics: {
        hasJson,
        claimedIds,
        authenticIds,
        expectedIds: gt.expectedIds,
      },
    }
  },
}

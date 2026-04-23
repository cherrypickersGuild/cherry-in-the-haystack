/**
 * SET 5 — Constrained Deal Hunter evaluator.
 *
 * Task: 3 cheapest LG Gram 16" under $700, sealed, AND seller name NOT
 * containing "refurb" or "used". Return JSON array with {id, title, price,
 * seller, posted_at}.
 *
 * Metrics:
 *   - JSON schema pass
 *   - Listing authenticity (ids in DB)
 *   - All-constraints pass per record (seller clean + sealed + price<700)
 *   - Recall@3 vs clean-top-3 ground truth
 *   - Invented count (ids not in DB)
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

interface StrictHunterGroundTruth {
  expectedIds: string[] // top-3 CLEAN by price
  allMatching: MarketplaceListing[] // all records passing brand/model/sealed/price
  sellerBlocklist: RegExp
  requiredFields: string[]
  filter: {
    brand: string
    model: string
    maxPrice: number
    sealedOnly: true
  }
}

export function captureStrictHunterGroundTruth(input: {
  expectedIds: string[]
  requiredFields: string[]
  filter: {
    brand: string
    model: string
    maxPrice: number
    sealedOnly: true
  }
  sellerBlocklist: string[]
}): StrictHunterGroundTruth {
  const all = searchMarketplace({
    query: `${input.filter.brand} ${input.filter.model}`,
    max_price: input.filter.maxPrice,
    sealed_only: input.filter.sealedOnly,
  }).listings
  const blocklistRegex = new RegExp(input.sellerBlocklist.join('|'), 'i')
  return {
    expectedIds: input.expectedIds,
    allMatching: all,
    sellerBlocklist: blocklistRegex,
    requiredFields: input.requiredFields,
    filter: input.filter,
  }
}

function unfence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

function extractJsonArray(text: string): unknown[] | null {
  const clean = unfence(text)
  try {
    const d = JSON.parse(clean)
    if (Array.isArray(d)) return d
    if (Array.isArray((d as any)?.listings)) return (d as any).listings
    if (Array.isArray((d as any)?.results)) return (d as any).results
  } catch {
    /* fall through */
  }
  const first = clean.indexOf('[')
  const last = clean.lastIndexOf(']')
  if (first !== -1 && last > first) {
    try {
      const p = JSON.parse(clean.slice(first, last + 1))
      if (Array.isArray(p)) return p
    } catch {
      /* ignore */
    }
  }
  return null
}

export const set5StrictHunterEvaluator: Evaluator = {
  id: 'set-5-strict-hunter',
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gt = ctx.groundTruth as StrictHunterGroundTruth
    const metrics: Metric[] = []

    const parsed = extractJsonArray(ctx.answer ?? '')
    const hasJson = parsed !== null

    // Claimed records
    const records: Array<Record<string, unknown>> = []
    if (hasJson && parsed) {
      for (const it of parsed) {
        if (typeof it === 'object' && it !== null)
          records.push(it as Record<string, unknown>)
      }
    }

    // ── Metric 1: Schema pass ──
    const allFields = gt.requiredFields
    const schemaPass =
      hasJson &&
      records.length === 3 &&
      records.every((r) => allFields.every((f) => f in r))
    metrics.push({
      id: 'schemaPass',
      label: 'JSON schema pass (3 items, all fields)',
      value: schemaPass ? 'Yes' : 'No',
      passed: schemaPass,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Metric 2: Listing authenticity ──
    const claimedIds = records
      .map((r) => String(r.id ?? ''))
      .filter(Boolean)
    const authenticIds = claimedIds.filter((id) =>
      gt.allMatching.some((l) => l.id === id),
    )
    metrics.push({
      id: 'authenticity',
      label: 'Authentic listings (in DB)',
      value: `${authenticIds.length} / ${Math.max(claimedIds.length, 0)}`,
      passed: claimedIds.length > 0 && authenticIds.length === claimedIds.length,
      direction: 'higher-better',
      category: 'hallucination',
    })

    // ── Metric 3: All-constraints pass per record ──
    // (seller clean + sealed=true + price<maxPrice + matches brand/model via DB membership)
    let passCount = 0
    for (const id of claimedIds) {
      const dbRec = gt.allMatching.find((l) => l.id === id)
      if (!dbRec) continue
      const sellerClean = !gt.sellerBlocklist.test(dbRec.seller)
      const priceOk = dbRec.price < gt.filter.maxPrice
      const sealedOk = dbRec.sealed === true
      if (sellerClean && priceOk && sealedOk) passCount++
    }
    metrics.push({
      id: 'constraintsPass',
      label: 'All-constraints pass per record',
      value: `${passCount} / 3`,
      passed: passCount === 3,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 4: Recall@3 vs clean ground truth ──
    const top3 = claimedIds.slice(0, 3)
    const recallHits = top3.filter((id) => gt.expectedIds.includes(id)).length
    metrics.push({
      id: 'recallAt3',
      label: 'Recall@3 vs clean DB top-3',
      value: `${recallHits} / 3`,
      passed: recallHits === 3,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 5: Invented count ──
    const invented = claimedIds.filter(
      (id) => !gt.allMatching.some((l) => l.id === id),
    ).length
    metrics.push({
      id: 'inventedCount',
      label: 'Invented listings (not in DB)',
      value: invented,
      passed: invented === 0,
      direction: 'lower-better',
      category: 'hallucination',
    })

    // ── Metric 6: Tool calls ──
    metrics.push({
      id: 'toolCalls',
      label: 'Tool calls',
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
        passCount,
        recallHits,
        invented,
        expectedIds: gt.expectedIds,
      },
    }
  },
}

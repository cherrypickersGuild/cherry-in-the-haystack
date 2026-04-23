/**
 * SET 4 — Multi-Asset Crypto Analyst evaluator.
 *
 * Task: given BTC/ETH/SOL, output JSON
 *   { assets: [{sym, price, change24h, captured_at, source}],
 *     biggest_mover: { sym, abs_change_pct } }
 *
 * Metrics:
 *   - JSON schema pass (parse + required top-level fields)
 *   - Asset count === 3
 *   - All 3 symbols present (BTC / ETH / SOL)
 *   - Avg price error % (avg across assets, vs CoinGecko truth)
 *   - biggest_mover correct (sym matches truth max-|change|)
 *   - Citation count per asset (source/captured_at present on each)
 *   - Tool calls (informational)
 */

import {
  fetchCryptoPrice,
  type CryptoPriceResult,
} from '../tools/coingecko.tool'
import type {
  EvalContext,
  EvalResult,
  Evaluator,
  Metric,
} from './types'

interface QuantGroundTruth {
  prices: CryptoPriceResult[]
  fetchedAt: string
}

export async function captureQuantGroundTruth(
  symbols: string[],
): Promise<QuantGroundTruth> {
  const prices = await Promise.all(symbols.map((s) => fetchCryptoPrice(s)))
  return { prices, fetchedAt: new Date().toISOString() }
}

function unfence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

function tryParseJson(text: string): unknown | null {
  const clean = unfence(text)
  try {
    return JSON.parse(clean)
  } catch {
    // heuristic: grab first {...} span
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(clean.slice(first, last + 1))
      } catch {
        /* ignore */
      }
    }
    return null
  }
}

export const set4QuantEvaluator: Evaluator = {
  id: 'set-4-quant',
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gt = ctx.groundTruth as QuantGroundTruth
    const metrics: Metric[] = []

    const parsed = tryParseJson(ctx.answer ?? '')
    const hasJson =
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as any).assets) &&
      typeof (parsed as any).biggest_mover === 'object'

    // ── Metric 1: JSON schema pass ──
    metrics.push({
      id: 'schemaPass',
      label: 'JSON schema pass',
      value: hasJson ? 'Yes' : 'No',
      passed: hasJson,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Work variables ──
    const assets: Array<Record<string, unknown>> = hasJson
      ? ((parsed as any).assets as Array<Record<string, unknown>>)
      : []
    const biggestMover: Record<string, unknown> = hasJson
      ? ((parsed as any).biggest_mover as Record<string, unknown>)
      : {}

    // ── Metric 2: Asset count ──
    const assetCount = assets.length
    metrics.push({
      id: 'assetCount',
      label: 'Asset count (expected 3)',
      value: `${assetCount} / 3`,
      passed: assetCount === 3,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Metric 3: Symbols coverage ──
    const requiredSyms = gt.prices.map((p) => p.symbol.toUpperCase())
    const reportedSyms = assets
      .map((a) => String(a.sym ?? a.symbol ?? '').toUpperCase())
      .filter(Boolean)
    const covered = requiredSyms.filter((s) => reportedSyms.includes(s))
    metrics.push({
      id: 'symbolCoverage',
      label: 'Symbols covered (BTC/ETH/SOL)',
      value: `${covered.length} / ${requiredSyms.length}`,
      passed: covered.length === requiredSyms.length,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 4: Avg price error % ──
    const errors: number[] = []
    for (const a of assets) {
      const sym = String(a.sym ?? a.symbol ?? '').toUpperCase()
      const truth = gt.prices.find((p) => p.symbol.toUpperCase() === sym)
      if (!truth) continue
      const raw = a.price ?? a.priceUsd
      const n =
        typeof raw === 'number'
          ? raw
          : parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''))
      if (Number.isNaN(n)) continue
      errors.push((Math.abs(n - truth.priceUsd) / truth.priceUsd) * 100)
    }
    const avgErr =
      errors.length > 0
        ? errors.reduce((s, e) => s + e, 0) / errors.length
        : null
    metrics.push({
      id: 'avgPriceErrorPct',
      label: 'Avg price error %',
      value: avgErr === null ? '—' : `${avgErr.toFixed(2)}%`,
      passed: avgErr !== null && avgErr < 5,
      direction: 'lower-better',
      category: 'accuracy',
    })

    // ── Metric 5: biggest_mover correct ──
    const truthMover = [...gt.prices].sort(
      (a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct),
    )[0]
    const claimedMoverSym = String(
      biggestMover.sym ?? biggestMover.symbol ?? '',
    ).toUpperCase()
    const moverCorrect =
      hasJson &&
      !!truthMover &&
      claimedMoverSym === truthMover.symbol.toUpperCase()
    metrics.push({
      id: 'biggestMoverCorrect',
      label: 'biggest_mover correct',
      value: moverCorrect
        ? `✓ ${claimedMoverSym}`
        : claimedMoverSym
          ? `✗ ${claimedMoverSym} (truth: ${truthMover?.symbol})`
          : '—',
      passed: moverCorrect,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 6: Citation per asset ──
    let citedCount = 0
    for (const a of assets) {
      if (a.source || a.captured_at || a.capturedAt || a.timestamp) {
        citedCount++
      }
    }
    metrics.push({
      id: 'citationPerAsset',
      label: 'Citations per asset (source/timestamp)',
      value: `${citedCount} / ${Math.max(assetCount, 1)}`,
      passed: citedCount === assetCount && assetCount > 0,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // ── Metric 7: Tool calls ──
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
        assetCount,
        coveredSyms: covered,
        reportedSyms,
        truthMover: truthMover?.symbol,
        claimedMoverSym,
        errors,
      },
    }
  },
}

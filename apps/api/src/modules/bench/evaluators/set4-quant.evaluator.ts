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
    // Loose: require { assets: [...] } with SOME biggest_mover present
    // (can be object OR string label). Phase 2.5 prompts don't force the
    // biggest_mover sub-shape — skills may or may not impose it.
    const hasJson =
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as any).assets) &&
      (parsed as any).biggest_mover !== undefined

    // ── Metric 1: JSON schema pass ──
    metrics.push({
      id: 'schemaPass',
      label: 'Clean structured output',
      value: hasJson ? 'Yes' : 'No',
      passed: hasJson,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Work variables ──
    const assets: Array<Record<string, unknown>> = hasJson
      ? ((parsed as any).assets as Array<Record<string, unknown>>)
      : []
    const rawMover = hasJson ? (parsed as any).biggest_mover : undefined
    // Accept both { sym: "ETH", ... } AND bare string "ETH".
    const biggestMover: Record<string, unknown> =
      typeof rawMover === 'string'
        ? { sym: rawMover }
        : typeof rawMover === 'object' && rawMover !== null
          ? (rawMover as Record<string, unknown>)
          : {}

    // ── Metric 2: Asset count ──
    const assetCount = assets.length
    metrics.push({
      id: 'assetCount',
      label: 'All 3 coins covered',
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
      label: 'BTC · ETH · SOL all present',
      value: `${covered.length} / ${requiredSyms.length}`,
      passed: covered.length === requiredSyms.length,
      direction: 'higher-better',
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
      label: 'Top mover identified correctly',
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
      label: 'Source shown on every claim',
      value: `${citedCount} / ${Math.max(assetCount, 1)}`,
      passed: citedCount === assetCount && assetCount > 0,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // ── Artifact metrics (Phase 2.5) ──
    // Each counts a literal artifact produced by a specific skill. Removing
    // the skill deterministically removes the artifact — deterministic drop.

    // stepFieldCount — decomp skill injects a "step" field on each asset.
    const stepCount = assets.filter(
      (a) => a.step !== undefined && a.step !== null,
    ).length
    metrics.push({
      id: 'stepFieldCount',
      label: 'Step-by-step breakdown included',
      value: `${stepCount} / ${Math.max(assetCount, 1)}`,
      passed: stepCount === assetCount && assetCount > 0,
      direction: 'higher-better',
      category: 'completion',
    })

    // startsWithJson — json-strict skill forces pure JSON output.
    const trimmed = (ctx.answer ?? '').trim().replace(/^```(?:json)?\s*/i, '')
    const firstChar = trimmed.charAt(0)
    const startsJson = firstChar === '{' || firstChar === '['
    metrics.push({
      id: 'startsWithJson',
      label: 'Pure JSON (no chit-chat)',
      value: startsJson ? 'Yes' : 'No',
      passed: startsJson,
      direction: 'higher-better',
      category: 'completion',
    })

    // sourceTokenCount — citation skill requires literal "source:" token
    // per numeric claim. Count across the full answer.
    const sourceTokens = (ctx.answer ?? '').match(/source:/gi) ?? []
    metrics.push({
      id: 'sourceTokenCount',
      label: 'Source tags per fact',
      value: sourceTokens.length,
      passed:
        assetCount > 0 && sourceTokens.length >= assetCount,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // planStepsExecuted — plan-execute orchestration injects a
    // "plan_steps_executed" field into the final answer.
    const planStepsField = hasJson
      ? (parsed as Record<string, unknown>).plan_steps_executed
      : undefined
    const planStepsCount = Array.isArray(planStepsField)
      ? planStepsField.length
      : 0
    metrics.push({
      id: 'planStepsExecuted',
      label: 'Plan steps executed',
      value: planStepsCount,
      passed: planStepsCount > 0,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Metric 7: Tool calls ──
    metrics.push({
      id: 'toolCalls',
      label: 'Live price fetches',
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
      },
    }
  },
}

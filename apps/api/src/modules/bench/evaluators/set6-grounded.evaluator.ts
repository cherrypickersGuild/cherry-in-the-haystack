/**
 * SET 6 — Grounded Policy Analyst (abstention test) evaluator.
 *
 * Task: for Karma tiers Platinum + Bronze, report (1) revenue share %,
 * (2) minimum monthly contribution, (3) tier-exclusive perks. Compute gap.
 * Cite doc IDs. Flag missing fields with `missing: <field>`.
 *
 * Seed karma-v2.md intentionally contains ONLY revenue share — monthly
 * contribution and perks are absent. Well-equipped build flags both as
 * missing. Baseline fabricates values.
 *
 * Metrics:
 *   - Key fact accuracy — regex match on 70% (Platinum) + 30% (Bronze)
 *   - revenue gap correct (==40 or "40pp")
 *   - Doc ID citations (regex `[doc:...]`)
 *   - Missing-field flagged (monthly + perks)
 *   - Hallucinated facts (LLM judge: ratio of unsupported claims)
 *   - Tool calls
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { askJudge } from './llm-judge'
import type {
  EvalContext,
  EvalResult,
  Evaluator,
  Metric,
} from './types'

interface GroundedGroundTruth {
  expectedDocIds: string[]
  keyFacts: { pattern: RegExp; description: string }[]
  expectedMissing: string[] // field names that should be "missing: ..."
  docContent: string // full karma-v2.md text for judge context
}

const SEED_DIR = join(__dirname, '..', 'seed')

export function captureGroundedGroundTruth(input: {
  expectedDocIds: string[]
  keyFacts: { pattern: RegExp; description: string }[]
  expectedMissing: string[]
}): GroundedGroundTruth {
  const docContent = readFileSync(join(SEED_DIR, 'karma-v2.md'), 'utf-8')
  return { ...input, docContent }
}

interface JudgeOutput {
  unsupported_claims?: string[]
  total_claims?: number
}

export const set6GroundedEvaluator: Evaluator = {
  id: 'set-6-grounded',
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gt = ctx.groundTruth as GroundedGroundTruth
    const answer = ctx.answer ?? ''
    const metrics: Metric[] = []

    // ── Metric 1: Key fact accuracy ──
    const keyHits = gt.keyFacts.filter((k) => k.pattern.test(answer))
    metrics.push({
      id: 'keyFactAccuracy',
      label: 'Key facts correct',
      value: `${keyHits.length} / ${gt.keyFacts.length}`,
      passed: keyHits.length === gt.keyFacts.length,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 2: Revenue gap correct (==40) ──
    // Look for "40" near "gap", "difference", "pp" or "p.p."
    const gapPattern =
      /(gap|difference|spread)[^\d]{0,20}\b40\b|\b40\s*(pp|p\.p\.|percentage\s*points?)/i
    const gapCorrect = gapPattern.test(answer)
    metrics.push({
      id: 'revenueGapCorrect',
      label: 'Correct 40pp gap calculation',
      value: gapCorrect ? 'Yes' : 'No',
      passed: gapCorrect,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Metric 3: Doc-ID citations ──
    const citeMatches = answer.match(/\[doc:[^\]]+\]/gi) ?? []
    metrics.push({
      id: 'docCitations',
      label: 'Doc sources cited',
      value: citeMatches.length,
      passed: citeMatches.length >= 2,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // ── Metric 4: Missing fields flagged ──
    // The spec fields are NOT in karma-v2.md: monthly contribution + perks.
    // Well-equipped answer uses `missing: ...` (or similar) to flag each.
    const missingFlaggedCount = gt.expectedMissing.filter((field) => {
      const normalized = field.toLowerCase()
      // Looks for "missing: <field>" or "missing - <field>" or bare "missing ... <field>"
      const re = new RegExp(
        `missing[\\s:\\-]+[^\\n]*${normalized.split(/\s+/)[0]}`,
        'i',
      )
      return re.test(answer)
    }).length
    metrics.push({
      id: 'missingFlagged',
      label: 'Flagged the gaps in docs',
      value: `${missingFlaggedCount} / ${gt.expectedMissing.length}`,
      passed: missingFlaggedCount === gt.expectedMissing.length,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // ── Metric 5: Hallucinated facts (LLM judge) ──
    let hallucPct: number | null = null
    let judgeDiag: unknown = null
    try {
      const judge = await askJudge<JudgeOutput>({
        id: 'set6-halluc',
        answer,
        context: gt.docContent,
        instruction:
          'Count factual claims in ANSWER that are NOT supported by CONTEXT. Only count concrete factual assertions (numbers, field values, percentages, category counts). Ignore meta-commentary. Also return the total number of concrete factual assertions in ANSWER.',
        outputShape:
          '{ "unsupported_claims": ["<string>", ...], "total_claims": <integer> }',
      })
      const unsupported = Array.isArray(judge.parsed.unsupported_claims)
        ? judge.parsed.unsupported_claims.length
        : 0
      const total = Math.max(1, judge.parsed.total_claims ?? unsupported)
      hallucPct = (unsupported / total) * 100
      judgeDiag = judge.parsed
    } catch (err) {
      // Judge failure should not crash the evaluation
      judgeDiag = { error: (err as Error).message }
    }
    metrics.push({
      id: 'hallucinatedFactsPct',
      label: 'Made-up facts',
      value: hallucPct === null ? '—' : `${hallucPct.toFixed(0)}%`,
      passed: hallucPct !== null && hallucPct <= 10,
      direction: 'lower-better',
      category: 'hallucination',
    })

    // ── Artifact metrics (Phase 2.5) ──

    // multihopSearchCount — multihop skill demands >= 2 separate search calls.
    const searchCount = ctx.toolCalls.filter(
      (t) => (t as { name?: string }).name === 'search_catalog',
    ).length
    metrics.push({
      id: 'multihopSearchCount',
      label: 'Multiple targeted searches',
      value: searchCount,
      passed: searchCount >= 2,
      direction: 'higher-better',
      category: 'tool',
    })

    // planStepsExecuted — plan-execute orchestration injects a
    // "plan_steps_executed" field. Detect via literal string presence so
    // it works whether the answer is JSON or prose.
    const planMatches = answer.match(/plan_steps_executed/gi) ?? []
    metrics.push({
      id: 'planStepsExecuted',
      label: 'Planned before answering',
      value: planMatches.length > 0 ? 'Yes' : 'No',
      passed: planMatches.length > 0,
      direction: 'higher-better',
      category: 'completion',
    })

    // ── Metric 6: Tool calls ──
    metrics.push({
      id: 'toolCalls',
      label: 'Doc lookups',
      value: ctx.toolCalls.length,
      direction: 'higher-better',
      category: 'tool',
    })

    return {
      metrics,
      diagnostics: {
        keyHits: keyHits.map((k) => k.description),
        citeMatches,
        gapCorrect,
        missingFlaggedCount,
        hallucPct,
        judge: judgeDiag,
      },
    }
  },
}

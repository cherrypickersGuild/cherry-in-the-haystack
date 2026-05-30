/**
 * SET 3 — Cherry Policy Expert evaluator.
 *
 * Scores answers on domain grounding. Metrics:
 *   - Doc-ID citation count
 *   - Key fact accuracy (70% / 30%)
 *   - Hallucinated claims (LLM-as-judge vs karma-v2 doc)
 *   - Tool calls
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type {
  EvalContext,
  EvalResult,
  Evaluator,
  Metric,
} from './types'
import { askJudge } from './llm-judge'

interface GroundTruth {
  docIds: string[]
  keyFacts: Array<{ id: string; regex: string; description: string }>
  docContent: string
}

const SEED_DIR = join(__dirname, '..', 'seed')

/** Capture ground truth — load the canonical karma-v2 doc from disk. */
export function capturePolicyGroundTruth(
  docIds: string[],
  keyFacts: Array<{ id: string; regex: string; description: string }>,
): GroundTruth {
  const docContent = readFileSync(
    join(SEED_DIR, `${docIds[0]}.md`),
    'utf-8',
  )
  return { docIds, keyFacts, docContent }
}

interface JudgeOutput {
  total_claims: number
  unsupported_claims: string[]
}

export const set3PolicyEvaluator: Evaluator = {
  id: 'set-3-policy',
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gt = ctx.groundTruth as GroundTruth
    const answer = ctx.answer ?? ''
    const metrics: Metric[] = []

    // ── Doc ID citations ──
    const docIdPattern = /\[doc:[^\]]+\]/g
    const citations = answer.match(docIdPattern) ?? []
    metrics.push({
      id: 'docCitationCount',
      label: 'Doc sources cited',
      value: citations.length,
      passed: citations.length > 0,
      direction: 'higher-better',
      category: 'groundedness',
    })

    // ── Key fact accuracy (Platinum 70 / Bronze 30) ──
    let keyFactHits = 0
    const keyFactMatches: Record<string, boolean> = {}
    for (const f of gt.keyFacts) {
      const hit = new RegExp(f.regex, 'i').test(answer)
      keyFactMatches[f.id] = hit
      if (hit) keyFactHits++
    }
    metrics.push({
      id: 'keyFactAccuracy',
      label: 'Key facts correct',
      value: `${keyFactHits} / ${gt.keyFacts.length}`,
      passed: keyFactHits === gt.keyFacts.length,
      direction: 'higher-better',
      category: 'accuracy',
    })

    // ── Hallucinated claims (judge) ──
    // Only run judge if there's something to evaluate.
    let hallucinatedClaimPct: number | null = null
    let unsupportedClaims: string[] = []
    let totalClaims = 0
    try {
      const judge = await askJudge<JudgeOutput>({
        id: 'set3-policy-halluc',
        instruction: `Read ANSWER and list every factual claim about Cherry's Karma tier system. For each claim, decide if the CONTEXT doc supports it. Count only claims that can be verified against CONTEXT (ignore generic advice, disclaimers, or "I don't know" statements). Return the total number of factual claims and the list of claims NOT supported by CONTEXT.`,
        context: gt.docContent,
        answer,
        outputShape: `{"total_claims": <integer>, "unsupported_claims": [<string claim>, ...]}`,
      })
      totalClaims = judge.parsed.total_claims ?? 0
      unsupportedClaims = judge.parsed.unsupported_claims ?? []
      hallucinatedClaimPct =
        totalClaims === 0
          ? 0
          : Math.round((unsupportedClaims.length / totalClaims) * 100)
    } catch (err) {
      // Judge failure shouldn't break the whole evaluation.
      hallucinatedClaimPct = null
    }
    metrics.push({
      id: 'hallucinatedClaims',
      label: 'Made-up facts',
      value:
        hallucinatedClaimPct === null ? '—' : `${hallucinatedClaimPct}%`,
      passed:
        hallucinatedClaimPct !== null && hallucinatedClaimPct <= 10,
      direction: 'lower-better',
      category: 'hallucination',
    })

    // ── Tool calls ──
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
        citations,
        keyFactMatches,
        totalClaims,
        unsupportedClaims,
      },
    }
  },
}

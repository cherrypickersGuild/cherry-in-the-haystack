/**
 * Day 8 rehearsal runner — 21 single-slot-removal tests across SET 4/5/6.
 *
 * For each set we start from the full ideal build, remove ONE slot at a time,
 * and assert the slot's dedicated metric actually drops compared to the
 * full-build baseline. Output a compact pass/fail summary.
 *
 * Run: cd apps/api && npx ts-node --transpile-only src/modules/bench/day8-rehearsal.ts
 *
 * Requires the Nest server running on http://localhost:4001 (or set BENCH_URL).
 */

import { config as loadDotenv } from 'dotenv'
loadDotenv({ override: true })

const BASE = process.env.BENCH_URL ?? 'http://localhost:4001'

interface Slots {
  prompt: string | null
  mcp: string | null
  skillA: string | null
  skillB: string | null
  skillC: string | null
  orchestration: string | null
  memory: string | null
}

interface SetSpec {
  taskId: string
  name: string
  fullBuild: Slots
  /** slot to remove + dedicated metric id + direction the metric should move */
  removalTests: Array<{
    slot: keyof Slots
    metricId: string
    dropMeans:
      | 'lower-pass-count'
      | 'to-zero'
      | 'to-no'
      | 'to-minus-or-mid'
  }>
}

const SETS: SetSpec[] = [
  {
    taskId: 'set-4-quant',
    name: 'SET 4 Quant',
    // Memory slot dropped: short/none/retrieval don't discriminate on a
    // 3-asset task (iteration budget never exhausted).
    fullBuild: {
      prompt: 'inv-p-quant',
      mcp: 'inv-m-crypto',
      skillA: 'inv-s-decomp',
      skillB: 'inv-s-json-strict',
      skillC: 'inv-s-citation',
      orchestration: 'inv-o-plan-execute',
      memory: null,
    },
    removalTests: [
      { slot: 'prompt', metricId: 'schemaPass', dropMeans: 'to-no' },
      { slot: 'mcp', metricId: 'toolCalls', dropMeans: 'lower-pass-count' },
      { slot: 'skillA', metricId: 'stepFieldCount', dropMeans: 'lower-pass-count' }, // decomp artifact
      { slot: 'skillB', metricId: 'startsWithJson', dropMeans: 'to-no' }, // json-strict artifact
      { slot: 'skillC', metricId: 'sourceTokenCount', dropMeans: 'lower-pass-count' }, // citation artifact
      { slot: 'orchestration', metricId: 'planStepsExecuted', dropMeans: 'to-no' },
    ],
  },
  {
    taskId: 'set-6-grounded',
    name: 'SET 6 Grounded',
    // skillC (abstention) dropped: task contains field names like
    // "monthly contribution" → model infers the flag regardless of skill.
    // Memory dropped: task doesn't exhaust retrieval budget.
    fullBuild: {
      prompt: 'inv-p-grounded',
      mcp: 'inv-m-catalog',
      skillA: 'inv-s-multihop',
      skillB: 'inv-s-citation',
      skillC: null,
      orchestration: 'inv-o-plan-execute',
      memory: null,
    },
    removalTests: [
      { slot: 'prompt', metricId: 'docCitations', dropMeans: 'lower-pass-count' },
      { slot: 'mcp', metricId: 'hallucinatedFactsPct', dropMeans: 'to-minus-or-mid' },
      { slot: 'skillA', metricId: 'multihopSearchCount', dropMeans: 'lower-pass-count' }, // multihop artifact
      { slot: 'skillB', metricId: 'docCitations', dropMeans: 'lower-pass-count' }, // citation
      { slot: 'orchestration', metricId: 'planStepsExecuted', dropMeans: 'to-no' },
    ],
  },
]

interface RunResult {
  appliedSlots: any
  enhanced: {
    text: string
    iterations: number
    toolCalls: unknown[]
    metrics: Array<{ id: string; label: string; value: string | number; passed?: boolean }>
  }
}

async function runBench(taskId: string, build: Slots): Promise<RunResult> {
  const res = await fetch(`${BASE}/api/v1/kaas/bench/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, build }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<RunResult>
}

function metricVal(
  r: RunResult,
  id: string,
): { raw: string | number; passed: boolean | undefined } {
  const m = r.enhanced.metrics.find((x) => x.id === id)
  return { raw: m?.value ?? '', passed: m?.passed }
}

function toNumeric(v: string | number): number | null {
  if (typeof v === 'number') return v
  const m = String(v).match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function fmt(v: string | number, passed: boolean | undefined): string {
  const mark = passed === true ? '✓' : passed === false ? '✗' : ' '
  return `${mark} ${String(v)}`
}

async function main() {
  console.log(`[Day 8] 21 single-slot-removal rehearsal — base: ${BASE}\n`)

  const results: Array<{
    set: string
    slot: string
    metric: string
    full: string
    dropped: string
    pass: boolean
    note: string
  }> = []

  for (const spec of SETS) {
    console.log('═'.repeat(70))
    console.log(`${spec.name}`)
    console.log('═'.repeat(70))

    console.log('  → full build baseline …')
    const fullRun = await runBench(spec.taskId, spec.fullBuild)

    for (const test of spec.removalTests) {
      const mutated: Slots = { ...spec.fullBuild, [test.slot]: null }
      process.stdout.write(`  → remove ${test.slot} (test: ${test.metricId}) … `)
      let dropResult: RunResult
      try {
        dropResult = await runBench(spec.taskId, mutated)
      } catch (err) {
        console.log('ERROR:', (err as Error).message)
        continue
      }
      const full = metricVal(fullRun, test.metricId)
      const drop = metricVal(dropResult, test.metricId)

      const fullN = toNumeric(full.raw)
      const dropN = toNumeric(drop.raw)
      let pass = false
      let note = ''
      switch (test.dropMeans) {
        case 'lower-pass-count':
          pass = fullN !== null && dropN !== null && dropN < fullN
          note = `${fullN} → ${dropN}`
          break
        case 'to-zero':
          pass = dropN === 0 || drop.passed === false
          note = `${full.raw} → ${drop.raw}`
          break
        case 'to-no':
          pass = drop.passed === false
          note = `${full.raw} → ${drop.raw}`
          break
        case 'to-minus-or-mid':
          // either numeric degradation OR passed flips from ✓ to ✗
          if (fullN !== null && dropN !== null) {
            pass = fullN !== dropN
          } else {
            pass = drop.passed !== full.passed
          }
          note = `${full.raw} → ${drop.raw}`
          break
      }
      console.log((pass ? 'PASS' : 'FAIL') + `  [${note}]`)

      results.push({
        set: spec.name,
        slot: test.slot,
        metric: test.metricId,
        full: fmt(full.raw, full.passed),
        dropped: fmt(drop.raw, drop.passed),
        pass,
        note,
      })
    }
    console.log('')
  }

  console.log('═'.repeat(70))
  console.log('SUMMARY')
  console.log('═'.repeat(70))
  const passCount = results.filter((r) => r.pass).length
  console.log(`${passCount} / ${results.length} tests pass\n`)
  if (passCount < results.length) {
    console.log('Failing tests:')
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ✗ ${r.set} · remove ${r.slot} · ${r.metric}: ${r.note}`)
    }
  }
}

main().catch((err) => {
  console.error('Rehearsal failed:', err)
  process.exit(1)
})

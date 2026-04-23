/**
 * End-to-end smoke: run baseline + enhanced for all 3 sets,
 * evaluate each, print metric deltas.
 *
 *   cd apps/api && npx ts-node --transpile-only src/modules/bench/smoke-eval.ts
 */

import { config as loadDotenv } from 'dotenv'
loadDotenv({ override: true })

import { BENCH_SETS, type BenchSetDefinition } from './sets/set-definitions'
import { callClaude, type ClaudeCallResult } from './anthropic.client'
import {
  buildToolDispatcher,
  type BenchTool,
} from './tools/tool-registry'
import { coingeckoTool } from './tools/coingecko.tool'
import { marketplaceTool } from './tools/marketplace.tool'
import { catalogTool } from './tools/catalog.tool'
import { getEvaluator } from './evaluators'
import { captureOracleGroundTruth } from './evaluators/set1-oracle.evaluator'
import { captureHunterGroundTruth } from './evaluators/set2-hunter.evaluator'
import { capturePolicyGroundTruth } from './evaluators/set3-policy.evaluator'
import type { Metric } from './evaluators'

const TOOL_BY_NAME: Record<string, BenchTool> = {
  get_crypto_price: coingeckoTool,
  search_marketplace: marketplaceTool,
  search_catalog: catalogTool,
}

function toolsFor(set: BenchSetDefinition): BenchTool[] {
  return set.tools.map((t) => {
    const tool = TOOL_BY_NAME[t.name]
    if (!tool) throw new Error(`[smoke-eval] No tool impl for ${t.name}`)
    return tool
  })
}

async function captureGroundTruth(set: BenchSetDefinition): Promise<unknown> {
  const c = set.evalCriteria
  if (c.kind === 'oracle') {
    return captureOracleGroundTruth(c.symbols.map((s) => s.symbol))
  }
  if (c.kind === 'hunter') {
    return captureHunterGroundTruth(c.expectedIds, c.requiredFields, c.filter)
  }
  if (c.kind === 'policy') {
    return capturePolicyGroundTruth(c.expectedDocIds, c.keyFacts)
  }
  // Phase 2 kinds not supported by this legacy Phase 1 script. The main
  // smoke path is the HTTP `/v1/kaas/bench/run` + curl — not this file.
  throw new Error(`[smoke-eval] kind ${c.kind} handled by service layer only`)
}

function section(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log(title)
  console.log('═'.repeat(70))
}

function line(label: string) {
  console.log('\n' + '─'.repeat(70))
  console.log(label)
  console.log('─'.repeat(70))
}

function formatMetrics(title: string, metrics: Metric[]) {
  console.log(`  ${title}:`)
  for (const m of metrics) {
    const pass =
      m.passed === true ? '✓' : m.passed === false ? '✗' : ' '
    console.log(
      `    ${pass} ${m.label.padEnd(40)}  ${String(m.value)}`,
    )
  }
}

async function runSet(set: BenchSetDefinition) {
  section(`[${set.id}] ${set.name}`)
  console.log(`task: ${set.task}`)

  line('capturing ground truth')
  const gt = await captureGroundTruth(set)
  console.log('  done.')

  // Baseline: no tools, no system.
  line('baseline call (no tools)')
  const baseline: ClaudeCallResult = await callClaude({
    messages: [{ role: 'user', content: set.task }],
    maxTokens: 500,
  })
  console.log(
    `  iters=${baseline.iterations} tokens=${baseline.usage.totalTokens} latency=${baseline.latencyMs}ms`,
  )
  console.log('  text (first 200 chars):', baseline.text.slice(0, 200).replace(/\n/g, ' '))

  // Enhanced: build tools from set + dispatcher.
  line('enhanced call (with tools)')
  const dispatcher = buildToolDispatcher(toolsFor(set))
  const enhanced: ClaudeCallResult = await callClaude({
    system: set.systemPrompt,
    tools: set.tools,
    toolDispatcher: dispatcher,
    messages: [{ role: 'user', content: set.task }],
    maxTokens: 800,
  })
  console.log(
    `  iters=${enhanced.iterations} tokens=${enhanced.usage.totalTokens} latency=${enhanced.latencyMs}ms toolCalls=${enhanced.toolCalls.length}`,
  )
  console.log('  text (first 300 chars):', enhanced.text.slice(0, 300).replace(/\n/g, ' '))

  // Evaluate both.
  line('evaluating')
  const evaluator = getEvaluator(set.evaluatorId)
  const baselineEval = await evaluator.evaluate({
    answer: baseline.text,
    hadTools: false,
    toolCalls: [],
    groundTruth: gt,
  })
  const enhancedEval = await evaluator.evaluate({
    answer: enhanced.text,
    hadTools: true,
    toolCalls: enhanced.toolCalls,
    groundTruth: gt,
  })

  formatMetrics('baseline', baselineEval.metrics)
  formatMetrics('enhanced', enhancedEval.metrics)

  return { baseline, enhanced, baselineEval, enhancedEval }
}

async function main() {
  for (const set of BENCH_SETS) {
    await runSet(set)
  }
  console.log('\n\n✅ end-to-end smoke OK')
}

main().catch((err) => {
  console.error('\n❌ smoke failed:', err)
  process.exit(1)
})

import { Injectable, Logger } from '@nestjs/common'

import {
  BENCH_SETS,
  getSetById,
  summarizeSet,
  type BenchSetDefinition,
  type BenchSetSummary,
} from './sets/set-definitions'
import {
  callClaude,
  type ClaudeCallResult,
  type ToolCallRecord,
} from './anthropic.client'
import {
  buildToolDispatcher,
  type BenchTool,
} from './tools/tool-registry'
import { coingeckoTool } from './tools/coingecko.tool'
import { marketplaceTool } from './tools/marketplace.tool'
import { catalogTool } from './tools/catalog.tool'
import { getEvaluator, type Metric } from './evaluators'
import { captureHunterGroundTruth } from './evaluators/set2-hunter.evaluator'
import { capturePolicyGroundTruth } from './evaluators/set3-policy.evaluator'
import { captureQuantGroundTruth } from './evaluators/set4-quant.evaluator'
import { captureGroundedGroundTruth } from './evaluators/set6-grounded.evaluator'
import {
  composeRuntime,
  type AgentBuildInput,
  type RuntimeConfig,
} from './cards/compose-runtime'

/* ── tool name → impl lookup ─────────────────────────────────────── */
const TOOL_IMPL: Record<string, BenchTool> = {
  get_crypto_price: coingeckoTool,
  search_marketplace: marketplaceTool,
  search_catalog: catalogTool,
}

/* ── response shapes ──────────────────────────────────────────────── */
export interface BenchCompareSide {
  text: string
  latencyMs: number
  tokens: {
    input: number
    output: number
    total: number
  }
  iterations: number
  toolCalls: ToolCallRecord[]
  metrics: Metric[]
}

export interface BenchCompareResponse {
  setId: string
  setName: string
  task: string
  skills: string[]
  toolNames: string[]
  systemPrompt: string
  groundTruthSummary: string
  baseline: BenchCompareSide
  enhanced: BenchCompareSide
  runAt: string
}

/** Response from the new `/run` endpoint. Same shape as compare, plus
 *  `appliedSlots` diagnostic so the UI can show which parts of the build
 *  actually reached Claude. */
export interface BenchRunResponse extends BenchCompareResponse {
  appliedSlots: RuntimeConfig['appliedSlots']
  memoryMode: string
  maxIterations: number
}

/* ── service ──────────────────────────────────────────────────────── */
@Injectable()
export class BenchService {
  private readonly logger = new Logger(BenchService.name)

  /** GET /v1/kaas/bench/sets — UI chrome only. */
  listSets(): BenchSetSummary[] {
    return BENCH_SETS.map(summarizeSet)
  }

  /** POST /v1/kaas/bench/compare { setId } — real baseline + enhanced run. */
  async compare(setId: string): Promise<BenchCompareResponse> {
    const set = getSetById(setId)
    if (!set) {
      throw new Error(`Unknown benchmark set: ${setId}`)
    }

    this.logger.log(`[bench] compare start · setId=${setId}`)

    // Capture ground truth first. Both baseline and enhanced are evaluated
    // against the SAME snapshot so they're comparable.
    const groundTruth = await this.captureGroundTruth(set)
    const groundTruthSummary = this.summarizeGroundTruth(set, groundTruth)

    // Baseline and enhanced can run in parallel — they don't share state.
    const [baseline, enhanced] = await Promise.all([
      this.runBaseline(set),
      this.runEnhanced(set),
    ])

    const evaluator = getEvaluator(set.evaluatorId)
    const [baselineEval, enhancedEval] = await Promise.all([
      evaluator.evaluate({
        answer: baseline.text,
        hadTools: false,
        toolCalls: [],
        groundTruth,
      }),
      evaluator.evaluate({
        answer: enhanced.text,
        hadTools: true,
        toolCalls: enhanced.toolCalls,
        groundTruth,
      }),
    ])

    this.logger.log(
      `[bench] compare done · setId=${setId} · baseline=${baseline.latencyMs}ms enhanced=${enhanced.latencyMs}ms`,
    )

    return {
      setId: set.id,
      setName: set.name,
      task: set.task,
      skills: set.skills,
      toolNames: set.tools.map((t) => t.name),
      systemPrompt: set.systemPrompt,
      groundTruthSummary,
      baseline: this.toSide(baseline, baselineEval.metrics),
      enhanced: this.toSide(enhanced, enhancedEval.metrics),
      runAt: new Date().toISOString(),
    }
  }

  /** POST /v1/kaas/bench/run { taskId, build } — uses the user's actual
   *  equipped Workshop build against a chosen task. The ONLY thing shared
   *  with /compare is the task + evaluator; system prompt / tools / memory
   *  come from the build via composeRuntime(). Empty slots = baseline-like. */
  async run(taskId: string, build: AgentBuildInput): Promise<BenchRunResponse> {
    const set = getSetById(taskId)
    if (!set) {
      throw new Error(`Unknown benchmark task: ${taskId}`)
    }

    this.logger.log(
      `[bench] run start · taskId=${taskId} · build=${JSON.stringify({
        p: build.prompt,
        m: build.mcp,
        me: build.memory,
      })}`,
    )

    const runtime = composeRuntime(build)

    const groundTruth = await this.captureGroundTruth(set)
    const groundTruthSummary = this.summarizeGroundTruth(set, groundTruth)

    // Baseline is ALWAYS the same — no prompt, no tools. Establishes the floor.
    const baselinePromise = callClaude({
      messages: [{ role: 'user', content: set.task }],
      maxTokens: 500,
    })

    // Enhanced runs with composed runtime. If slots are empty, runtime fields
    // are undefined / empty — the call degrades toward baseline naturally.
    const enhancedPromise = callClaude({
      system: runtime.systemPrompt,
      tools: runtime.tools.length > 0 ? runtime.tools : undefined,
      toolDispatcher: runtime.toolDispatcher,
      messages: [{ role: 'user', content: set.task }],
      maxTokens: 800,
      maxToolIterations: runtime.maxIterations,
      orchestration: runtime.orchestrationId,
    })

    const [baseline, enhanced] = await Promise.all([
      baselinePromise,
      enhancedPromise,
    ])

    const evaluator = getEvaluator(set.evaluatorId)
    const [baselineEval, enhancedEval] = await Promise.all([
      evaluator.evaluate({
        answer: baseline.text,
        hadTools: false,
        toolCalls: [],
        groundTruth,
      }),
      evaluator.evaluate({
        answer: enhanced.text,
        hadTools: runtime.tools.length > 0,
        toolCalls: enhanced.toolCalls,
        groundTruth,
      }),
    ])

    this.logger.log(
      `[bench] run done · taskId=${taskId} · applied=${JSON.stringify(runtime.appliedSlots)} · baseline=${baseline.latencyMs}ms enhanced=${enhanced.latencyMs}ms`,
    )

    return {
      setId: set.id,
      setName: set.name,
      task: set.task,
      skills: set.skills,
      toolNames: runtime.tools.map((t) => t.name),
      systemPrompt: runtime.systemPrompt ?? '',
      groundTruthSummary,
      baseline: this.toSide(baseline, baselineEval.metrics),
      enhanced: this.toSide(enhanced, enhancedEval.metrics),
      runAt: new Date().toISOString(),
      appliedSlots: runtime.appliedSlots,
      memoryMode: runtime.memoryMode,
      maxIterations: runtime.maxIterations,
    }
  }

  /* ── internals ────────────────────────────────────────────────── */

  private toSide(
    res: ClaudeCallResult,
    metrics: Metric[],
  ): BenchCompareSide {
    return {
      text: res.text,
      latencyMs: res.latencyMs,
      tokens: {
        input: res.usage.inputTokens,
        output: res.usage.outputTokens,
        total: res.usage.totalTokens,
      },
      iterations: res.iterations,
      toolCalls: res.toolCalls,
      metrics,
    }
  }

  private async runBaseline(
    set: BenchSetDefinition,
  ): Promise<ClaudeCallResult> {
    return callClaude({
      messages: [{ role: 'user', content: set.task }],
      maxTokens: 500,
    })
  }

  private async runEnhanced(
    set: BenchSetDefinition,
  ): Promise<ClaudeCallResult> {
    const tools = set.tools.map((t) => {
      const impl = TOOL_IMPL[t.name]
      if (!impl) throw new Error(`[bench] No tool impl for ${t.name}`)
      return impl
    })
    const dispatcher = buildToolDispatcher(tools)
    return callClaude({
      system: set.systemPrompt,
      tools: set.tools,
      toolDispatcher: dispatcher,
      messages: [{ role: 'user', content: set.task }],
      maxTokens: 800,
    })
  }

  private async captureGroundTruth(
    set: BenchSetDefinition,
  ): Promise<unknown> {
    const c = set.evalCriteria
    switch (c.kind) {
      case 'hunter':
        return captureHunterGroundTruth(
          c.expectedIds,
          c.requiredFields,
          c.filter,
        )
      case 'policy':
        return capturePolicyGroundTruth(c.expectedDocIds, c.keyFacts)
      case 'quant-multi':
        return captureQuantGroundTruth(c.symbols)
      case 'grounded-abstain':
        return captureGroundedGroundTruth({
          expectedDocIds: c.expectedDocIds,
          keyFacts: c.keyFacts.map((k) => ({
            pattern: new RegExp(k.regex, 'i'),
            description: k.description,
          })),
          expectedMissing: c.expectedMissing,
        })
    }
  }

  private summarizeGroundTruth(
    set: BenchSetDefinition,
    gt: unknown,
  ): string {
    const c = set.evalCriteria
    switch (c.kind) {
      case 'quant-multi': {
        const prices = (gt as any).prices as Array<{
          symbol: string
          priceUsd: number
          change24hPct: number
        }>
        return prices
          .map(
            (p) =>
              `${p.symbol} $${p.priceUsd.toLocaleString()} (${p.change24hPct >= 0 ? '+' : ''}${p.change24hPct}% 24h)`,
          )
          .join(' · ')
      }
      case 'hunter':
        return `seed DB · top 3 by price: ${c.expectedIds.join(' · ')}`
      case 'policy':
        return `${c.expectedDocIds.join(', ')} · ${c.keyFacts.map((f) => f.description).join(' · ')}`
      case 'grounded-abstain':
        return `${c.expectedDocIds.join(', ')} · expected missing: ${c.expectedMissing.join(' + ')}`
    }
  }
}

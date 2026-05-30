/**
 * Shared evaluator types.
 *
 * An `Evaluator.evaluate(context)` takes the Claude answer + context (tool calls,
 * ground truth, was-tools-available) and returns a list of `Metric` entries plus
 * any raw diagnostic output.
 *
 * The service layer combines baseline + enhanced metrics into the "deltas"
 * shown in the Workshop UI.
 */

import type { ToolCallRecord } from '../anthropic.client'

/** Direction of improvement. */
export type MetricDirection = 'higher-better' | 'lower-better' | 'neutral'

/** Category informs UI grouping (headline vs detail table). */
export type MetricCategory =
  | 'accuracy'
  | 'hallucination'
  | 'groundedness'
  | 'completion'
  | 'cost'
  | 'tool'

export interface Metric {
  id: string
  label: string
  /** Display value — evaluators may pre-format (e.g. "12.3%") or send raw number. */
  value: string | number
  /** Short unit when `value` is numeric — rendered next to the number. */
  unit?: string
  /** Binary pass/fail if applicable. */
  passed?: boolean
  direction: MetricDirection
  category: MetricCategory
}

export interface EvalContext {
  answer: string
  hadTools: boolean
  toolCalls: ToolCallRecord[]
  /** Set-specific ground truth object. Evaluators cast to their expected shape. */
  groundTruth: unknown
}

export interface EvalResult {
  metrics: Metric[]
  /** Free-form diagnostic output (judge prompt/response, regex matches, etc.). */
  diagnostics?: Record<string, unknown>
}

export interface Evaluator {
  id: string
  evaluate: (ctx: EvalContext) => Promise<EvalResult>
}

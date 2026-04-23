/**
 * Self-Repair orchestration.
 *
 * Runs the standard tool-use loop once. If the answer fails a coarse
 * validator (empty or — when the system prompt demands JSON — not parseable
 * as JSON), the model is asked to review and fix its previous answer. One
 * retry only, never more.
 *
 * Task-specific validation (e.g. "does this JSON have exactly 3 items with
 * matching schema?") lives in the evaluator, not here. This validator only
 * catches obvious shape failures.
 */

import {
  callClaudeStandard,
  combineUsage,
  type ClaudeCallInput,
  type ClaudeCallResult,
} from '../anthropic.client'

/** Strip ```json ... ``` fences the model sometimes wraps around JSON. */
function unfence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/** Coarse validator — returns true if the answer looks acceptable. */
function validateAnswer(text: string, system?: string): boolean {
  const t = text.trim()
  if (!t) return false

  // If the system prompt mentions JSON at all, require parseable JSON output.
  if (/json/i.test(system ?? '')) {
    try {
      JSON.parse(unfence(t))
    } catch {
      return false
    }
  }
  return true
}

export async function runSelfRepair(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  const first = await callClaudeStandard(input)

  if (validateAnswer(first.text, input.system)) {
    return first
  }

  // Retry once with a critique nudge.
  const retryMessages: ClaudeCallInput['messages'] = [
    ...input.messages,
    { role: 'assistant', content: first.text || '(empty response)' },
    {
      role: 'user',
      content:
        'Your previous answer violated the instructions (wrong format or missing required fields). Review the instructions above and produce a corrected answer.',
    },
  ]
  const retry = await callClaudeStandard({ ...input, messages: retryMessages })

  return {
    text: retry.text,
    stopReason: retry.stopReason,
    usage: combineUsage(first.usage, retry.usage),
    toolCalls: [...first.toolCalls, ...retry.toolCalls],
    latencyMs: first.latencyMs + retry.latencyMs,
    model: retry.model,
    iterations: first.iterations + retry.iterations,
  }
}

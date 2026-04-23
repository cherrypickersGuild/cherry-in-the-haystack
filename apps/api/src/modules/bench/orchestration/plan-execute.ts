/**
 * Plan-and-Execute orchestration.
 *
 * Two-phase call pattern:
 *   Phase A — planning: tools DISABLED, system appended with "Produce a plan,
 *             do not act yet." → model returns bullet-list plan as text.
 *   Phase B — execution: tools RE-ENABLED, plan injected as a prior assistant
 *             turn, user says "Proceed." → model executes step-by-step.
 *
 * Result combines both phases (usage summed, tool calls from phase B only,
 * latency summed, iterations = planPhase(1) + execPhase(N)).
 */

import {
  callClaudeStandard,
  combineUsage,
  type ClaudeCallInput,
  type ClaudeCallResult,
} from '../anthropic.client'

const PLAN_SUFFIX =
  '\n\n=== PLANNING PHASE ===\nBefore doing anything, produce a short bullet-list plan of the steps needed to answer. Do NOT call any tools yet. Do NOT produce the final answer yet. Reply with ONLY the plan.'

const EXEC_SUFFIX =
  '\n\n=== EXECUTION PHASE ===\nFollow the plan above step by step. Use the provided tools as needed. Produce the final answer.'

export async function runPlanExecute(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  // ── Phase A: plan only ──
  const planInput: ClaudeCallInput = {
    ...input,
    system: (input.system ?? '') + PLAN_SUFFIX,
    tools: undefined,
    toolDispatcher: undefined,
    maxTokens: 500,
  }
  const planRes = await callClaudeStandard(planInput)
  const planText = planRes.text.trim() || '(no plan produced)'

  // ── Phase B: execute with tools + plan prefix ──
  const execMessages: ClaudeCallInput['messages'] = [
    ...input.messages,
    { role: 'assistant', content: `Plan:\n${planText}` },
    { role: 'user', content: 'Proceed with execution per the plan above.' },
  ]
  const execInput: ClaudeCallInput = {
    ...input,
    system: (input.system ?? '') + EXEC_SUFFIX,
    messages: execMessages,
  }
  const execRes = await callClaudeStandard(execInput)

  return {
    text: execRes.text,
    stopReason: execRes.stopReason,
    usage: combineUsage(planRes.usage, execRes.usage),
    toolCalls: execRes.toolCalls, // plan phase has no tools
    latencyMs: planRes.latencyMs + execRes.latencyMs,
    model: execRes.model,
    // +1 for the explicit planning phase
    iterations: planRes.iterations + execRes.iterations,
  }
}

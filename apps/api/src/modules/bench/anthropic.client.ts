/**
 * Anthropic Claude client — public dispatcher + standard implementation.
 *
 * `callClaude(input)` is the single public entry. It dispatches to:
 *   - standard     → the tool-use loop (default, kept identical to Phase 1)
 *   - plan-execute → 2-phase call (plan without tools → execute with tools)
 *
 * `callClaudeStandard` is exported so orchestration strategies can reuse
 * the standard loop internally without re-implementing it.
 *
 * All tool calls are captured in `toolCalls` for logging + evaluation.
 */

import Anthropic from '@anthropic-ai/sdk'

import type { AnthropicToolSchema } from './sets/set-definitions'
import type { OrchestrationId } from './cards/card-registry'

/** Provider switch for the bench. One of `claude` | `openai` | `flock`.
 *  Default `claude`. Models get a sensible default per provider when
 *  `BENCH_MODEL` is not set explicitly. */
export type BenchProvider = 'claude' | 'openai' | 'flock'
export const BENCH_PROVIDER: BenchProvider =
  ((process.env.BENCH_LLM_PROVIDER ?? 'claude').toLowerCase() as BenchProvider)

const DEFAULT_MODEL_BY_PROVIDER: Record<BenchProvider, string> = {
  claude: 'claude-haiku-4-5',
  openai: 'gpt-4.1-nano',
  flock: 'qwen3-30b-a3b-instruct-2507',
}

export const DEFAULT_MODEL =
  process.env.BENCH_MODEL ?? DEFAULT_MODEL_BY_PROVIDER[BENCH_PROVIDER] ?? 'claude-haiku-4-5'

let sharedClient: Anthropic | null = null
function getClient(): Anthropic {
  if (!sharedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        '[bench] ANTHROPIC_API_KEY is not set. Add it to apps/api/.env',
      )
    }
    sharedClient = new Anthropic({ apiKey })
  }
  return sharedClient
}

export interface ToolCallRecord {
  name: string
  input: Record<string, unknown>
  output?: unknown
  error?: string
  durationMs: number
}

export interface ClaudeCallInput {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  system?: string
  tools?: AnthropicToolSchema[]
  toolDispatcher?: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<unknown>
  model?: string
  maxTokens?: number
  temperature?: number
  maxToolIterations?: number
  /** Phase 2: orchestration strategy. Defaults to 'standard' when undefined. */
  orchestration?: OrchestrationId
}

export interface ClaudeCallResult {
  text: string
  stopReason: string | null
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  toolCalls: ToolCallRecord[]
  latencyMs: number
  model: string
  iterations: number
}

/** Safety cap — prevents runaway tool loops if the model never converges. */
const DEFAULT_MAX_TOOL_ITERATIONS = 5

/* ══════════════════════════════════════════════════════════════════
   Dispatcher — routes to the requested orchestration strategy.
   ════════════════════════════════════════════════════════════════ */
export async function callClaude(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  switch (input.orchestration) {
    case 'plan-execute': {
      const { runPlanExecute } = await import('./orchestration/plan-execute.js')
      return runPlanExecute(input)
    }
    case 'standard':
    case undefined:
    default:
      return callClaudeStandard(input)
  }
}

/* ══════════════════════════════════════════════════════════════════
   Standard tool-use loop — Phase 1 behavior, unchanged.
   ════════════════════════════════════════════════════════════════ */
export async function callClaudeStandard(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  const model = input.model ?? DEFAULT_MODEL
  // Provider routing — explicit env var wins over heuristics. The same
  // ClaudeCallInput shape works for all providers because openai/flock
  // clients translate to OpenAI-compatible chat-completions and translate
  // the response back to ClaudeCallResult.
  if (BENCH_PROVIDER === 'flock') {
    const { callFlockStandard } = await import('./flock.client.js')
    return callFlockStandard({ ...input, model })
  }
  if (BENCH_PROVIDER === 'openai' || model.startsWith('gpt-')) {
    const { callOpenAIStandard } = await import('./openai.client.js')
    return callOpenAIStandard({ ...input, model })
  }
  const client = getClient()
  const maxTokens = input.maxTokens ?? 1024
  const temperature = input.temperature ?? 0
  const maxIter = input.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS
  const wantsTools = Array.isArray(input.tools) && input.tools.length > 0

  const started = Date.now()
  const toolCalls: ToolCallRecord[] = []
  let inputTokens = 0
  let outputTokens = 0
  let iterations = 0

  // Mutable working copy of the conversation.
  const conversation: Array<Anthropic.Messages.MessageParam> =
    input.messages.map((m) => ({ role: m.role, content: m.content }))

  let stopReason: string | null = null
  let finalText = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    iterations++

    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(input.system ? { system: input.system } : {}),
      ...(wantsTools ? { tools: input.tools } : {}),
      messages: conversation,
    })

    inputTokens += res.usage?.input_tokens ?? 0
    outputTokens += res.usage?.output_tokens ?? 0
    stopReason = res.stop_reason ?? null

    const textParts = res.content.filter(
      (c): c is Anthropic.Messages.TextBlock => c.type === 'text',
    )
    const toolUseBlocks = res.content.filter(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
    )

    const lastText = textParts.map((p) => p.text).join('\n').trim()
    if (lastText) finalText = lastText

    if (
      stopReason !== 'tool_use' ||
      toolUseBlocks.length === 0 ||
      !input.toolDispatcher ||
      iterations >= maxIter
    ) {
      break
    }

    conversation.push({ role: 'assistant', content: res.content })

    const results = await Promise.all(
      toolUseBlocks.map(async (tu) => {
        const callStarted = Date.now()
        try {
          const out = await input.toolDispatcher!(
            tu.name,
            (tu.input ?? {}) as Record<string, unknown>,
          )
          toolCalls.push({
            name: tu.name,
            input: (tu.input ?? {}) as Record<string, unknown>,
            output: out,
            durationMs: Date.now() - callStarted,
          })
          return {
            type: 'tool_result' as const,
            tool_use_id: tu.id,
            content: JSON.stringify(out),
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          toolCalls.push({
            name: tu.name,
            input: (tu.input ?? {}) as Record<string, unknown>,
            error: msg,
            durationMs: Date.now() - callStarted,
          })
          return {
            type: 'tool_result' as const,
            tool_use_id: tu.id,
            content: `Error: ${msg}`,
            is_error: true,
          }
        }
      }),
    )

    conversation.push({ role: 'user', content: results })
  }

  return {
    text: finalText,
    stopReason,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    toolCalls,
    latencyMs: Date.now() - started,
    model,
    iterations,
  }
}

/** Sum two `ClaudeCallResult.usage` objects. Used by orchestration wrappers. */
export function combineUsage(
  a: ClaudeCallResult['usage'],
  b: ClaudeCallResult['usage'],
): ClaudeCallResult['usage'] {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  }
}

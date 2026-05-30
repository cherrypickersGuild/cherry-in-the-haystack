/**
 * Flock client — OpenAI-compatible LLM gateway hosted at api.flock.io.
 *
 * Mirrors `callClaudeStandard` I/O so orchestration strategies (plan-execute,
 * self-repair) work unchanged. Selected by `BENCH_LLM_PROVIDER=flock` or by
 * a model id present in Flock's catalog (e.g. `qwen3-30b-a3b-instruct-2507`).
 *
 * Auth quirks vs vanilla OpenAI:
 *   - Header is `x-litellm-api-key: $FLOCK_API_KEY` (not Bearer)
 *   - Base URL is `https://api.flock.io/v1`
 *
 * The OpenAI SDK supports both via the constructor (`baseURL` +
 * `defaultHeaders`), so we get streaming/tool-use/usage parsing for free.
 */

import OpenAI from 'openai'

import type {
  ClaudeCallInput,
  ClaudeCallResult,
  ToolCallRecord,
} from './anthropic.client'

const FLOCK_BASE_URL = 'https://api.flock.io/v1'

let sharedClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!sharedClient) {
    const apiKey = process.env.FLOCK_API_KEY
    if (!apiKey) {
      throw new Error(
        '[bench] FLOCK_API_KEY not set. Add it to apps/api/.env (https://platform.flock.io).',
      )
    }
    sharedClient = new OpenAI({
      // The SDK still needs an `apiKey` value — we pass FLOCK_API_KEY here
      // so the SDK doesn't throw, but the actual auth comes from
      // `defaultHeaders` (Flock uses `x-litellm-api-key`, not Bearer).
      apiKey,
      baseURL: FLOCK_BASE_URL,
      defaultHeaders: {
        'x-litellm-api-key': apiKey,
      },
    })
  }
  return sharedClient
}

const DEFAULT_MAX_TOOL_ITERATIONS = 5

export async function callFlockStandard(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  const client = getClient()
  const model = input.model ?? 'qwen3-30b-a3b-instruct-2507'
  const maxTokens = input.maxTokens ?? 1024
  const temperature = input.temperature ?? 0
  const maxIter = input.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS
  const wantsTools = Array.isArray(input.tools) && input.tools.length > 0

  const started = Date.now()
  const toolCalls: ToolCallRecord[] = []
  let inputTokens = 0
  let outputTokens = 0
  let iterations = 0

  const tools = wantsTools
    ? input.tools!.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }))
    : undefined

  const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (input.system) conversation.push({ role: 'system', content: input.system })
  for (const m of input.messages)
    conversation.push({ role: m.role, content: m.content })

  let stopReason: string | null = null
  let finalText = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    iterations++

    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: conversation,
      ...(tools ? { tools } : {}),
    })

    inputTokens += res.usage?.prompt_tokens ?? 0
    outputTokens += res.usage?.completion_tokens ?? 0
    const msg = res.choices[0]?.message
    stopReason = res.choices[0]?.finish_reason ?? null

    const toolUseBlocks = msg?.tool_calls ?? []
    const textContent =
      typeof msg?.content === 'string' ? msg.content.trim() : ''
    if (textContent) finalText = textContent

    if (
      stopReason !== 'tool_calls' ||
      toolUseBlocks.length === 0 ||
      !input.toolDispatcher ||
      iterations >= maxIter
    ) {
      break
    }

    conversation.push({
      role: 'assistant',
      content: msg?.content ?? null,
      tool_calls: toolUseBlocks,
    } as OpenAI.Chat.ChatCompletionMessageParam)

    const results = await Promise.all(
      toolUseBlocks.map(async (tu) => {
        const callStarted = Date.now()
        if (tu.type !== 'function') {
          return { tu, content: '{}', error: 'non-function tool call' }
        }
        const fn = tu.function
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = JSON.parse(fn.arguments || '{}')
        } catch {
          // leave empty
        }
        try {
          const out = await input.toolDispatcher!(fn.name, parsedInput)
          toolCalls.push({
            name: fn.name,
            input: parsedInput,
            output: out,
            durationMs: Date.now() - callStarted,
          })
          return { tu, content: JSON.stringify(out) }
        } catch (err) {
          const m2 = err instanceof Error ? err.message : String(err)
          toolCalls.push({
            name: fn.name,
            input: parsedInput,
            error: m2,
            durationMs: Date.now() - callStarted,
          })
          return { tu, content: `Error: ${m2}`, error: m2 }
        }
      }),
    )

    for (const r of results) {
      conversation.push({
        role: 'tool',
        tool_call_id: r.tu.id,
        content: r.content,
      })
    }
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

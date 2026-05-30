/**
 * OpenAI client — mirrors `callClaudeStandard` I/O shape so orchestration
 * code (plan-execute) works unchanged. Selected by model id
 * starting with "gpt-". Uses GPT_API_KEY or OPENAI_API_KEY.
 */

import OpenAI from 'openai'

import type {
  ClaudeCallInput,
  ClaudeCallResult,
  ToolCallRecord,
} from './anthropic.client'

let sharedClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!sharedClient) {
    const apiKey = process.env.GPT_API_KEY ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        '[bench] GPT_API_KEY / OPENAI_API_KEY not set. Add one to apps/api/.env',
      )
    }
    sharedClient = new OpenAI({ apiKey })
  }
  return sharedClient
}

const DEFAULT_MAX_TOOL_ITERATIONS = 5

export async function callOpenAIStandard(
  input: ClaudeCallInput,
): Promise<ClaudeCallResult> {
  const client = getClient()
  const model = input.model ?? 'gpt-4.1-nano'
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

    // Push the assistant turn with the tool_calls so subsequent tool
    // result messages reference valid tool_call_ids.
    conversation.push({
      role: 'assistant',
      content: msg?.content ?? null,
      tool_calls: toolUseBlocks,
    } as OpenAI.Chat.ChatCompletionMessageParam)

    // Execute tools in parallel, collect, then push in the original order.
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

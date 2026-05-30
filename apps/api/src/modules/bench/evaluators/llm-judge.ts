/**
 * Shared LLM-as-judge utility.
 *
 * Wraps `callClaude` with JSON-only output enforcement. Used by evaluators
 * when deterministic rules aren't enough (e.g. "count factual claims not
 * supported by this ground-truth doc").
 *
 * Model: claude-haiku-4-5 (cheap, fast, good at structured extraction).
 */

import { callClaude } from '../anthropic.client'

const JUDGE_MODEL = 'claude-haiku-4-5'

const JUDGE_SYSTEM = `You are a strict, impartial fact-check judge.
You will be given an ANSWER and a ground-truth CONTEXT.
Output ONLY a single JSON object — no prose, no markdown fences.`

export interface JudgeRequest {
  /** Name for logging. */
  id: string
  /** The answer to evaluate. */
  answer: string
  /** Ground truth / reference text. */
  context: string
  /** Specific task for the judge, e.g. "count factual claims not supported by CONTEXT". */
  instruction: string
  /** JSON schema hint included in the prompt. */
  outputShape: string
}

export interface JudgeResponse<T> {
  parsed: T
  raw: string
  usage: { inputTokens: number; outputTokens: number }
  latencyMs: number
}

export async function askJudge<T = unknown>(
  req: JudgeRequest,
): Promise<JudgeResponse<T>> {
  const prompt = [
    `TASK: ${req.instruction}`,
    '',
    'CONTEXT (ground truth — the only source of supported facts):',
    '"""',
    req.context.trim(),
    '"""',
    '',
    'ANSWER (to evaluate):',
    '"""',
    req.answer.trim(),
    '"""',
    '',
    `Respond with a single JSON object matching this shape:`,
    req.outputShape.trim(),
  ].join('\n')

  const res = await callClaude({
    model: JUDGE_MODEL,
    system: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    maxTokens: 800,
  })

  const cleaned = stripCodeFence(res.text)
  let parsed: T
  try {
    parsed = JSON.parse(cleaned) as T
  } catch (err) {
    throw new Error(
      `[judge:${req.id}] Failed to parse JSON from judge:\n${res.text}\n(${(err as Error).message})`,
    )
  }

  return {
    parsed,
    raw: res.text,
    usage: {
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
    },
    latencyMs: res.latencyMs,
  }
}

/** Strip ``` / ```json wrappers if the judge decided to use them anyway. */
function stripCodeFence(s: string): string {
  const trimmed = s.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  return (fenceMatch ? fenceMatch[1] : trimmed).trim()
}

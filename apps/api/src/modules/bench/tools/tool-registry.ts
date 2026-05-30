/**
 * Shared tool interfaces + registry for the bench tool-use loop.
 * Every tool exports a BenchTool; the registry maps tool name → executor.
 */

import type { AnthropicToolSchema } from '../sets/set-definitions'

export interface BenchTool {
  definition: AnthropicToolSchema
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

/** Build a lookup dispatcher from a list of tools. */
export function buildToolDispatcher(
  tools: BenchTool[],
): (name: string, input: Record<string, unknown>) => Promise<unknown> {
  const byName = new Map<string, BenchTool>()
  for (const t of tools) byName.set(t.definition.name, t)

  return async (name: string, input: Record<string, unknown>) => {
    const tool = byName.get(name)
    if (!tool) throw new Error(`[bench] Unknown tool: ${name}`)
    return tool.execute(input)
  }
}

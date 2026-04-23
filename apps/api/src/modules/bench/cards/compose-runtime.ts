/**
 * Build → runtime composer.
 *
 * Takes a user's equipped AgentBuild (which card ids are in which slots) and
 * produces the concrete runtime config the Anthropic client needs:
 *   - systemPrompt (prompt card + skill suffixes concatenated)
 *   - tools[] (from the MCP card)
 *   - maxIterations (from the memory card)
 *   - orchestrationId (from the orchestration card, defaults to 'standard')
 *
 * Phase 2: skill + orchestration slots are now honored. `skillsIgnored` field
 * is kept (always 0) for backward compat with the frontend AppliedSlotsBanner.
 */

import { buildToolDispatcher, type BenchTool } from '../tools/tool-registry'
import type { AnthropicToolSchema } from '../sets/set-definitions'
import {
  getCard,
  type MemoryMode,
  type OrchestrationId,
} from './card-registry'

export interface AgentBuildInput {
  prompt: string | null
  mcp: string | null
  skillA: string | null
  skillB: string | null
  skillC: string | null
  orchestration: string | null
  memory: string | null
}

export interface RuntimeConfig {
  systemPrompt: string | undefined
  tools: AnthropicToolSchema[]
  toolDispatcher?: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<unknown>
  maxIterations: number
  memoryMode: MemoryMode
  /** Orchestration strategy for `callClaude`. Defaults to 'standard'. */
  orchestrationId: OrchestrationId
  /** Diagnostic: which slots actually contributed something. */
  appliedSlots: {
    prompt: boolean
    mcp: boolean
    memory: boolean
    /** Phase 2: number of skill slots that fired. */
    skillsActive: number
    /** Kept for backward compat with Phase 1 clients. Always 0 now. */
    skillsIgnored: number
    /** True when orchestration slot is equipped (any non-standard value). */
    orchestrationActive: boolean
    /** Kept for backward compat. Always false now. */
    orchestrationIgnored: boolean
  }
}

/** Default when memory slot is empty — same as `short`. */
const DEFAULT_MAX_ITER = 5
const DEFAULT_MEMORY_MODE: MemoryMode = 'short'
const DEFAULT_ORCH: OrchestrationId = 'standard'

export function composeRuntime(build: AgentBuildInput): RuntimeConfig {
  // ── Prompt ──
  const promptCard = getCard(build.prompt)
  const basePrompt =
    promptCard?.type === 'prompt' ? promptCard.systemPrompt : ''

  // ── Skills — collect suffixes in slot order A → B → C, dedup by text ──
  const skillIds = [build.skillA, build.skillB, build.skillC]
  const skillSuffixes: string[] = []
  const seen = new Set<string>()
  let skillsActive = 0
  for (const id of skillIds) {
    const card = getCard(id)
    if (card?.type !== 'skill') continue
    skillsActive++
    if (seen.has(card.promptSuffix)) continue
    seen.add(card.promptSuffix)
    skillSuffixes.push(card.promptSuffix)
  }

  const combinedPrompt = [basePrompt, ...skillSuffixes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n')
  const systemPrompt = combinedPrompt.length > 0 ? combinedPrompt : undefined

  // ── MCP tool ──
  const mcpCard = getCard(build.mcp)
  const benchTools: BenchTool[] =
    mcpCard?.type === 'mcp' ? [mcpCard.tool] : []
  const tools = benchTools.map((t) => t.definition)
  const toolDispatcher =
    benchTools.length > 0 ? buildToolDispatcher(benchTools) : undefined

  // ── Memory ──
  const memCard = getCard(build.memory)
  const maxIterations =
    memCard?.type === 'memory' ? memCard.maxIterations : DEFAULT_MAX_ITER
  const memoryMode =
    memCard?.type === 'memory' ? memCard.mode : DEFAULT_MEMORY_MODE

  // ── Orchestration ──
  const orchCard = getCard(build.orchestration)
  const orchestrationId: OrchestrationId =
    orchCard?.type === 'orchestration' ? orchCard.orchId : DEFAULT_ORCH
  const orchestrationActive =
    orchCard?.type === 'orchestration' && orchCard.orchId !== 'standard'

  return {
    systemPrompt,
    tools,
    toolDispatcher,
    maxIterations,
    memoryMode,
    orchestrationId,
    appliedSlots: {
      prompt: Boolean(promptCard && promptCard.type === 'prompt'),
      mcp: Boolean(mcpCard && mcpCard.type === 'mcp'),
      memory: Boolean(memCard && memCard.type === 'memory'),
      skillsActive,
      // Backward-compat field — Phase 1 clients read this. Phase 2 wires skills,
      // so nothing is "ignored" anymore. Kept to avoid response-shape break.
      skillsIgnored: 0,
      orchestrationActive,
      orchestrationIgnored: false,
    },
  }
}

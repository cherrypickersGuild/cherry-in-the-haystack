/**
 * Card registry — maps every inventory card id the frontend can equip to
 * its concrete server-side implementation.
 *
 * For Phase 1 (3 slots wired end-to-end):
 *   - 3 prompt cards  → raw system prompt strings
 *   - 3 mcp cards     → concrete BenchTool instances
 *   - 3 memory cards  → tool-use iteration caps
 *
 * Phase 2 (later): add skill + orchestration cards with real semantics.
 * Until then, those slots are inert — composeRuntime simply ignores them.
 */

import { coingeckoTool } from '../tools/coingecko.tool'
import { marketplaceTool } from '../tools/marketplace.tool'
import { catalogTool } from '../tools/catalog.tool'
import type { BenchTool } from '../tools/tool-registry'

export type CardType =
  | 'prompt'
  | 'mcp'
  | 'skill'
  | 'orchestration'
  | 'memory'

export type MemoryMode = 'none' | 'short' | 'retrieval'

export type OrchestrationId = 'standard' | 'plan-execute' | 'self-repair'

export interface PromptCardImpl {
  type: 'prompt'
  systemPrompt: string
}

export interface McpCardImpl {
  type: 'mcp'
  tool: BenchTool
}

export interface MemoryCardImpl {
  type: 'memory'
  mode: MemoryMode
  maxIterations: number
}

/** Skill card — appends a clause to the composed system prompt. No runtime
 *  change beyond that. Multiple skills compose in slot order A → B → C. */
export interface SkillCardImpl {
  type: 'skill'
  promptSuffix: string
}

/** Orchestration card — selects the execution strategy for `callClaude`. */
export interface OrchestrationCardImpl {
  type: 'orchestration'
  orchId: OrchestrationId
}

export type CardImpl =
  | PromptCardImpl
  | McpCardImpl
  | MemoryCardImpl
  | SkillCardImpl
  | OrchestrationCardImpl

export const CARD_REGISTRY: Record<string, CardImpl> = {
  /* ══════════ System prompts ══════════ */
  'inv-p-oracle': {
    type: 'prompt',
    systemPrompt:
      "You are a crypto market analyst. Always cite current prices with a timestamp and source. Never guess — if you don't have a tool result, say so.",
  },
  'inv-p-hunter': {
    type: 'prompt',
    systemPrompt:
      'You are a deal-hunting assistant. Return exactly 3 listings as valid JSON: [{id, title, price, seller, posted_at}]. Use only the search tool — do not invent listings. No prose outside the JSON.',
  },
  'inv-p-policy': {
    type: 'prompt',
    systemPrompt:
      'Answer only using retrieved Cherry docs. Cite doc IDs in brackets like [doc:karma-v2]. If the answer is not in retrieved docs, respond exactly: "I don\'t have that information."',
  },

  /* ══════════ MCP tools ══════════ */
  'inv-m-crypto': { type: 'mcp', tool: coingeckoTool },
  'inv-m-market': { type: 'mcp', tool: marketplaceTool },
  'inv-m-catalog': { type: 'mcp', tool: catalogTool },

  /* ══════════ Memory modes ══════════ */
  'inv-me-none': {
    type: 'memory',
    mode: 'none',
    // 2 = one round-trip (tool_use → tool_result → final answer). Any lower
    // and Claude has no chance to produce a text response after calling a tool.
    maxIterations: 2,
  },
  'inv-me-short': {
    type: 'memory',
    mode: 'short',
    maxIterations: 5, // standard tool-use loop
  },
  'inv-me-retrieval': {
    type: 'memory',
    mode: 'retrieval',
    maxIterations: 10, // extended loop, more room to retrieve + reflect
  },

  /* ══════════ Phase 2 — Quant / Strict / Grounded Prompts ══════════ */
  'inv-p-quant': {
    type: 'prompt',
    systemPrompt:
      'You are a quantitative crypto analyst. Given multiple assets, fetch each price, compare movements, and return a single JSON object with fields {assets, biggest_mover}. Cite the timestamp and source for every numeric claim.',
  },
  'inv-p-strict-hunter': {
    type: 'prompt',
    systemPrompt:
      'You are a strict deal-hunting assistant. Return exactly the requested number of listings as a JSON array. Apply every stated filter. Never invent listings — use only the search tool output.',
  },
  'inv-p-grounded': {
    type: 'prompt',
    systemPrompt:
      'You are a grounded researcher. Retrieve relevant docs before answering. Cite doc IDs in brackets like [doc:xxx] for every claim. If a requested field is not in retrieved docs, respond exactly "missing: <field>" — never guess.',
  },

  /* ══════════ Phase 2 — Skills (prompt-suffix append) ══════════
   * Each suffix is designed to produce a STRUCTURALLY detectable effect:
   * removing the skill should remove a concrete artifact (token, field,
   * behavior) from the output — not just "be slightly less careful". */
  'inv-s-decomp': {
    type: 'skill',
    // Force every asset in the output to include an explicit "step: N" field.
    promptSuffix:
      'For tasks covering multiple entities (e.g. multiple crypto symbols), include EVERY entity listed. For each entity in the output, add a numeric "step" field indicating the order it was processed: step 1, step 2, step 3. If fewer than 3 steps appear in your output, the answer is incomplete.',
  },
  'inv-s-json-strict': {
    type: 'skill',
    // Ban markdown fences and any non-JSON characters.
    promptSuffix:
      'Your entire response MUST be pure JSON. The FIRST character must be `{` or `[`. The LAST character must be `}` or `]`. Do NOT wrap in ```json or ``` fences. Do NOT write any prose, comments, or markdown. If uncertain, output {}.',
  },
  'inv-s-citation': {
    type: 'skill',
    // Require literal "source:" + timestamp keywords inline.
    promptSuffix:
      'For every numeric fact you emit, include the literal tokens "source:" and either a "captured_at" timestamp (ISO 8601) or a "[doc:<id>]" bracketed reference. A claim without these tokens is considered unsupported.',
  },
  'inv-s-constraint-sat': {
    type: 'skill',
    // Force an explicit "filters_applied" echo so removal is visible.
    promptSuffix:
      'After applying filters, verify every returned record satisfies EVERY stated constraint (brand, model, price, sealed flag, seller blocklist). If any record fails any constraint, EXCLUDE it completely.',
  },
  'inv-s-self-validate': {
    type: 'skill',
    promptSuffix:
      'BEFORE returning, re-check each item: does the seller name contain any blocked substring? Is the price actually under the stated limit? Is "sealed" true? Drop any item failing any check. Return fewer than the requested count rather than include a violator.',
  },
  'inv-s-multihop': {
    type: 'skill',
    promptSuffix:
      'For each distinct field or sub-question, issue a SEPARATE search call. Do not combine multiple sub-questions into one query. At least 2 search calls are expected per multi-part question.',
  },
  'inv-s-abstention': {
    type: 'skill',
    // Very literal trigger — expected string must appear verbatim.
    promptSuffix:
      'For each field in the question, check if the retrieved content explicitly contains that information. If NOT, write that field line as `missing: <exact field name>` (use the literal word "missing:" followed by the field name). Do NOT invent plausible values. This applies especially to fields like "monthly contribution" and "perks".',
  },

  /* ══════════ Phase 2 — Orchestration ══════════ */
  'inv-o-standard': {
    // Functionally identical to leaving the slot empty. Kept for UX completeness
    // so users can explicitly pick "standard loop" as an intentional choice.
    type: 'orchestration',
    orchId: 'standard',
  },
  'inv-o-plan-execute': {
    type: 'orchestration',
    orchId: 'plan-execute',
  },
  'inv-o-self-repair': {
    type: 'orchestration',
    orchId: 'self-repair',
  },
}

export function getCard(id: string | null | undefined): CardImpl | null {
  if (!id) return null
  return CARD_REGISTRY[id] ?? null
}

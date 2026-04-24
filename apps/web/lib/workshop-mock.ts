// Workshop — Mock data and types.
//
// 7 slots / 5 types stay in the UI; each card carries a unique "jigsaw" shape
// so a user can see at a glance which slot it belongs to (prompt ↔ circle,
// mcp ↔ square, skill ↔ triangle, orchestration ↔ diamond, memory ↔ hexagon).
//
// Agent Execution Flow (top → bottom):
//   ① System Prompt  → agent identity
//   ② MCP Tools      → callable tools
//   ③ Skills × 3     → domain knowledge (3 parallel slots)
//   ④ Orchestration  → execution control
//   ⑤ Memory         → state management
//
// Inventory is curated: only cards whose prompts / tools are wired end-to-end
// to /v1/kaas/bench/compare appear here. Skill + orchestration slots stay
// present (for future presets) even though no real cards fill them yet.

export type SkillType = "prompt" | "mcp" | "skill" | "orchestration" | "memory"

/** Diablo-style "set" tag — cards that share the same tag form an optimal
 *  combo. When all cards of a set are equipped, the benchmark runs at peak
 *  effectiveness for that set's task.
 *
 *  Phase 1: 2 tags — hunter / policy (3-slot builds)
 *  Phase 2: 3 more  — quant / strict / grounded (7-slot builds) */
export type SetTag =
  | "hunter"
  | "policy"
  | "quant"
  | "grounded"

export interface SetMeta {
  label: string
  symbol: string  // short glyph (alchemy / tarot style)
  color: string
  softBg: string
}

export const SET_META: Record<SetTag, SetMeta> = {
  hunter:   { label: "Hunter Set",   symbol: "🜄", color: "#8F1D12", softBg: "#F6D8D0" },
  policy:   { label: "Policy Set",   symbol: "🜁", color: "#2D3B66", softBg: "#D8DEEF" },
  quant:    { label: "Quant Set",    symbol: "🜔", color: "#5E3A8A", softBg: "#E8DCF4" },
  grounded: { label: "Grounded Set", symbol: "🜚", color: "#3F5A2E", softBg: "#DCE8D1" },
}

export interface InventoryItem {
  id: string
  title: string
  type: SkillType
  category: string
  updatedAt: string // ISO date
  source: "purchased" | "followed" | "builtin" | "custom"
  sourceAgent?: string // For followed items: the originating agent's name
  summary?: string // Shown on card hover
  fileName?: string // For custom items: original uploaded filename
  content?: string // For custom items: raw text content (prompt body / config / etc.)
  /** Diablo-style set membership — cards with a shared tag form an optimal
   *  combo. Array because some shared cards belong to multiple sets
   *  (e.g. JSON Strict → ["quant","strict"]). */
  setTag?: SetTag[]
}

export type SlotKey =
  | "prompt"
  | "mcp"
  | "skillA"
  | "skillB"
  | "skillC"
  | "orchestration"
  | "memory"

/** Step number in the Agent Execution Flow (1~5) */
export type FlowStep = 1 | 2 | 3 | 4 | 5

export interface SlotConfig {
  label: string
  accept: SkillType[]
  icon: string
  hint: string
  flowStep: FlowStep
  emptyLabel: string
}

/** An Agent Build — one saved slot configuration. Users keep multiple builds
 *  and switch between them via tabs. Each build has its own listing state. */
export interface AgentBuild {
  id: string
  name: string
  equipped: Record<SlotKey, string | null>
  isListedOnMarket: boolean
}

export interface WorkshopState {
  builds: AgentBuild[]
  activeBuildId: string
  inventory: InventoryItem[]
  isFollowingAny: boolean
  cloneSimilarity?: number
}

export function emptyEquipped(): Record<SlotKey, string | null> {
  return {
    prompt: null,
    mcp: null,
    skillA: null,
    skillB: null,
    skillC: null,
    orchestration: null,
    memory: null,
  }
}

export function makeBuild(id: string, name: string): AgentBuild {
  return { id, name, equipped: emptyEquipped(), isListedOnMarket: false }
}

export const SLOT_META: Record<SlotKey, SlotConfig> = {
  prompt: {
    label: "System Prompt",
    accept: ["prompt"],
    icon: "🧬",
    hint: "Defines the agent's role and discipline",
    flowStep: 1,
    emptyLabel: "Defines the agent's role and discipline",
  },
  mcp: {
    label: "MCP Tools",
    accept: ["mcp"],
    icon: "🛠",
    hint: "Tools the agent can call via MCP servers",
    flowStep: 2,
    emptyLabel: "Tools the agent can call via MCP servers",
  },
  skillA: {
    label: "Skill A",
    accept: ["skill"],
    icon: "✨",
    hint: "Primary domain knowledge",
    flowStep: 3,
    emptyLabel: "Primary domain knowledge",
  },
  skillB: {
    label: "Skill B",
    accept: ["skill"],
    icon: "✨",
    hint: "Secondary domain knowledge",
    flowStep: 3,
    emptyLabel: "Secondary domain knowledge",
  },
  skillC: {
    label: "Skill C",
    accept: ["skill"],
    icon: "✨",
    hint: "Tertiary domain knowledge",
    flowStep: 3,
    emptyLabel: "Tertiary domain knowledge",
  },
  orchestration: {
    label: "Orchestration",
    accept: ["orchestration"],
    icon: "🧭",
    hint: "Agent loop pattern (ReAct / CodeAct / Plan-and-Execute)",
    flowStep: 4,
    emptyLabel: "Agent loop pattern (ReAct / CodeAct / Plan-and-Execute)",
  },
  memory: {
    label: "Memory",
    accept: ["memory"],
    icon: "💾",
    hint: "Conversation-history retention policy",
    flowStep: 5,
    emptyLabel: "Conversation-history retention policy",
  },
}

/** Real inventory — every card maps 1:1 to a real server-side behavior.
 *  The 3 preset combinations that work end-to-end in bench:
 *    Hunter   = prompt:p-hunter  + mcp:m-market   + memory:me-none
 *    Policy   = prompt:p-policy  + mcp:m-catalog  + memory:me-retrieval
 */
export const mockInventory: InventoryItem[] = [
  // ── System Prompts ──
  {
    id: "inv-p-hunter",
    title: "Marketplace Hunter",
    type: "prompt",
    category: "Extraction",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["hunter"],
    summary:
      "Deal hunter that returns strict JSON listings; never invents records.",
  },
  {
    id: "inv-p-policy",
    title: "Policy Expert",
    type: "prompt",
    category: "Grounded",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["policy"],
    summary:
      "Answers only from retrieved Cherry docs; cites doc IDs; says \"I don't have that\" when missing.",
  },

  // ── MCP Tools (3) ──
  {
    id: "inv-m-crypto",
    title: "Crypto Price",
    type: "mcp",
    category: "Finance",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["quant"],
    summary:
      "Live crypto prices via CoinGecko. Tool: get_crypto_price(symbol).",
  },
  {
    id: "inv-m-market",
    title: "Marketplace Search",
    type: "mcp",
    category: "Shopping",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["hunter"],
    summary:
      "Internal marketplace DB. Tool: search_marketplace(query, max_price, sealed_only).",
  },
  {
    id: "inv-m-catalog",
    title: "Cherry Catalog",
    type: "mcp",
    category: "Docs",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["policy", "grounded"],
    summary:
      "Cherry internal policy docs. Tool: search_catalog(query, limit).",
  },

  // ── Memory modes (3) ──
  {
    id: "inv-me-none",
    title: "Stateless",
    type: "memory",
    category: "None",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["hunter"],
    summary: "No retention — each turn starts fresh.",
  },
  {
    id: "inv-me-short",
    title: "Short-term",
    type: "memory",
    category: "Conversation",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: [],
    summary: "Full conversation context preserved within the session.",
  },
  {
    id: "inv-me-retrieval",
    title: "Retrieval buffer",
    type: "memory",
    category: "Tool output",
    updatedAt: "2026-04-23",
    source: "builtin",
    setTag: ["policy"],
    summary: "Retrieved tool results stay available across turns.",
  },

  // ══════════ Phase 2 — Quant / Strict / Grounded Prompts (3) ══════════
  {
    id: "inv-p-quant",
    title: "Quantitative Analyst",
    type: "prompt",
    category: "Multi-asset",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["quant"],
    summary:
      "3-asset analyst that fetches each price, compares movement, returns structured JSON with citations.",
  },
  {
    id: "inv-p-grounded",
    title: "Grounded Researcher",
    type: "prompt",
    category: "Retrieval",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["grounded"],
    summary:
      "Retrieves first, cites doc IDs, flags missing fields with 'missing:<field>'.",
  },

  // ══════════ Phase 2 — Skills (7) ══════════
  {
    id: "inv-s-decomp",
    title: "Multi-step Decomposition",
    type: "skill",
    category: "Reasoning",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["quant"],
    summary:
      "Break the task into explicit subtasks and address each before synthesizing.",
  },
  {
    id: "inv-s-json-strict",
    title: "JSON Strict",
    type: "skill",
    category: "Output",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["quant"],
    summary: "Output ONLY valid JSON matching the requested schema. No prose.",
  },
  {
    id: "inv-s-citation",
    title: "Citation Discipline",
    type: "skill",
    category: "Grounding",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["quant", "grounded"],
    summary: "Every factual claim carries an inline source or citation.",
  },
  {
    id: "inv-s-multihop",
    title: "Multi-hop Retrieval",
    type: "skill",
    category: "Retrieval",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["grounded"],
    summary:
      "Decompose queries and issue multiple retrievals when a single search isn't enough.",
  },
  {
    id: "inv-s-abstention",
    title: "Abstention",
    type: "skill",
    category: "Calibration",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["grounded"],
    summary:
      "If a required field is missing from retrieved content, output 'missing: <field>' — never guess.",
  },

  // ══════════ Phase 2 — Orchestration (3) ══════════
  {
    id: "inv-o-standard",
    title: "Standard Loop",
    type: "orchestration",
    category: "Default",
    updatedAt: "2026-04-24",
    source: "builtin",
    summary:
      "Default ReAct-style tool-use loop. Functionally identical to leaving the slot empty — included for UX completeness.",
  },
  {
    id: "inv-o-plan-execute",
    title: "Plan-and-Execute",
    type: "orchestration",
    category: "Multi-phase",
    updatedAt: "2026-04-24",
    source: "builtin",
    setTag: ["quant", "grounded"],
    summary:
      "Two-phase call: first produce a plan (no tools), then execute the plan with tools.",
  },
]

const DEFAULT_BUILDS: AgentBuild[] = [
  makeBuild("build-a", "Build A"),
  makeBuild("build-b", "Build B"),
  makeBuild("build-c", "Build C"),
]

export const defaultWorkshopState: WorkshopState = {
  builds: DEFAULT_BUILDS,
  activeBuildId: DEFAULT_BUILDS[0].id,
  inventory: mockInventory,
  isFollowingAny: false,
  cloneSimilarity: 0,
}

// v8: Phase 2 — setTag array + 13 new cards (7 skill + 3 orch + 3 new prompts).
// Inventory goes from 9 → 22. Storage bump invalidates any v7 saves whose setTag
// was the old string form.
export const WORKSHOP_STORAGE_KEY = "cherry_workshop_state_v12"

/** Order of type filter buttons in the UI */
export const SKILL_TYPE_ORDER: SkillType[] = [
  "prompt",
  "mcp",
  "skill",
  "orchestration",
  "memory",
]

// Workshop — Mock data and types (Phase 2, publishing only)
// Swapped to real API in Day 3 Story 10.4
//
// Agent Execution Flow (top → bottom):
//   ① System Prompt  → agent identity (role definition)
//   ② MCP Tools      → callable tools
//   ③ Skills × 3     → domain knowledge (3 parallel slots)
//   ④ Orchestration  → execution control (agent loop)
//   ⑤ Memory         → state management
//
// Total: 7 slots · 5 types
// Foundation model is fixed to Claude Code (runtime). Not configurable per agent.

export type SkillType = "prompt" | "mcp" | "skill" | "orchestration" | "memory"

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
  flowStep: FlowStep // Position in the flow diagram
  emptyLabel: string // Description shown inside empty slot body
}

/** An Agent Build — one saved slot configuration. Users keep multiple builds
 *  (e.g., "Research", "Coding", "Debate") and switch between them via tabs.
 *  Each build has its own listing state — you can publish Build A while
 *  keeping Build B private, etc. */
export interface AgentBuild {
  id: string
  name: string
  equipped: Record<SlotKey, string | null>
  isListedOnMarket: boolean
}

export interface WorkshopState {
  builds: AgentBuild[] // Multiple saved slot configurations (tabbed)
  activeBuildId: string // Currently visible build
  inventory: InventoryItem[]
  // NOTE: Foundation model is fixed to Claude Code — no per-agent model switch.
  // NOTE: isListedOnMarket moved into AgentBuild (per-build listing).
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
    hint: "Defines the agent's role and personality",
    flowStep: 1,
    emptyLabel: "Defines the agent's role and personality",
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
    hint: "Memory strategy (vector / episodic / working)",
    flowStep: 5,
    emptyLabel: "Memory strategy (vector / episodic / working)",
  },
}

/** Mock inventory — 2~3 items per type */
export const mockInventory: InventoryItem[] = [
  // ── System Prompt ──
  {
    id: "inv-p1",
    title: "Research Assistant",
    type: "prompt",
    category: "Role",
    updatedAt: "2026-04-22",
    source: "builtin",
    summary: "Deep research tasks — citation-heavy responses.",
  },
  {
    id: "inv-p2",
    title: "Code Reviewer",
    type: "prompt",
    category: "Role",
    updatedAt: "2026-04-20",
    source: "builtin",
    summary: "Critical code review with security focus.",
  },
  {
    id: "inv-p3",
    title: "Socratic Tutor",
    type: "prompt",
    category: "Role",
    updatedAt: "2026-04-18",
    source: "purchased",
    summary: "Asks guiding questions instead of direct answers.",
  },

  // ── MCP Tools ──
  {
    id: "inv-m1",
    title: "Brave Search",
    type: "mcp",
    category: "Web",
    updatedAt: "2026-04-22",
    source: "purchased",
    summary: "Web search via Brave API.",
  },
  {
    id: "inv-m2",
    title: "Postgres MCP",
    type: "mcp",
    category: "Database",
    updatedAt: "2026-04-20",
    source: "purchased",
    summary: "SQL query execution with schema introspection.",
  },
  {
    id: "inv-m3",
    title: "Filesystem MCP",
    type: "mcp",
    category: "Local",
    updatedAt: "2026-04-15",
    source: "builtin",
    summary: "Local file read/write under sandbox.",
  },

  // ── Skills ──
  {
    id: "inv-s1",
    title: "RAG best practices",
    type: "skill",
    category: "RAG",
    updatedAt: "2026-04-22",
    source: "purchased",
    summary: "Retrieval tuning, chunking, reranking.",
  },
  {
    id: "inv-s2",
    title: "Chain-of-Thought",
    type: "skill",
    category: "Reasoning",
    updatedAt: "2026-04-20",
    source: "purchased",
    summary: "Step-by-step reasoning patterns.",
  },
  {
    id: "inv-s3",
    title: "Multi-hop RAG",
    type: "skill",
    category: "RAG",
    updatedAt: "2026-04-18",
    source: "followed",
    sourceAgent: "gpt_research_bot",
    summary: "Multi-step retrieval across entities.",
  },
  {
    id: "inv-s4",
    title: "Adversarial prompting",
    type: "skill",
    category: "Safety",
    updatedAt: "2026-04-16",
    source: "followed",
    sourceAgent: "claude_linux_test",
    summary: "Defense against prompt injection.",
  },
  {
    id: "inv-s5",
    title: "Structured output",
    type: "skill",
    category: "Output",
    updatedAt: "2026-04-14",
    source: "purchased",
    summary: "JSON schema / tool-call formatting.",
  },

  // ── Orchestration ──
  {
    id: "inv-o1",
    title: "ReAct",
    type: "orchestration",
    category: "Agent Pattern",
    updatedAt: "2026-04-22",
    source: "builtin",
    summary: "Reason + Act loop (Yao et al. 2022).",
  },
  {
    id: "inv-o2",
    title: "CodeAct",
    type: "orchestration",
    category: "Agent Pattern",
    updatedAt: "2026-04-18",
    source: "purchased",
    summary: "Action expressed as executable code.",
  },
  {
    id: "inv-o3",
    title: "Plan-and-Execute",
    type: "orchestration",
    category: "Agent Pattern",
    updatedAt: "2026-04-12",
    source: "purchased",
    summary: "Upfront plan → iterative execution.",
  },

  // ── Memory ──
  {
    id: "inv-me1",
    title: "Vector memory",
    type: "memory",
    category: "Long-term",
    updatedAt: "2026-04-20",
    source: "builtin",
    summary: "Embedding-based similarity retrieval.",
  },
  {
    id: "inv-me2",
    title: "Episodic buffer",
    type: "memory",
    category: "Short-term",
    updatedAt: "2026-04-15",
    source: "purchased",
    summary: "Recent conversation window.",
  },
  {
    id: "inv-me3",
    title: "Working scratchpad",
    type: "memory",
    category: "Working",
    updatedAt: "2026-04-10",
    source: "builtin",
    summary: "Task-scoped notes between steps.",
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

// v5: Foundation model pulldown removed (Claude Code fixed)
export const WORKSHOP_STORAGE_KEY = "cherry_workshop_state_v5"

/** Order of type filter buttons in the UI */
export const SKILL_TYPE_ORDER: SkillType[] = ["prompt", "mcp", "skill", "orchestration", "memory"]

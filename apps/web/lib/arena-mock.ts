// Arena — Mock data (Phase 2 publishing only, no backend)
//
// Surfaces:
//   🔥 Hot This Week       — single large featured card (advertisement-style)
//   👑 Overall Champion    — cross-category #1 highlight
//   Category tabs          — RAG / Agents / Reasoning, Top 10 leaderboard each
//   🔀 Recent Matches      — A2A-style live feed

export type ArenaCategory = "RAG" | "Agents" | "Reasoning"
export const ARENA_CATEGORIES: ArenaCategory[] = ["RAG", "Agents", "Reasoning"]

export type KarmaTier = "Bronze" | "Silver" | "Gold" | "Platinum"

export interface ArenaAgent {
  id: string
  name: string
  karmaTier: KarmaTier
  elo: number
  wins: number
  losses: number
  category: ArenaCategory
  rank: number
  badges: string[] // emoji badges e.g. ["🔥", "⚡"]
  tagline?: string // Only set for the Hot / Champion card
}

export interface ArenaMatch {
  id: string
  fromAgent: string
  toAgent: string
  winnerAgent: string
  category: ArenaCategory
  relativeTime: string // "2m ago"
  scoreFrom?: number // optional — judge score
  scoreTo?: number
  /** Optional highlight — drives the accent tag & footer variant */
  highlight?: "upset" | "streak" | "close" | "debut" | null
  /** Optional extra context (streak count, debut note, judge verdict etc.) */
  note?: string
}

/* ═══════════════════════════════════════════════
   🔥 Hot This Week
═══════════════════════════════════════════════ */
export const hotAgent: ArenaAgent = {
  id: "hot-1",
  name: "claude_linux_test",
  karmaTier: "Silver",
  elo: 1847,
  wins: 23,
  losses: 4,
  category: "RAG",
  rank: 1,
  badges: ["🔥", "⚡"],
  tagline: "Climbed to #1 in 24 hours — 9-match winning streak",
}

/* ═══════════════════════════════════════════════
   👑 Overall Champion (across all categories)
═══════════════════════════════════════════════ */
export const overallChampion: ArenaAgent = {
  id: "champ-1",
  name: "gpt_research_bot",
  karmaTier: "Gold",
  elo: 1923,
  wins: 47,
  losses: 5,
  category: "RAG",
  rank: 1,
  badges: ["👑", "🔥"],
  tagline: "Season-long reign — 90% win rate",
}

/* ═══════════════════════════════════════════════
   Category rankings — Top 10 per category
═══════════════════════════════════════════════ */
function mk(
  id: string,
  name: string,
  category: ArenaCategory,
  rank: number,
  elo: number,
  wins: number,
  losses: number,
  karmaTier: KarmaTier,
  badges: string[] = [],
): ArenaAgent {
  return { id, name, karmaTier, elo, wins, losses, category, rank, badges }
}

export const categoryRankings: Record<ArenaCategory, ArenaAgent[]> = {
  RAG: [
    mk("rag-1", "gpt_research_bot", "RAG", 1, 1923, 47, 5, "Gold", ["👑", "🔥"]),
    mk("rag-2", "claude_linux_test", "RAG", 2, 1847, 23, 4, "Silver", ["🔥", "⚡"]),
    mk("rag-3", "rag_specialist_03", "RAG", 3, 1792, 34, 10, "Silver", ["⚡"]),
    mk("rag-4", "retrieval_pro", "RAG", 4, 1734, 28, 12, "Silver"),
    mk("rag-5", "multihop_master", "RAG", 5, 1689, 22, 14, "Bronze"),
    mk("rag-6", "vector_ninja", "RAG", 6, 1655, 19, 15, "Bronze"),
    mk("rag-7", "chunker_v2", "RAG", 7, 1612, 17, 16, "Bronze"),
    mk("rag-8", "rerank_one", "RAG", 8, 1588, 15, 17, "Bronze"),
    mk("rag-9", "embed_daily", "RAG", 9, 1544, 13, 19, "Bronze"),
    mk("rag-10", "rag_apprentice", "RAG", 10, 1501, 11, 20, "Bronze"),
  ],
  Agents: [
    mk("ag-1", "orchestra_one", "Agents", 1, 1889, 41, 7, "Gold", ["🔥"]),
    mk("ag-2", "codeact_main", "Agents", 2, 1823, 35, 9, "Silver", ["⚡"]),
    mk("ag-3", "react_v3", "Agents", 3, 1778, 30, 11, "Silver"),
    mk("ag-4", "plan_execute", "Agents", 4, 1721, 26, 13, "Silver"),
    mk("ag-5", "tool_caller", "Agents", 5, 1684, 24, 14, "Bronze"),
    mk("ag-6", "agent_loop_3", "Agents", 6, 1632, 20, 15, "Bronze"),
    mk("ag-7", "dispatcher_01", "Agents", 7, 1599, 18, 16, "Bronze"),
    mk("ag-8", "mcp_bridge", "Agents", 8, 1567, 16, 17, "Bronze"),
    mk("ag-9", "worker_02", "Agents", 9, 1523, 14, 18, "Bronze"),
    mk("ag-10", "junior_agent", "Agents", 10, 1498, 12, 19, "Bronze"),
  ],
  Reasoning: [
    mk("rs-1", "logic_beacon", "Reasoning", 1, 1901, 44, 6, "Gold", ["🔥"]),
    mk("rs-2", "cot_master", "Reasoning", 2, 1855, 38, 8, "Silver", ["⚡"]),
    mk("rs-3", "tot_solver", "Reasoning", 3, 1798, 31, 10, "Silver"),
    mk("rs-4", "self_check_v2", "Reasoning", 4, 1744, 27, 12, "Silver"),
    mk("rs-5", "decomposer_01", "Reasoning", 5, 1702, 24, 13, "Bronze"),
    mk("rs-6", "verifier_ai", "Reasoning", 6, 1658, 21, 14, "Bronze"),
    mk("rs-7", "branch_bot", "Reasoning", 7, 1617, 18, 15, "Bronze"),
    mk("rs-8", "reflect_3x", "Reasoning", 8, 1582, 16, 16, "Bronze"),
    mk("rs-9", "stepwise", "Reasoning", 9, 1541, 14, 17, "Bronze"),
    mk("rs-10", "rookie_think", "Reasoning", 10, 1502, 12, 18, "Bronze"),
  ],
}

/* ═══════════════════════════════════════════════
   🔀 Recent matches
═══════════════════════════════════════════════ */
export const recentMatches: ArenaMatch[] = [
  { id: "m1", fromAgent: "claude_linux_test", toAgent: "gpt_research_bot", winnerAgent: "claude_linux_test", category: "RAG", relativeTime: "2m ago", scoreFrom: 8.6, scoreTo: 7.9, highlight: "streak", note: "9-match winning streak" },
  { id: "m2", fromAgent: "orchestra_one", toAgent: "react_v3", winnerAgent: "orchestra_one", category: "Agents", relativeTime: "5m ago", scoreFrom: 9.1, scoreTo: 8.4, highlight: null, note: "Judge: cleaner tool-use." },
  { id: "m3", fromAgent: "cot_master", toAgent: "tot_solver", winnerAgent: "tot_solver", category: "Reasoning", relativeTime: "11m ago", scoreFrom: 7.2, scoreTo: 7.8, highlight: "upset", note: "#3 defeats #2 head-on." },
  { id: "m4", fromAgent: "multihop_master", toAgent: "retrieval_pro", winnerAgent: "retrieval_pro", category: "RAG", relativeTime: "18m ago", scoreFrom: 6.9, scoreTo: 7.6, highlight: "close", note: "Decided on the final hop." },
  { id: "m5", fromAgent: "codeact_main", toAgent: "plan_execute", winnerAgent: "codeact_main", category: "Agents", relativeTime: "24m ago", scoreFrom: 8.3, scoreTo: 7.5, highlight: null, note: "Judge: fewer wasted calls." },
  { id: "m6", fromAgent: "logic_beacon", toAgent: "self_check_v2", winnerAgent: "logic_beacon", category: "Reasoning", relativeTime: "31m ago", scoreFrom: 8.9, scoreTo: 7.3 },
  { id: "m7", fromAgent: "vector_ninja", toAgent: "chunker_v2", winnerAgent: "vector_ninja", category: "RAG", relativeTime: "42m ago", scoreFrom: 7.4, scoreTo: 7.0, highlight: "close", note: "Within 0.4." },
  { id: "m8", fromAgent: "tool_caller", toAgent: "dispatcher_01", winnerAgent: "tool_caller", category: "Agents", relativeTime: "55m ago", scoreFrom: 7.8, scoreTo: 7.2, highlight: "debut", note: "tool_caller's 1st arena match." },
  { id: "m9", fromAgent: "decomposer_01", toAgent: "reflect_3x", winnerAgent: "decomposer_01", category: "Reasoning", relativeTime: "1h ago", scoreFrom: 7.6, scoreTo: 6.9 },
]

export const karmaColor: Record<KarmaTier, string> = {
  Bronze: "#A85D2C",
  Silver: "#6B7280",
  Gold: "#C9A24A",
  Platinum: "#7B5EA7",
}

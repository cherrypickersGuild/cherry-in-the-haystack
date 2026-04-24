import { API_URL } from "./auth"

/* ══════════════════════════════════════════════════════════════════
   Types — mirror `apps/api/src/modules/bench/` response shapes.
   Keep in sync manually (small enough, avoids a build dep).
   ════════════════════════════════════════════════════════════════ */

export type MemoryMode = "none" | "short" | "retrieval"

export interface BenchSetSummary {
  id: string
  name: string
  tabLabel: string
  subtitle: string
  skills: string[]
  toolNames: string[]
  memoryMode: MemoryMode
  task: string
}

export type MetricDirection = "higher-better" | "lower-better" | "neutral"

export type MetricCategory =
  | "accuracy"
  | "hallucination"
  | "groundedness"
  | "completion"
  | "cost"
  | "tool"

export interface Metric {
  id: string
  label: string
  value: string | number
  unit?: string
  passed?: boolean
  direction: MetricDirection
  category: MetricCategory
}

export interface ToolCallRecord {
  name: string
  input: Record<string, unknown>
  output?: unknown
  error?: string
  durationMs: number
}

export interface BenchCompareSide {
  text: string
  latencyMs: number
  tokens: {
    input: number
    output: number
    total: number
  }
  iterations: number
  toolCalls: ToolCallRecord[]
  metrics: Metric[]
}

export interface BenchCompareResponse {
  setId: string
  setName: string
  task: string
  skills: string[]
  toolNames: string[]
  systemPrompt: string
  groundTruthSummary: string
  baseline: BenchCompareSide
  enhanced: BenchCompareSide
  runAt: string
}

/* ══════════════════════════════════════════════════════════════════
   Fetchers
   ════════════════════════════════════════════════════════════════ */

export async function fetchBenchSets(): Promise<BenchSetSummary[]> {
  const res = await fetch(`${API_URL}/api/v1/kaas/bench/sets`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`fetchBenchSets ${res.status}`)
  return res.json()
}

export async function runBenchCompare(
  setId: string,
): Promise<BenchCompareResponse> {
  const res = await fetch(`${API_URL}/api/v1/kaas/bench/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setId }),
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.message ?? body?.code ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(
      `runBenchCompare ${res.status}${detail ? ` · ${detail}` : ""}`,
    )
  }
  return res.json()
}

/* ══════════════════════════════════════════════════════════════════
   /run — the real version: send a TASK + the user's EQUIPPED BUILD.
   Backend composes the runtime from card ids and actually hands them
   to Claude. Empty build ⇒ enhanced ≈ baseline.
   ════════════════════════════════════════════════════════════════ */

export interface AgentBuildPayload {
  prompt: string | null
  mcp: string | null
  skillA: string | null
  skillB: string | null
  skillC: string | null
  orchestration: string | null
  memory: string | null
}

/* ══════════════════════════════════════════════════════════════════
   Install Skill — push a Workshop build onto a connected agent.
   Mirrors apps/api/src/modules/kaas/install-build.service.ts response.
   ════════════════════════════════════════════════════════════════ */

export interface InstallBuildRequest {
  build_id: string
  build_name: string
  equipped: AgentBuildPayload
}

export interface InstalledEntry {
  slot: string
  card_id: string
  dir: string
  file: string
  saved_path: string
  size_bytes: number
}

export interface SkipEntry {
  slot: string
  card_id: string | null
  reason: string
}

export interface FailedEntry {
  slot: string
  card_id: string
  error: string
}

export interface LocalSkillItem {
  dir: string
  hasSkillMd: boolean
  sizeBytes: number
  mtime: string | null
}

export interface InstallBuildResponse {
  installed: InstalledEntry[]
  skipped: SkipEntry[]
  failed: FailedEntry[]
  meta_written: boolean
  orphans_removed: string[]
  local_skills_after: LocalSkillItem[]
  warnings: string[]
  /** Copy-ready natural-language prompt that activates the installed mode. */
  activation_prompt: string
}

import { fetchWithAuth } from "./auth"

export async function installBuild(
  agentId: string,
  body: InstallBuildRequest,
): Promise<InstallBuildResponse> {
  const res = await fetchWithAuth(
    `${API_URL}/api/v1/kaas/agents/${agentId}/install-build`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  // 207 Multi-Status is treated as partial success — still return parsed JSON
  if (!res.ok && res.status !== 207) {
    let detail = ""
    try {
      const b = await res.json()
      detail = b?.message ?? b?.code ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(
      `installBuild ${res.status}${detail ? ` · ${detail}` : ""}`,
    )
  }
  return res.json()
}

export interface AppliedSlots {
  prompt: boolean
  mcp: boolean
  memory: boolean
  /** Phase 2: number of skill slots actively composed into the system prompt. */
  skillsActive?: number
  /** Phase 2: orchestration slot equipped with a non-standard strategy. */
  orchestrationActive?: boolean
  /** @deprecated Phase 1 field, always 0 in Phase 2. Kept for response compat. */
  skillsIgnored: number
  /** @deprecated Phase 1 field, always false in Phase 2. Kept for response compat. */
  orchestrationIgnored: boolean
}

export interface BenchRunResponse extends BenchCompareResponse {
  appliedSlots: AppliedSlots
  memoryMode: string
  maxIterations: number
}

export async function runBenchWithBuild(
  taskId: string,
  build: AgentBuildPayload,
): Promise<BenchRunResponse> {
  const res = await fetch(`${API_URL}/api/v1/kaas/bench/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, build }),
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.message ?? body?.code ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(
      `runBenchWithBuild ${res.status}${detail ? ` · ${detail}` : ""}`,
    )
  }
  return res.json()
}

/* ══════════════════════════════════════════════════════════════════
   UI helpers — derive delta label for a pair of baseline/enhanced
   metrics. Used in the metric table.
   ════════════════════════════════════════════════════════════════ */

/** Numeric coercion tolerant of "12.34%", "3 / 3", etc. */
function coerce(v: string | number): number | null {
  if (typeof v === "number") return v
  if (typeof v !== "string") return null
  // Pull first number token.
  const m = v.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

export interface MetricDelta {
  id: string
  label: string
  before: string
  after: string
  /** Text like "+2", "-23.2pp", or "—". */
  delta: string
  /** true if improved (based on metric.direction). */
  improved: boolean
  direction: MetricDirection
  category: MetricCategory
}

export function computeMetricDeltas(
  baseline: Metric[],
  enhanced: Metric[],
): MetricDelta[] {
  const byId = new Map<string, Metric>()
  for (const m of baseline) byId.set(m.id, m)

  return enhanced.map((after) => {
    const before = byId.get(after.id)
    const beforeDisplay = before
      ? formatValue(before.value)
      : "—"
    const afterDisplay = formatValue(after.value)

    let delta = "—"
    let improved = false

    if (before) {
      const bn = coerce(before.value)
      const an = coerce(after.value)
      if (bn !== null && an !== null) {
        const diff = an - bn
        // "pp" for percent-valued metrics, plain diff for counts.
        const isPct =
          typeof before.value === "string" && before.value.includes("%")
        const unit = isPct ? "pp" : ""
        delta = `${diff >= 0 ? "+" : ""}${fmtNum(diff)}${unit}`

        if (after.direction === "higher-better") improved = diff > 0
        else if (after.direction === "lower-better") improved = diff < 0
        else improved = diff !== 0
      } else if (
        typeof before.passed === "boolean" &&
        typeof after.passed === "boolean"
      ) {
        improved = !before.passed && after.passed
        delta = improved ? "pass" : before.passed !== after.passed ? "flip" : "—"
      }
    }

    return {
      id: after.id,
      label: after.label,
      before: beforeDisplay,
      after: afterDisplay,
      delta,
      improved,
      direction: after.direction,
      category: after.category,
    }
  })
}

function formatValue(v: string | number): string {
  if (typeof v === "number") return fmtNum(v)
  return v
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

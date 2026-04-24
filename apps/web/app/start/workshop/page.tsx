"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchAgents } from "@/lib/api"
import { getAccessToken, useAuthTick } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"
import { KaasWorkshopPanel } from "@/components/cherry/kaas-workshop-panel"
import {
  fetchBenchSets,
  runBenchWithBuild,
  computeMetricDeltas,
  type BenchSetSummary,
  type BenchRunResponse,
  type MetricDelta,
  type AgentBuildPayload,
} from "@/lib/bench-api"
import { WORKSHOP_STORAGE_KEY, type WorkshopState } from "@/lib/workshop-mock"

interface Agent {
  id: string
  name: string
  icon?: string
  api_key?: string
  karma_tier?: string
}

export default function WorkshopPage() {
  useAuthTick()
  // SSR returns null for localStorage-backed tokens; defer until mount so
  // the Unauthenticated branch below doesn't flip during hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const token = mounted ? getAccessToken() : null

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchAgents()
      .then((data) => {
        setAgents(data ?? [])
        if (data?.[0]?.id) setSelectedId(data[0].id)
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [token])

  const selected = agents.find((a) => a.id === selectedId)

  // ── Unauthenticated (or pre-mount SSR) ──
  if (!token) {
    return (
      <section className="flex flex-col items-center justify-center text-center py-16">
        <CherryBao size={140} animate />
        <h1 className="mt-6 text-[26px] font-extrabold text-[#3A2A1C]">
          Build your own AI
        </h1>
        <p className="mt-2 text-[14px] text-[#6B4F2A] max-w-md leading-relaxed">
          Drag · Drop · Done. No coding required.
        </p>
        <Link
          href="/start/login?next=/start/workshop"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold shadow-md hover:shadow-lg transition-all"
        >
          Get started
        </Link>
      </section>
    )
  }

  const hasAgent = agents.length > 0

  return (
    <section className="space-y-4">
      {/* ── Page header — what is the Workshop? ── */}
      <div>
        <h1 className="text-[20px] lg:text-[22px] font-extrabold text-[#3A2A1C]">
          Workshop
        </h1>
        <p className="mt-1 text-[12px] text-[#6B4F2A] leading-relaxed max-w-2xl">
          Forge a custom AI build by dragging cards onto the seven equipment slots — system prompt, MCP tools, three skills, orchestration strategy, and memory mode. Run the benchmark below to see how your build changes Claude's behavior in real time. Once you like it, head to <span className="font-semibold text-[#3A2A1C]">Install Skill</span> to push it to one of your AI assistants.
        </p>
      </div>


      {/* Workshop — reuse existing panel.
          Height expands naturally so the page scrolls vertically instead
          of locking everything inside a 720px box. */}
      <div
        className="rounded-[20px] bg-[#FDFBF5] overflow-hidden"
        style={{
          border: "1px solid #E9D1A6",
          boxShadow: "0 4px 20px rgba(107,79,42,0.08)",
        }}
      >
        <div className="min-h-[720px]">
          <KaasWorkshopPanel
            currentAgent={selected}
            currentAgentApiKey={selected?.api_key}
          />
        </div>
      </div>

      {/* Before / After — preview how this build changes Claude Code */}
      <BeforeAfterPreview agentName={selected?.name} />
    </section>
  )
}

/* ─────────────────────────────────────────────
   BeforeAfterPreview — benchmark-style comparison.
   Fetches 3 sets from the backend, runs real Anthropic
   compare + evaluator, renders metrics side-by-side.
───────────────────────────────────────────── */

function BeforeAfterPreview({ agentName }: { agentName?: string }) {
  const [sets, setSets] = useState<BenchSetSummary[]>([])
  const [setsError, setSetsError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string>("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BenchRunResponse | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  // Load sets once.
  useEffect(() => {
    let cancelled = false
    fetchBenchSets()
      .then((data) => {
        if (cancelled) return
        setSets(data)
        if (data.length > 0) setActiveId(data[0].id)
      })
      .catch((err) => {
        if (cancelled) return
        setSetsError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeSet = sets.find((s) => s.id === activeId)

  async function runBenchmark() {
    if (!activeId) return
    const build = readActiveBuildFromStorage()
    setRunning(true)
    setRunError(null)
    // Keep the previous result visible so gauges animate to new values
    // instead of collapsing and re-mounting on every re-run.
    try {
      const r = await runBenchWithBuild(activeId, build)
      setResult(r)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  function switchSet(id: string) {
    setActiveId(id)
    setResult(null)
    setRunError(null)
  }

  const ran = Boolean(result)
  const deltas = result
    ? computeMetricDeltas(result.baseline.metrics, result.enhanced.metrics)
    : []

  // Headline: highlight the 3 most demo-worthy metrics (completion → accuracy → hallucination → groundedness → tool).
  const headlineOrder: Record<string, number> = {
    completion: 0, accuracy: 1, hallucination: 2, groundedness: 3, tool: 4, cost: 5,
  }
  const headlineDeltas = [...deltas]
    .sort((a, b) => (headlineOrder[a.category] ?? 9) - (headlineOrder[b.category] ?? 9))
    .slice(0, 3)

  return (
    <div className="mt-2">
      <h2 className="mb-5 text-[18px] lg:text-[20px] font-extrabold text-[#2A1E15] tracking-tight">
        Benchmark
      </h2>

      {/* ── Sets error state ── */}
      {setsError && (
        <div className="mb-4 rounded-xl px-4 py-3 text-[12px]" style={{ backgroundColor: "#FBE8E3", border: "1px solid #F2C7BE", color: "#C8301E" }}>
          Couldn't load benchmark sets: {setsError}
        </div>
      )}

      {/* ── Set tabs ── */}
      {sets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {sets.map((s) => {
            const active = s.id === activeId
            return (
              <button
                key={s.id}
                onClick={() => switchSet(s.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                  active
                    ? "bg-[#3A2A1C] text-[#FDFBF5]"
                    : "bg-[#FDFBF5] text-[#6B4F2A] hover:bg-[#F5E4C2]/50 border border-[#E9D1A6]"
                }`}
              >
                {s.tabLabel}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Task card (simplified) ── */}
      {activeSet && (
        <div
          className="rounded-[16px] bg-[#FDFBF5] p-4 mb-4 flex items-start justify-between gap-4 flex-wrap"
          style={{ border: "1px solid #E9D1A6" }}
        >
          <p className="flex-1 min-w-[260px] text-[13px] text-[#2A1E15] leading-relaxed">
            {activeSet.task}
          </p>
          <button
            onClick={runBenchmark}
            disabled={running || !activeId}
            className="px-4 py-2 rounded-full bg-[#B12A17] text-white text-[12px] font-bold hover:bg-[#8F1D12] disabled:opacity-60 transition-colors flex-shrink-0"
          >
            {running ? "Running…" : ran ? "Run again" : "Run benchmark"}
          </button>
        </div>
      )}

      {/* ── Run error ── */}
      {runError && (
        <div className="mb-4 rounded-xl px-4 py-3 text-[12px]" style={{ backgroundColor: "#FBE8E3", border: "1px solid #F2C7BE", color: "#C8301E" }}>
          Benchmark failed: {runError}
        </div>
      )}

      {/* ── Metric gauges — split Before | After (shown first) ── */}
      {ran && deltas.length > 0 && (
        <div
          className="mb-5 rounded-[16px] overflow-hidden relative"
          style={{ border: "1px solid #E9D1A6", backgroundColor: "#FDFBF5" }}
        >
          {running && (
            <div
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full shadow-sm"
              style={{ backgroundColor: "#FDFBF5", border: "1px solid #E9D1A6" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#B12A17] animate-pulse" />
              <span className="text-[10px] font-bold text-[#6B4F2A]">Live updating</span>
            </div>
          )}
          {/* Header — 3-column grid aligned with gauge rows */}
          <div
            className="grid gap-3 items-center px-4 py-2.5"
            style={{
              gridTemplateColumns: "1fr minmax(160px, auto) 1fr",
              backgroundColor: "#F5E4C2",
              borderBottom: "1px solid #E9D1A6",
            }}
          >
            <div className="flex items-center gap-2 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9A7C55]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B4F2A]">
                Before · Default Claude
              </span>
            </div>
            <div className="text-center text-[9px] font-bold uppercase tracking-[0.25em] text-[#9A7C55]">
              Metric
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B12A17]">
                After · {agentName ?? "Your AI"}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#B12A17]" />
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#E9D1A6]/60">
            {deltas.map((m) => (
              <GaugeRow key={m.id} delta={m} />
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 flex items-center justify-end"
            style={{ backgroundColor: "#FBF6ED", borderTop: "1px solid #E9D1A6" }}
          >
            <span className="text-[9px] text-[#9A7C55]">
              Longer bar = better. Green = improved.
            </span>
          </div>
        </div>
      )}

      {/* ── Before / After answer cards (shown after metrics) ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* BEFORE */}
        <div
          className="rounded-[20px] bg-[#FDFBF5] overflow-hidden flex flex-col"
          style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F0E7D4", borderBottom: "1px solid #E9D1A6" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9A7C55]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B4F2A]">
                Before · Default Claude
              </span>
            </div>
            <span className="text-[10px] text-[#9A7C55]">
              {result ? `${result.baseline.latencyMs}ms · ${result.baseline.tokens.total} tok` : "No skills · no tools"}
            </span>
          </div>
          <div className="p-5 flex-1 relative">
            {!result ? (
              <EmptyState
                text={
                  running
                    ? "Calling Claude without tools…"
                    : "Run the benchmark to see baseline response."
                }
              />
            ) : (
              <>
                <AnswerBlock text={result.baseline.text} muted />
                {running && <RunningOverlay label="Re-running baseline…" />}
              </>
            )}
          </div>
        </div>

        {/* AFTER */}
        <div
          className="rounded-[20px] bg-[#FDFBF5] overflow-hidden flex flex-col relative"
          style={{
            border: "1.5px solid #B12A17",
            boxShadow: "0 12px 32px rgba(177,42,23,0.15)",
          }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between text-white"
            style={{ background: "linear-gradient(135deg, #B12A17 0%, #8F1D12 100%)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                After · {agentName ?? "Your AI"}
              </span>
            </div>
            <span className="text-[10px] opacity-80">
              {result ? `${result.enhanced.latencyMs}ms · ${result.enhanced.tokens.total} tok · ${result.enhanced.toolCalls.length} tool${result.enhanced.toolCalls.length === 1 ? "" : "s"}` : "Build applied"}
            </span>
          </div>
          <div className="p-5 flex-1 relative">
            {!result ? (
              <EmptyState
                text={
                  running
                    ? "Calling Claude with build + tools…"
                    : "Run the benchmark to see enhanced response."
                }
              />
            ) : (
              <>
                <AnswerBlock text={result.enhanced.text} accent />
                {running && <RunningOverlay label="Re-running enhanced…" />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tool call trace ── */}
      {ran && result && result.enhanced.toolCalls.length > 0 && (
        <details className="mt-4 text-[11px]">
          <summary className="cursor-pointer text-[#9A7C55] hover:text-[#6B4F2A] font-semibold">
            See tool calls ({result.enhanced.toolCalls.length})
          </summary>
          <div className="mt-2 space-y-2">
            {result.enhanced.toolCalls.map((tc, i) => (
              <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-[#2A1E15]">{tc.name}</span>
                  <span className="text-[10px] text-[#9A7C55]">{tc.durationMs}ms</span>
                </div>
                <pre className="text-[10px] font-mono text-[#6B4F2A] whitespace-pre-wrap break-all">input: {JSON.stringify(tc.input)}</pre>
                {tc.error ? (
                  <pre className="text-[10px] font-mono text-[#C8301E] whitespace-pre-wrap break-all">error: {tc.error}</pre>
                ) : (
                  <pre className="text-[10px] font-mono text-[#2A1E15] whitespace-pre-wrap break-all">output: {JSON.stringify(tc.output)}</pre>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── System prompt peek ── */}
      {result && (
        <details className="mt-3 text-[11px]">
          <summary className="cursor-pointer text-[#9A7C55] hover:text-[#6B4F2A] font-semibold">
            See system prompt sent to Claude for "After"
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-[#FBF6ED] text-[11px] font-mono text-[#3A2A1C] whitespace-pre-wrap" style={{ border: "1px solid #E9D1A6" }}>
{result.systemPrompt}
          </pre>
        </details>
      )}
    </div>
  )
}
/* ── small helpers ── */

function ChipRow({ label, items, mono, subtle }: { label: string; items: string[]; mono?: boolean; subtle?: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9A7C55]">{label}</span>
      {items.map((it, i) => (
        <span
          key={i}
          className={`text-[10px] rounded-full px-2 py-0.5 ${mono ? "font-mono" : ""}`}
          style={{
            backgroundColor: subtle ? "transparent" : "#F5E4C2",
            color: subtle ? "#9A7C55" : "#6B4F2A",
            border: subtle ? "1px dashed #E9D1A6" : "none",
          }}
        >
          {it}
        </span>
      ))}
    </div>
  )
}

function AnswerBlock({ text, muted, accent }: { text: string; muted?: boolean; accent?: boolean }) {
  return (
    <pre
      className="text-[12px] leading-relaxed whitespace-pre-wrap font-sans"
      style={{ color: muted ? "#6B4F2A" : accent ? "#2A1E15" : "#2A1E15" }}
    >
      {text}
    </pre>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <p className="text-[11px] text-[#9A7C55] italic">{text}</p>
    </div>
  )
}

/** Shown on top of the previous answer while a re-run is in progress —
 *  keeps the old content visible (dimmed) so gauges/text don't disappear. */
function RunningOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: "rgba(253, 251, 245, 0.55)",
        backdropFilter: "blur(1px)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm"
        style={{ backgroundColor: "#FDFBF5", border: "1px solid #E9D1A6" }}
      >
        <span className="w-2 h-2 rounded-full bg-[#B12A17] animate-pulse" />
        <span className="text-[11px] font-bold text-[#6B4F2A]">{label}</span>
      </div>
    </div>
  )
}

/** Small banner right before the result cards — shows what the backend
 *  actually applied and flags Phase-1 ignored slots so the user understands
 *  why 4 of their 7 slots currently have no effect. */
function AppliedSlotsBanner({
  applied,
  memoryMode,
}: {
  applied: import("@/lib/bench-api").AppliedSlots
  memoryMode: string
}) {
  const skillsActive = applied.skillsActive ?? 0
  const orchestrationActive = applied.orchestrationActive ?? false
  const anyApplied =
    applied.prompt ||
    applied.mcp ||
    applied.memory ||
    skillsActive > 0 ||
    orchestrationActive

  return (
    <div
      className="mb-4 rounded-xl px-4 py-2.5 text-[11px] flex items-center gap-3 flex-wrap"
      style={{
        backgroundColor: anyApplied ? "#EFF7F3" : "#FBF6ED",
        border: `1px solid ${anyApplied ? "#B8D8C4" : "#E9D1A6"}`,
        color: "#2A1E15",
      }}
    >
      <span className="font-bold uppercase tracking-[0.18em] text-[#6B4F2A]">
        Applied to Claude
      </span>
      <AppliedDot label="prompt" on={applied.prompt} />
      <AppliedDot label="mcp" on={applied.mcp} />
      <AppliedDot
        label={
          skillsActive > 0
            ? `skills × ${skillsActive}`
            : "skills"
        }
        on={skillsActive > 0}
      />
      <AppliedDot
        label={orchestrationActive ? "orchestration" : "orchestration"}
        on={orchestrationActive}
      />
      <AppliedDot
        label={applied.memory ? `memory · ${memoryMode}` : "memory"}
        on={applied.memory}
      />
      {!anyApplied && (
        <span className="text-[#9A7C55] italic">
          Empty build — enhanced run ≈ baseline.
        </span>
      )}
    </div>
  )
}

function AppliedDot({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: on ? "#2D7A5E" : "#C9B88A" }}
      />
      <span
        className={on ? "font-bold text-[#2A1E15]" : "text-[#9A7C55] line-through"}
      >
        {label}
      </span>
    </span>
  )
}

/** Read the currently-active Workshop build straight out of localStorage,
 *  translate it into the payload shape `/bench/run` expects.
 *  Returns all-null (= empty build) if the Workshop state hasn't been saved
 *  yet (e.g. user never touched a slot). */
function readActiveBuildFromStorage(): AgentBuildPayload {
  const empty: AgentBuildPayload = {
    prompt: null, mcp: null, skillA: null, skillB: null, skillC: null,
    orchestration: null, memory: null,
  }
  if (typeof window === "undefined") return empty
  try {
    const raw = localStorage.getItem(WORKSHOP_STORAGE_KEY)
    if (!raw) return empty
    const state = JSON.parse(raw) as Partial<WorkshopState>
    const activeId = state.activeBuildId
    const active = state.builds?.find((b) => b.id === activeId) ?? state.builds?.[0]
    const equipped = active?.equipped
    if (!equipped) return empty
    return {
      prompt: equipped.prompt ?? null,
      mcp: equipped.mcp ?? null,
      skillA: equipped.skillA ?? null,
      skillB: equipped.skillB ?? null,
      skillC: equipped.skillC ?? null,
      orchestration: equipped.orchestration ?? null,
      memory: equipped.memory ?? null,
    }
  } catch {
    return empty
  }
}

/* ─────────────────────────────────────────────
   GaugeRow — one metric shown as twin mirrored bars.
   Left half = baseline (bar grows from center toward LEFT).
   Right half = enhanced (bar grows from center toward RIGHT).
   Longer bar = better score (always).
───────────────────────────────────────────── */
function GaugeRow({ delta }: { delta: MetricDelta }) {
  // Absolute, side-independent scoring — one side changing does NOT move the
  // other side's bar. null → render an empty track (no fill).
  const beforeScore = scoreSide(delta.before, delta.direction)
  const afterScore = scoreSide(delta.after, delta.direction)
  const afterColor = delta.improved ? "#2D7A5E" : "#B12A17"

  return (
    <div
      className="grid items-center gap-4 px-5 py-4"
      style={{ gridTemplateColumns: "1fr minmax(180px, auto) 1fr" }}
    >
      {/* ── BEFORE — value + mirrored gauge ── */}
      <div className="flex items-center gap-3 justify-end min-w-0">
        <span className="text-[15px] font-mono font-bold text-[#6B4F2A] tabular-nums whitespace-nowrap">
          {delta.before}
        </span>
        <div
          className="flex-1 max-w-[200px] relative h-2.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "#F0E7D4" }}
        >
          {beforeScore !== null && (
            <div
              className="absolute right-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${beforeScore}%`,
                backgroundColor: "#9A7C55",
              }}
            />
          )}
        </div>
      </div>

      {/* ── Center label ── */}
      <div className="text-center text-[12px] font-semibold text-[#2A1E15] px-2 whitespace-nowrap">
        {delta.label}
      </div>

      {/* ── AFTER — gauge + value ── */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex-1 max-w-[200px] relative h-2.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "#F0E7D4" }}
        >
          {afterScore !== null && (
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${afterScore}%`,
                backgroundColor: afterColor,
              }}
            />
          )}
        </div>
        <span
          className="text-[16px] font-mono font-extrabold tabular-nums whitespace-nowrap"
          style={{ color: delta.improved ? "#2D7A5E" : "#2A1E15" }}
        >
          {delta.after}
        </span>
      </div>
    </div>
  )
}

/** Score one side of a delta ABSOLUTELY — independent of the other side.
 *  Returns 0–100 (% of the bar to fill), or null for "nothing to render".
 *  Rules:
 *   - Yes / No  → 100 / 0
 *   - "X / Y" with Y>0 → (X/Y)*100; if Y=0 or "0/0" → null
 *   - "NN%"      → NN clamped to 0–100
 *   - raw count  → min(value * 10, 100)  (0→0, 10+→full)
 *   - "—" / unparseable → null
 *  Direction is respected: for `lower-better`, we show "how far from zero"
 *  inverted so smaller value = longer bar (e.g. 5% error bar = 95% full). */
function scoreSide(
  raw: string,
  direction: MetricDelta["direction"],
): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "—") return null
  const s = raw.trim()

  // Pass / fail words
  if (/^(yes|true|pass|✓)$/i.test(s)) return 100
  if (/^(no|false|fail|✗)$/i.test(s)) return 0

  // X / Y ratio (counts like "3 / 3")
  const ratio = s.match(/^(\d+)\s*\/\s*(\d+)/)
  if (ratio) {
    const num = parseInt(ratio[1], 10)
    const den = parseInt(ratio[2], 10)
    if (den <= 0) return null // "0 / 0" is meaningless
    return clamp01(num / den) * 100
  }

  // Percentage ("12.3%" or "100%")
  const pct = s.match(/^-?\d+(?:\.\d+)?\s*%$/)
  if (pct) {
    const n = parseFloat(s)
    if (direction === "lower-better") {
      // Error-style: 0% = great (full bar), 100% = terrible (empty bar)
      return clamp01(1 - n / 100) * 100
    }
    return Math.max(0, Math.min(100, n))
  }

  // Raw integer (counts)
  const num = s.match(/^-?\d+(?:\.\d+)?$/)
  if (num) {
    const n = parseFloat(s)
    if (n <= 0) return 0
    // Scale: 1 unit ≈ 10%, cap at 100
    return Math.min(100, n * 10)
  }

  return null
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}


/* ─────────────────────────────────────────────
   AgentPicker — compact pulldown with Bao + name
───────────────────────────────────────────── */
function AgentPicker({
  agents, selectedId, onSelect,
}: {
  agents: Agent[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0]
  if (!selected) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDFBF5] border border-[#E9D1A6] hover:bg-[#F5E4C2]/30 transition-colors cursor-pointer"
      >
        <span className="text-[16px] leading-none">{selected.icon ?? "🤖"}</span>
        <span className="text-[13px] font-bold text-[#3A2A1C]">{selected.name}</span>
        <span className="text-[9px] text-[#9A7C55]">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#FDFBF5] rounded-xl shadow-lg overflow-hidden min-w-[240px]"
            style={{ border: "1px solid #E9D1A6" }}
          >
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onSelect(a.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  a.id === selectedId
                    ? "bg-[#F5E4C2]/60 text-[#3A2A1C]"
                    : "hover:bg-[#F5E4C2]/30 text-[#6B4F2A]"
                }`}
              >
                <span className="text-[16px] leading-none">{a.icon ?? "🤖"}</span>
                <span className="text-[13px] font-semibold truncate flex-1">{a.name}</span>
                {a.karma_tier && (
                  <span className="text-[10px] font-mono text-[#9A7C55]">{a.karma_tier}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

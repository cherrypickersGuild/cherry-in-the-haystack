"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { deleteAgent, fetchAgents, fetchAgentSelfReport, registerAgent } from "@/lib/api"
import { installBuild, type InstallBuildResponse } from "@/lib/bench-api"
import { getAccessToken, useAuthTick } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"
import { ExportFlockxModal } from "@/components/cherry/export-flockx-modal"
import { ExportAgentverseModal } from "@/components/cherry/export-agentverse-modal"
import { ExportFlockBundleModal } from "@/components/cherry/export-flock-bundle-modal"
import { InstallResultPanel } from "@/components/cherry/install-result-panel"
import { LiveProofCard } from "@/components/cherry/live-proof-card"
import { StartFlowNav } from "@/components/cherry/start-flow-nav"
import {
  SLOT_META,
  WORKSHOP_STORAGE_KEY,
  type AgentBuild,
  type InventoryItem,
  type SlotKey,
  type WorkshopState,
} from "@/lib/workshop-mock"

/** Source of truth for "is this agent running a build right now?" is the
 *  agent's own ~/.claude/skills/ directory — NOT browser localStorage.
 *  On mount we ping self-report; after install we use the response's
 *  local_skills_after. localStorage is only used for Workshop builds. */

function readWorkshop(): WorkshopState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(WORKSHOP_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WorkshopState) : null
  } catch {
    return null
  }
}

function writeWorkshop(state: WorkshopState) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

interface Agent {
  id: string
  name: string
  icon?: string
  api_key?: string
  karma_tier?: string
  credits?: number
  wallet_address?: string
  wallet_type?: "evm" | "near" | string
}

type WalletType = "evm" | "near"

export default function ConnectPage() {
  useAuthTick()
  // SSR returns null for localStorage-backed tokens; defer until mount so
  // the Unauthenticated branch doesn't flip during hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const token = mounted ? getAccessToken() : null

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [os, setOs] = useState<"mac" | "win">("mac")
  const [copied, setCopied] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [checkState, setCheckState] = useState<"idle" | "checking" | "ok" | "fail">("idle")
  const [checkMessage, setCheckMessage] = useState<string>("")

  // Install Skill state — lifted so the side panel can render next to
  // everything on desktop (2-col) and below on mobile (stacked).
  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState<InstallBuildResponse | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  /** Live report pushed from agent via WebSocket — separate proof channel
   *  from the install response. Triggered when the user runs
   *  `generate_self_report` MCP tool inside Claude Code. */
  const [liveReport, setLiveReport] = useState<{
    items: Array<{ dir: string; hasSkillMd: boolean; sizeBytes: number; mtime: string | null }>
    receivedAt: string
  } | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    load()
  }, [token])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAgents()
      setAgents(data ?? [])
      if (data?.[0]?.id && !selectedId) setSelectedId(data[0].id)
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteAgent(id)
      setDeleteConfirmId(null)
      if (selectedId === id) setSelectedId("")
      await load()
    } catch {
      /* noop */
    } finally {
      setDeleting(false)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  /** Same check the Cherry dashboard's "Diff" modal uses — asks the agent
   *  process (via MCP stdio) for a self-report. Only a live-responding
   *  agent returns { ok: true, report: ... }. Anything else = not connected. */
  async function checkConnection() {
    if (!selected?.id) return
    setCheckState("checking")
    setCheckMessage("")
    try {
      const r: { ok?: boolean; error?: string; hint?: string; report?: unknown } =
        await fetchAgentSelfReport(selected.id)
      if (r?.ok && r.report) {
        setCheckState("ok")
        setCheckMessage("Agent responded to self-report — MCP link is live.")
      } else {
        setCheckState("fail")
        const why = r?.error ?? "Agent did not respond"
        const hint = r?.hint ? ` · ${r.hint}` : ""
        setCheckMessage(`${why}${hint}`)
      }
    } catch (e) {
      setCheckState("fail")
      setCheckMessage(
        e instanceof Error
          ? `Request failed — ${e.message}`
          : "Request failed. Make sure 'claude' is running with the cherry-kaas MCP server."
      )
    }
  }

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0]

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://solteti.site"
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    (siteUrl.includes("localhost:3000") ? "http://localhost:4000" : "https://api.solteti.site")

  const cmdMac = selected
    ? `curl -so ~/cherry-agent.js ${siteUrl}/cherry-agent.js && curl -so ~/cherry-kaas.sh ${siteUrl}/cherry-kaas.sh && chmod +x ~/cherry-kaas.sh && claude mcp add cherry-kaas ~/cherry-kaas.sh --env KAAS_AGENT_API_KEY=${selected.api_key ?? "YOUR_KEY"} --env KAAS_WS_URL=${apiUrl}`
    : ""
  const cmdWin = selected
    ? `curl.exe -so "$env:USERPROFILE\\cherry-agent.js" ${siteUrl}/cherry-agent.js; curl.exe -so "$env:USERPROFILE\\cherry-kaas.bat" ${siteUrl}/cherry-kaas.bat; claude mcp add cherry-kaas "$env:USERPROFILE\\cherry-kaas.bat" --env KAAS_AGENT_API_KEY=${selected.api_key ?? "YOUR_KEY"} --env KAAS_WS_URL=${apiUrl}`
    : ""
  const cmd = os === "mac" ? cmdMac : cmdWin
  const removeCmd = "claude mcp remove cherry-kaas"

  // ── Unauthenticated ──
  if (!token) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={120} animate />
        <h1 className="mt-6 text-[22px] font-extrabold text-[#3A2A1C]">
          Sign in to continue
        </h1>
        <Link
          href="/start/login?next=/start/connect"
          className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold hover:shadow-lg transition-all"
        >
          Sign in
        </Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={96} variant="sleeping" animate />
        <p className="mt-4 text-[13px] text-[#9A7C55]">Loading…</p>
      </section>
    )
  }

  if (agents.length === 0) {
    return (
      <section className="py-10 space-y-16">
        {/* ══ FLOW — two large, clearly distinct tiles ══ */}
        <div className="flex items-center justify-center gap-4 lg:gap-6">
          {/* Workshop tile — warm cream, the prerequisite */}
          <Link
            href="/start/workshop"
            className="group relative flex flex-col items-center justify-center w-[200px] h-[200px] rounded-[24px] transition-all hover:-translate-y-0.5"
            style={{
              backgroundColor: "#F5E4C2",
              border: "2px solid #D9B77E",
              boxShadow: "0 6px 20px rgba(107,79,42,0.12)",
            }}
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-[10px] font-black shadow-md whitespace-nowrap"
              style={{ backgroundColor: "#2D7A5E" }}
            >
              ✓ STEP 1 · START HERE
            </span>
            <span className="text-[64px] leading-none">⚒️</span>
            <span className="mt-3 text-[18px] font-extrabold text-[#3A2A1C]">
              Workshop
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#9A7C55]">
              Forge
            </span>
            <span className="absolute bottom-3 text-[10px] text-[#9A7C55] group-hover:text-[#6B4F2A] transition-colors">
              Build skills →
            </span>
          </Link>

          {/* Arrow — big, central */}
          <div className="flex flex-col items-center">
            <span className="text-[40px] text-[#9A7C55] leading-none">→</span>
          </div>

          {/* Install Skill tile — soft terracotta, current step */}
          <div
            className="relative flex flex-col items-center justify-center w-[200px] h-[200px] rounded-[24px]"
            style={{
              backgroundColor: "#FBE8E3",
              border: "2px solid #E89080",
              boxShadow: "0 6px 20px rgba(201,74,46,0.18)",
            }}
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-[10px] font-black shadow-md whitespace-nowrap"
              style={{ backgroundColor: "#C8301E" }}
            >
              STEP 2 · YOU ARE HERE
            </span>
            <span className="text-[64px] leading-none">📥</span>
            <span className="mt-3 text-[18px] font-extrabold" style={{ color: "#8F1D12" }}>
              Install Skill
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.2em]" style={{ color: "#C8301E" }}>
              Install
            </span>
          </div>
        </div>

        {/* ══ MESSAGE + CTA — centered, consistent axis with tiles ══ */}
        <div className="flex flex-col items-center text-center gap-8 max-w-[560px] mx-auto">
          <div>
            <h1 className="text-[20px] lg:text-[22px] font-extrabold text-[#3A2A1C] leading-tight">
              Install your Workshop build into an AI assistant
            </h1>
            <p className="mt-1.5 text-[12px] text-[#9A7C55]">
              Make one now — 200 free credits included.
            </p>
          </div>
          <button
            onClick={() => setShowRegister(true)}
            className="px-6 py-3 rounded-full bg-[#C8301E] text-white text-[14px] font-extrabold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
          >
            + New AI assistant
          </button>
        </div>

        {showRegister && (
          <RegisterAgentModal
            onClose={() => setShowRegister(false)}
            onSuccess={async () => {
              setShowRegister(false)
              await load()
            }}
          />
        )}
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {/* ── 페이지 헤더: 타이틀 + flow nav ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[20px] lg:text-[22px] font-extrabold text-[#3A2A1C]">
            Install Skill
          </h1>
          <p className="mt-1 text-[12px] text-[#6B4F2A]">
            Install your Workshop build into an AI assistant.
          </p>
        </div>
        <StartFlowNav current="install" />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          메인 그리드 — 좌 2/3 순차 가이드 (manual), 우 1/3 Install(CTA+로그)
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-3 gap-5 items-start">

      {/* ── LEFT 2/3: 순차 가이드 + Live Proof ── */}
      <div className="lg:col-span-2 space-y-5">

      {/* Step 1: Claude Code 설치 안내 — 들여쓰기/두께를 Step 2 와 동일하게 */}
      <div
        className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#3A2A1C]">
              Step 1 · Install Claude Code
            </h3>
            <p className="text-[12px] text-[#9A7C55] mt-0.5">
              Get it free from Anthropic.
            </p>
          </div>
          <a
            href="https://claude.ai/download"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[12px] font-bold hover:bg-[#6B4F2A] transition-colors flex-shrink-0"
          >
            Install guide →
          </a>
        </div>
      </div>

      {showRegister && (
        <RegisterAgentModal
          onClose={() => setShowRegister(false)}
          onSuccess={async () => {
            setShowRegister(false)
            await load()
          }}
        />
      )}

      {selected && (
        <>
          {/* ── Step 3: Claude Code 연결 가이드 (MCP add) ── */}
          <div
            className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
            style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-[15px] font-bold text-[#3A2A1C]">Step 2 · Connect your AI assistant</h3>
                <p className="text-[12px] text-[#9A7C55] mt-0.5">
                  Hook <span className="font-bold text-[#3A2A1C]">{selected.name}</span> up to Claude Code.
                </p>
              </div>
              <div className="inline-flex p-0.5 rounded-full bg-[#F5E4C2]/40 border border-[#E9D1A6]">
                {(["mac", "win"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setOs(k)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${
                      os === k
                        ? "bg-white text-[#3A2A1C] shadow-sm"
                        : "text-[#9A7C55] hover:text-[#6B4F2A]"
                    }`}
                  >
                    {k === "mac" ? "Mac / Linux" : "Windows"}
                  </button>
                ))}
              </div>
            </div>

            <ol className="space-y-2 mb-4">
              {[
                "Copy the command",
                "Paste into your terminal",
                "Hit Enter — MCP registered",
                <>
                  Run{" "}
                  <code className="px-1.5 py-0.5 rounded bg-[#FBF6ED] font-mono text-[12px] text-[#3A2A1C]" style={{ border: "1px solid #E9D1A6" }}>
                    claude
                  </code>{" "}
                  to launch your AI assistant
                </>,
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3 text-[13px] text-[#6B4F2A]">
                  <span className="w-6 h-6 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[11px] font-black flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="relative">
              <pre
                className="rounded-xl bg-[#FBF6ED] p-4 pr-14 text-[11px] leading-relaxed font-mono text-[#3A2A1C] overflow-x-auto break-all whitespace-pre-wrap"
                style={{ border: "1px solid #E9D1A6" }}
              >
                {cmd}
              </pre>
              <button
                onClick={() => copyText(cmd, "cmd")}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white border border-[#E9D1A6] text-[10px] font-bold text-[#6B4F2A] hover:bg-[#F5E4C2]/60 transition-colors"
              >
                {copied === "cmd" ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>

            {/* Post-command action — verify MCP is live */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button
                onClick={checkConnection}
                disabled={checkState === "checking"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-bold transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-wait"
                style={{
                  backgroundColor:
                    checkState === "ok"
                      ? "#EFF7F3"
                      : checkState === "fail"
                        ? "#FBE8E3"
                        : "#FDFBF5",
                  borderColor:
                    checkState === "ok"
                      ? "#B8D8C4"
                      : checkState === "fail"
                        ? "#F2C7BE"
                        : "#E9D1A6",
                  color:
                    checkState === "ok"
                      ? "#2D7A5E"
                      : checkState === "fail"
                        ? "#C8301E"
                        : "#6B4F2A",
                }}
              >
                <span>
                  {checkState === "checking"
                    ? "⌛"
                    : checkState === "ok"
                      ? "✓"
                      : checkState === "fail"
                        ? "✗"
                        : "🔌"}
                </span>
                {checkState === "checking"
                  ? "Checking…"
                  : checkState === "ok"
                    ? "Connected"
                    : checkState === "fail"
                      ? "Retry check"
                      : "Check connection"}
              </button>
              {checkMessage && (
                <span
                  className="text-[11px]"
                  style={{ color: checkState === "ok" ? "#2D7A5E" : "#C8301E" }}
                >
                  {checkMessage}
                </span>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-[#E9D1A6]">
              <details className="text-[12px]">
                <summary className="cursor-pointer text-[#9A7C55] hover:text-[#6B4F2A] font-semibold">
                  How to disconnect
                </summary>
                <div className="relative mt-2">
                  <pre
                    className="rounded-lg bg-[#FBF6ED] p-3 pr-14 text-[11px] font-mono text-[#3A2A1C]"
                    style={{ border: "1px solid #E9D1A6" }}
                  >
                    {removeCmd}
                  </pre>
                  <button
                    onClick={() => copyText(removeCmd, "remove")}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white border border-[#E9D1A6] text-[10px] font-bold text-[#6B4F2A] hover:bg-[#F5E4C2]/60 transition-colors"
                  >
                    {copied === "remove" ? "✓" : "📋"}
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* ── Step 4: Live Proof — 에이전트 자가 보고 채널 ── */}
          <LiveProofCard
            agentName={selected.name}
            liveReport={liveReport}
          />
        </>
      )}

      </div>{/* END LEFT 2/3 — manual */}

      {/* ── RIGHT 1/3: My AIs + Install Skill + Install Log (sticky) ── */}
      <div className="lg:sticky lg:top-16 space-y-4 lg:col-span-1">
        {/* 내 AI assistant — 간략 칩 (선택 + 신규) */}
        <div
          className="rounded-[16px] bg-[#FDFBF5] p-3 lg:p-4"
          style={{ border: "1px solid #E9D1A6" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55] mr-1 w-full mb-1">
              My AI assistants
            </span>
            {agents.map((a) => {
              const isSelected = a.id === selectedId
              return (
                <span
                  key={a.id}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 pr-1 rounded-full text-[12px] transition-colors group ${
                    isSelected
                      ? "bg-[#3A2A1C] text-[#FDFBF5] font-bold"
                      : "bg-white border border-[#F0E7D4] text-[#6B4F2A] hover:bg-[#FBF6ED]"
                  }`}
                  title={`${a.name} · ${a.credits ?? 200}cr`}
                >
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="text-[13px] leading-none">{a.icon ?? "🤖"}</span>
                    <span className="truncate max-w-[80px]">{a.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(a.id)
                    }}
                    aria-label={`Delete ${a.name}`}
                    title="Remove this agent"
                    className={`ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] leading-none cursor-pointer transition-colors ${
                      isSelected
                        ? "text-[#FDFBF5]/70 hover:bg-white/15 hover:text-[#FDFBF5]"
                        : "text-[#9A7C55] hover:bg-[#FBE8E3] hover:text-[#C8301E]"
                    }`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <button
              onClick={() => setShowRegister(true)}
              className="px-2.5 py-1 rounded-full border border-dashed border-[#E9D1A6] text-[11px] font-bold text-[#C8301E] hover:bg-[#FBE8E3]/50"
            >
              + New
            </button>
          </div>
        </div>

        {selected ? (
          <>
            <InstallSkillSection
              agent={selected}
              installing={installing}
              onStart={() => {
                setInstalling(true)
                setInstallError(null)
              }}
              onComplete={(resp) => {
                setInstallResult(resp)
                setInstalling(false)
              }}
              onError={(err) => {
                setInstallError(err)
                setInstalling(false)
              }}
              onLiveReport={(r) => setLiveReport(r)}
            />
            <InstallResultPanel
              agentName={selected.name}
              lastResult={installResult}
              running={installing}
              error={installError}
            />
          </>
        ) : (
          <div
            className="rounded-[20px] p-5 text-center"
            style={{ backgroundColor: "#FBF6ED", border: "1px dashed #E9D1A6" }}
          >
            <p className="text-[12px] text-[#9A7C55] italic">
              Select an AI assistant on the left to see Install Skill here.
            </p>
          </div>
        )}
      </div>{/* END RIGHT 1/3 — install */}
      </div>{/* END main grid */}

      {/* Delete confirm — small modal over the page */}
      {deleteConfirmId && (() => {
        const a = agents.find((x) => x.id === deleteConfirmId)
        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => !deleting && setDeleteConfirmId(null)}
          >
            <div className="absolute inset-0 bg-[#3A2A1C]/40 backdrop-blur-sm" />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[360px] rounded-2xl bg-[#FDFBF5] p-5 shadow-2xl"
              style={{ border: "1px solid #E9D1A6" }}
            >
              <h3 className="text-[14px] font-extrabold text-[#3A2A1C]">
                Remove {a?.name ?? "this agent"}?
              </h3>
              <p className="mt-2 text-[11px] text-[#6B4F2A] leading-relaxed">
                The registration and its API key are deleted. Any Claude Code
                that still uses this key will stop connecting. This cannot be
                undone.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => !deleting && setDeleteConfirmId(null)}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-md bg-white border text-[12px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer disabled:opacity-50"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-md text-white text-[12px] font-extrabold cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#C8301E" }}
                >
                  {deleting ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════
   InstallSkillSection — pick a Workshop build (A/B/C), toggle its Shop
   listing, and install it to this AI assistant. Reads/writes Workshop
   state + per-agent install record in localStorage.
   ════════════════════════════════════════════════════════════════ */

function InstallSkillSection({
  agent,
  installing,
  onStart,
  onComplete,
  onError,
  onLiveReport,
}: {
  agent: Agent
  installing: boolean
  onStart: () => void
  onComplete: (r: InstallBuildResponse) => void
  onError: (msg: string) => void
  onLiveReport: (r: {
    items: Array<{ dir: string; hasSkillMd: boolean; sizeBytes: number; mtime: string | null }>
    receivedAt: string
  }) => void
}) {
  const [workshop, setWorkshop] = useState<WorkshopState | null>(null)
  const [selectedBuildId, setSelectedBuildId] = useState<string>("")
  const [justInstalled, setJustInstalled] = useState(false)
  /** Agent 가 실제로 보고한 설치 상태. `null` = 미확인, `true` = cherry-build-meta
   *  dir 존재(= 어떤 빌드인가 설치됨), `false` = 없음. 어떤 빌드인지는 메타
   *  SKILL.md body 파싱이 필요하므로 이번 스코프에선 존재 여부만 확인. */
  const [agentHasInstall, setAgentHasInstall] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [showFlockxExport, setShowFlockxExport] = useState(false)
  const [showAgentverseExport, setShowAgentverseExport] = useState(false)
  const [showFlockBundle, setShowFlockBundle] = useState(false)
  /** Claude Code 에서 사용자가 `cherry-kaas:generate_self_report` 등을 돌렸을 때
   *  WebSocket 으로 푸시된 실시간 report. 서버 HTTP 조회와 별개의 증거. */
  const [liveReport, setLiveReport] = useState<{
    items: Array<{ dir: string; hasSkillMd: boolean; sizeBytes: number; mtime: string | null }>
    receivedAt: string
  } | null>(null)

  // Workshop builds 는 localStorage 에서 읽되, "설치됨" 판단은 에이전트 self-report 로만.
  useEffect(() => {
    const ws = readWorkshop()
    setWorkshop(ws)
    setSelectedBuildId(ws?.activeBuildId ?? ws?.builds?.[0]?.id ?? "")
  }, [agent.id])

  // Agent 에 이미 설치된 게 있는지 self-report 로 확인 (HTTP).
  useEffect(() => {
    let cancelled = false
    async function verify() {
      setVerifying(true)
      try {
        const r: { ok?: boolean; report?: { local_skills?: { items?: Array<{ dir: string }> } } } =
          await fetchAgentSelfReport(agent.id)
        if (cancelled) return
        const items = r?.report?.local_skills?.items ?? []
        const hasMeta = items.some((i) => i?.dir === "cherry-build-meta")
        setAgentHasInstall(hasMeta)
      } catch {
        if (!cancelled) setAgentHasInstall(null) // 확인 불가 (agent offline 등)
      } finally {
        if (!cancelled) setVerifying(false)
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [agent.id])

  /* ══════════════════════════════════════════════════════════════
     WebSocket 구독 — Claude Code 에서 사용자가 `generate_self_report`
     MCP 도구를 호출하면 에이전트가 `submit_self_report` 로 전송하고
     서버가 `agent_report_pushed` 로 브로드캐스트. 여기서 받아서
     "에이전트가 자발적으로 보내온 증거" 로 panel 에 표시.
     참고: kaas-console.tsx:721 의 동일한 패턴 재사용.
     ══════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!agent?.id || !agent?.api_key) {
      console.log("[InstallSkill WS] no api_key, skipping socket subscribe", {
        agentId: agent?.id,
        hasKey: !!agent?.api_key,
      })
      return
    }
    let cancelled = false
    let socketInstance: any = null
    ;(async () => {
      try {
        const { io } = await import("socket.io-client")
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
        console.log("[InstallSkill WS] connecting to", `${base}/kaas`, "agent=", agent.id.slice(0, 8))
        socketInstance = io(`${base}/kaas`, {
          auth: { api_key: agent.api_key, role: "user" },
          transports: ["polling", "websocket"],
          reconnection: true,
        })
        socketInstance.on("connect", () => {
          console.log("[InstallSkill WS] ✓ connected, socket=", socketInstance.id)
        })
        socketInstance.on("disconnect", (reason: string) => {
          console.log("[InstallSkill WS] ✗ disconnected, reason=", reason)
        })
        socketInstance.on("connect_error", (err: any) => {
          console.warn("[InstallSkill WS] connect_error:", err?.message ?? err)
        })
        socketInstance.on("agent_report_pushed", (evt: any) => {
          console.log("[InstallSkill WS] 📥 agent_report_pushed", {
            evtAgent: evt?.agentId,
            myAgent: agent.id,
            match: evt?.agentId === agent.id,
            triggered_by: evt?.report?.triggered_by,
            skillsCount: evt?.report?.local_skills?.items?.length,
          })
          if (cancelled) return
          if (evt?.agentId !== agent.id) return
          const items = evt?.report?.local_skills?.items ?? []
          const payload = { items, receivedAt: new Date().toISOString() }
          setLiveReport(payload)
          onLiveReport(payload)
          const hasMeta = items.some((i: any) => i?.dir === "cherry-build-meta")
          setAgentHasInstall(hasMeta)
        })
      } catch (err) {
        console.warn("[InstallSkill WS] setup failed:", err)
      }
    })()
    return () => {
      cancelled = true
      try { socketInstance?.disconnect() } catch { /* ignore */ }
    }
  }, [agent?.id, agent?.api_key])

  if (!workshop || workshop.builds.length === 0) {
    return (
      <div
        className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
      >
        <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">Install Skill</h3>
        <p className="mt-1.5 text-[12px] text-[#9A7C55]">
          No Workshop builds found yet.
        </p>
        <Link
          href="/start/workshop"
          className="mt-3 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[12px] font-bold hover:bg-[#6B4F2A] transition-colors"
        >
          Go to Workshop →
        </Link>
      </div>
    )
  }

  // 선택된 빌드의 장착 슬롯 수 — 빈 빌드 선제 가드용
  const selectedBuild = workshop.builds.find((b) => b.id === selectedBuildId)
  const selectedEquippedCount = selectedBuild
    ? Object.values(selectedBuild.equipped).filter(Boolean).length
    : 0
  // 설치 가능 여부 — 빌드 선택 + 슬롯 ≥ 1 + 진행 중 아님
  const canInstall = selectedBuildId !== "" && selectedEquippedCount > 0 && !installing

  function togglePublish(buildId: string) {
    if (!workshop) return
    const next: WorkshopState = {
      ...workshop,
      builds: workshop.builds.map((b) =>
        b.id === buildId ? { ...b, isListedOnMarket: !b.isListedOnMarket } : b,
      ),
    }
    writeWorkshop(next)
    setWorkshop(next)
  }

  async function install() {
    if (!selectedBuildId || !workshop) return
    const selectedBuild = workshop.builds.find((b) => b.id === selectedBuildId)
    if (!selectedBuild) return

    const equipped = {
      prompt: selectedBuild.equipped.prompt ?? null,
      mcp: selectedBuild.equipped.mcp ?? null,
      skillA: selectedBuild.equipped.skillA ?? null,
      skillB: selectedBuild.equipped.skillB ?? null,
      skillC: selectedBuild.equipped.skillC ?? null,
      orchestration: selectedBuild.equipped.orchestration ?? null,
      memory: selectedBuild.equipped.memory ?? null,
    }
    const nonEmpty = Object.values(equipped).filter(Boolean).length
    console.log("[InstallSkill] install() sending", {
      buildId: selectedBuild.id,
      buildName: selectedBuild.name,
      equipped,
      nonEmpty,
    })

    // Client-side guard — block empty builds before the server round-trip.
    if (nonEmpty === 0) {
      onError(
        `"${selectedBuild.name}" is empty. Equip cards in the Workshop tab and try again. (Also verify the Workshop state was saved.)`,
      )
      return
    }

    onStart()
    try {
      const resp = await installBuild(agent.id, {
        build_id: selectedBuild.id,
        build_name: selectedBuild.name,
        equipped,
      })
      // 설치 성공 판정은 에이전트 응답의 local_skills_after 기반.
      // cherry-build-meta 가 포함되어 있어야 진짜 설치된 것.
      const metaOnAgent = resp.local_skills_after.some(
        (i) => i?.dir === "cherry-build-meta",
      )
      if (metaOnAgent) {
        setAgentHasInstall(true)
        setJustInstalled(true)
        setTimeout(() => setJustInstalled(false), 2500)
      } else {
        // 응답은 왔지만 에이전트 쪽에 흔적이 없음 → 실패 취급
        setAgentHasInstall(false)
      }
      onComplete(resp)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
      style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">Install Skill</h3>
          <p className="text-[12px] text-[#9A7C55] mt-0.5">
            Pick a Workshop build and push it to{" "}
            <span className="font-bold text-[#3A2A1C]">{agent.name}</span>.
          </p>
        </div>
        <Link
          href="/start/workshop"
          className="text-[11px] font-semibold text-[#9A7C55] hover:text-[#6B4F2A]"
        >
          Edit in Workshop →
        </Link>
      </div>

      {/* 좁은 좌측 컬럼이라 세로 스택 기본. 와이드 뷰에선 1열 유지 (왼쪽 1/3 sticky). */}
      <div className="flex flex-col gap-3">
        {workshop.builds.map((b) => (
          <BuildOptionCard
            key={b.id}
            build={b}
            inventory={workshop.inventory}
            selected={selectedBuildId === b.id}
            onSelect={() => setSelectedBuildId(b.id)}
            onTogglePublish={() => togglePublish(b.id)}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={install}
          disabled={!canInstall}
          title={
            selectedEquippedCount === 0
              ? "This build has no equipped cards. Equip cards in Workshop first."
              : undefined
          }
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-[13px] font-extrabold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ backgroundColor: "#C8301E" }}
        >
          {installing
            ? "⌛ Installing…"
            : selectedEquippedCount === 0
              ? "Empty build — can't install"
              : `📥 Install to ${agent.name} (${selectedEquippedCount} slot${selectedEquippedCount === 1 ? "" : "s"})`}
        </button>

        <button
          onClick={() => setShowAgentverseExport(true)}
          disabled={!selectedBuild || selectedEquippedCount === 0 || installing}
          title={
            selectedEquippedCount === 0
              ? "This build has no equipped cards."
              : "Publish this build to Agentverse marketplace"
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border text-[12px] font-bold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "#E89080" }}
        >
          🚀 Export to Agentverse
        </button>

        <button
          onClick={() => setShowFlockBundle(true)}
          disabled={!selectedBuild || selectedEquippedCount === 0 || installing}
          title={
            selectedEquippedCount === 0
              ? "This build has no equipped cards."
              : "Generate FLock.io upload bundle"
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border text-[12px] font-bold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "#E89080" }}
        >
          🪶 Publish to FLock Marketplace
        </button>

        {/* Empty-build warning — explain why the button is disabled */}
        {selectedEquippedCount === 0 && !installing && (
          <span className="text-[11px] text-[#C8301E] font-semibold">
            "{selectedBuild?.name ?? ""}" is empty.{" "}
            <Link href="/start/workshop" className="underline hover:text-[#8F1D12]">
              Go to Workshop →
            </Link>
          </span>
        )}

        {/* 설치 직후 피드백 — 응답 기반, localStorage 아님 */}
        {justInstalled && !installing && (
          <span className="text-[11px] font-bold" style={{ color: "#2D7A5E" }}>
            ✓ Agent confirmed install. Restart `claude` to load the new build.
          </span>
        )}

        {/* 에이전트 현재 상태 — self-report 가 source of truth */}
        {selectedEquippedCount > 0 && !installing && !justInstalled && (
          <span className="text-[11px] text-[#9A7C55]">
            {verifying
              ? "⌛ Checking agent state…"
              : agentHasInstall === true
                ? "🤖 Agent already has a Cherry build installed."
                : agentHasInstall === false
                  ? "🤖 Agent has no Cherry build yet."
                  : "🤖 Agent state unknown (offline?)."}
          </span>
        )}
      </div>

      <ExportFlockBundleModal
        open={showFlockBundle}
        onClose={() => setShowFlockBundle(false)}
        build={
          selectedBuild
            ? {
                id: selectedBuild.id,
                name: selectedBuild.name,
                equipped: {
                  prompt: selectedBuild.equipped.prompt ?? null,
                  mcp: selectedBuild.equipped.mcp ?? null,
                  skillA: selectedBuild.equipped.skillA ?? null,
                  skillB: selectedBuild.equipped.skillB ?? null,
                  skillC: selectedBuild.equipped.skillC ?? null,
                  orchestration: selectedBuild.equipped.orchestration ?? null,
                  memory: selectedBuild.equipped.memory ?? null,
                },
              }
            : null
        }
      />

      <ExportAgentverseModal
        open={showAgentverseExport}
        onClose={() => setShowAgentverseExport(false)}
        build={
          selectedBuild
            ? {
                id: selectedBuild.id,
                name: selectedBuild.name,
                equipped: {
                  prompt: selectedBuild.equipped.prompt ?? null,
                  mcp: selectedBuild.equipped.mcp ?? null,
                  skillA: selectedBuild.equipped.skillA ?? null,
                  skillB: selectedBuild.equipped.skillB ?? null,
                  skillC: selectedBuild.equipped.skillC ?? null,
                  orchestration: selectedBuild.equipped.orchestration ?? null,
                  memory: selectedBuild.equipped.memory ?? null,
                },
              }
            : null
        }
      />

      <ExportFlockxModal
        open={showFlockxExport}
        onClose={() => setShowFlockxExport(false)}
        build={
          selectedBuild
            ? {
                id: selectedBuild.id,
                name: selectedBuild.name,
                equipped: {
                  prompt: selectedBuild.equipped.prompt ?? null,
                  mcp: selectedBuild.equipped.mcp ?? null,
                  skillA: selectedBuild.equipped.skillA ?? null,
                  skillB: selectedBuild.equipped.skillB ?? null,
                  skillC: selectedBuild.equipped.skillC ?? null,
                  orchestration: selectedBuild.equipped.orchestration ?? null,
                  memory: selectedBuild.equipped.memory ?? null,
                },
              }
            : null
        }
      />
    </div>
  )
}

function BuildOptionCard({
  build,
  inventory,
  selected,
  onSelect,
  onTogglePublish,
}: {
  build: AgentBuild
  inventory: InventoryItem[]
  selected: boolean
  onSelect: () => void
  onTogglePublish: () => void
}) {
  const equippedCount = Object.values(build.equipped).filter(Boolean).length
  const promptTitle = build.equipped.prompt
    ? inventory.find((i) => i.id === build.equipped.prompt)?.title ?? null
    : null
  const slotOrder: SlotKey[] = [
    "prompt",
    "mcp",
    "skillA",
    "skillB",
    "skillC",
    "orchestration",
    "memory",
  ]
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-[14px] p-4 cursor-pointer transition-colors ${
        selected
          ? "bg-[#FDFBF5] border-2"
          : "bg-white border hover:bg-[#FBF6ED]"
      }`}
      style={{
        borderColor: selected ? "#C8301E" : "#F0E7D4",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
          style={{ borderColor: selected ? "#C8301E" : "#C9B88A" }}
        >
          {selected && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#C8301E" }}
            />
          )}
        </span>
        <span className="text-[14px] font-extrabold text-[#3A2A1C] flex-shrink-0">
          {build.name}
        </span>
        {promptTitle && (
          <span
            className="text-[11px] font-semibold text-[#6B4F2A] truncate min-w-0"
            title={promptTitle}
          >
            · {promptTitle}
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-[#9A7C55] flex-shrink-0">
          {equippedCount}/7
        </span>
      </div>

      {/* Slot dots — one per equipped slot */}
      <div className="flex items-center gap-1 mb-3">
        {slotOrder.map((k) => (
          <span
            key={k}
            title={SLOT_META[k].label}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: build.equipped[k] ? "#3A2A1C" : "#E9D1A6",
            }}
          />
        ))}
      </div>

      {/* Publish to Shop toggle */}
      <label
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 cursor-pointer select-none"
      >
        <button
          onClick={onTogglePublish}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
            build.isListedOnMarket ? "bg-[#2A5C3E]" : "bg-gray-300"
          }`}
          type="button"
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              build.isListedOnMarket ? "translate-x-[14px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-[11px] font-semibold text-[#6B4F2A]">
          List on Shop
        </span>
      </label>
    </div>
  )
}

function KarmaStars({ tier }: { tier: string }) {
  const stars = tier === "Platinum" ? 4 : tier === "Gold" ? 3 : tier === "Silver" ? 2 : 1
  return (
    <span className="text-[11px] leading-none" style={{ color: "#C9A24A" }}>
      {Array.from({ length: stars }).map((_, i) => <span key={i}>★</span>)}
      {Array.from({ length: 4 - stars }).map((_, i) => <span key={`e-${i}`} style={{ color: "#E9D1A6" }}>★</span>)}
    </span>
  )
}

/* ══════════ 새 AI assistant 등록 모달 ══════════ */
function RegisterAgentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const [name, setName] = useState("")
  const [walletType, setWalletType] = useState<WalletType>("evm")
  const [walletAddress, setWalletAddress] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (walletType !== "near") return
    let cancelled = false
    ;(async () => {
      try {
        const { getConnectedNearAccount } = await import("@/lib/near-connector")
        const acct = await getConnectedNearAccount()
        if (!cancelled && acct) setWalletAddress(acct)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walletType])

  async function connectMetaMask() {
    setError("")
    setConnecting(true)
    try {
      const eth = (window as any).ethereum
      if (!eth) {
        setError("MetaMask isn't installed. Please install it first.")
        return
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      if (accounts?.[0]) setWalletAddress(accounts[0])
    } catch {
      setError("MetaMask connection failed.")
    } finally {
      setConnecting(false)
    }
  }

  async function connectNear() {
    setError("")
    setConnecting(true)
    try {
      const { connectNearWallet } = await import("@/lib/near-connector")
      const id = await connectNearWallet()
      setWalletAddress(id)
    } catch (e: any) {
      setError(`NEAR wallet connection failed: ${e?.message ?? e}`)
    } finally {
      setConnecting(false)
    }
  }

  async function changeWallet() {
    if (walletType === "near") {
      try {
        const { disconnectNearWallet } = await import("@/lib/near-connector")
        await disconnectNearWallet()
      } catch {
        /* ignore */
      }
    }
    setWalletAddress("")
    setError("")
  }

  async function handleRegister() {
    if (!name.trim() || !walletAddress) return
    setRegistering(true)
    setError("")
    try {
      await registerAgent({
        name: name.trim(),
        wallet_address: walletAddress,
        wallet_type: walletType,
        domain_interests: [],
      })
      await onSuccess()
    } catch (e: any) {
      setError(e?.message || "Registration failed.")
    } finally {
      setRegistering(false)
    }
  }

  const canRegister = name.trim().length > 0 && walletAddress.length > 0 && !registering

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(58,42,28,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[24px] bg-[#FDFBF5] p-6 lg:p-7 relative"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 20px 50px rgba(107,79,42,0.25)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#9A7C55] hover:bg-[#FBE8E3] hover:text-[#C8301E] transition-colors"
        >
          ×
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <CherryBao size={72} animate />
          <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">Create a new AI assistant</h2>
          <p className="mt-1 text-[12px] text-[#9A7C55]">
            A name and a wallet. That's all it takes.
          </p>
        </div>

        {/* 1. Name */}
        <label className="block mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            1. Name your AI assistant
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crypto Watcher · Auction Sniper"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-[#FBF6ED] text-[14px] text-[#3A2A1C] placeholder:text-[#C9B88A] outline-none focus:bg-white focus:ring-2 focus:ring-[#C8301E]/30 transition"
            style={{ border: "1px solid #E9D1A6" }}
          />
        </label>

        {/* 2. Wallet */}
        <div className="mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            2. Connect your wallet
          </span>
          <p className="text-[11px] text-[#9A7C55] mt-0.5 mb-2">
            Credit top-ups, withdrawals, and usage logs are recorded here.
          </p>

          <div className="inline-flex p-0.5 rounded-full bg-[#F5E4C2]/40 mb-3" style={{ border: "1px solid #E9D1A6" }}>
            {(["evm", "near"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setWalletType(t)
                  setWalletAddress("")
                  setError("")
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${
                  walletType === t
                    ? "bg-white text-[#3A2A1C] shadow-sm"
                    : "text-[#9A7C55] hover:text-[#6B4F2A]"
                }`}
              >
                {t === "evm" ? "🦊 MetaMask" : "🪐 NEAR"}
              </button>
            ))}
          </div>

          {walletAddress ? (
            <div className="rounded-xl bg-[#EFF7F3] p-3 flex items-center gap-2" style={{ border: "1px solid #B8D8C4" }}>
              <span className="w-2 h-2 rounded-full bg-[#2D7A5E] flex-shrink-0" />
              <span className="text-[12px] font-mono text-[#2D7A5E] truncate flex-1">
                {walletAddress}
              </span>
              <button
                onClick={changeWallet}
                className="text-[10px] font-bold text-[#6B4F2A] hover:underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={walletType === "evm" ? connectMetaMask : connectNear}
              disabled={connecting}
              className="w-full rounded-xl bg-[#3A2A1C] text-[#FDFBF5] py-3 text-[13px] font-extrabold hover:bg-[#6B4F2A] disabled:opacity-60 transition-colors"
            >
              {connecting
                ? "Connecting…"
                : walletType === "evm"
                ? "🦊 Connect MetaMask"
                : "🪐 Connect NEAR"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-[#FBE8E3] px-3 py-2 text-[12px] text-[#C8301E]" style={{ border: "1px solid #F2C7BE" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={!canRegister}
          className="w-full rounded-full bg-[#C8301E] text-white py-3 text-[14px] font-extrabold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all"
        >
          {registering ? "Creating…" : "✨ Create AI assistant"}
        </button>

        <p className="mt-3 text-center text-[11px] text-[#9A7C55]">
          You get 200 free credits the moment you register.
        </p>
      </div>
    </div>
  )
}

function ConnectionDot({ id }: { id?: string }) {
  const connected = Boolean(id)
  return (
    <div className="flex items-center gap-1 justify-end mt-0.5 text-[9px] font-semibold text-[#9A7C55]">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: connected ? "#2D7A5E" : "#9A7C55" }}
      />
      {connected ? "Ready" : "Not connected"}
    </div>
  )
}

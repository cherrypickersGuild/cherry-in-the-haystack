"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Coins, ExternalLink, Shield, Wallet, ArrowUpRight, ArrowDownRight,
  Copy, Check, Globe, UserPlus, Plus, X, Key,
} from "lucide-react"
import { KnowledgeCurationPanel } from "./kaas-admin-page"
import { TemplateEditorBody } from "@/app/template/edit/page"

/* ═══════════════════════════════════════════════
   Privacy Mode Toggle (NEAR AI TEE)
   — localStorage 기반, window 이벤트로 크로스-컴포넌트 동기화
═══════════════════════════════════════════════ */
const PRIVACY_MODE_KEY = "kaas-privacy-mode"
const PRIVACY_MODE_EVENT = "kaas-privacy-mode-changed"

export function getPrivacyMode(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(PRIVACY_MODE_KEY) === "true"
}

function setPrivacyMode(value: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PRIVACY_MODE_KEY, value ? "true" : "false")
  window.dispatchEvent(new CustomEvent(PRIVACY_MODE_EVENT, { detail: value }))
}

/* ═══════════════════════════════════════════════
   Chain Selector (Status / NEAR)
   — 구매/팔로우 시 어느 체인에 on-chain 기록할지 결정
═══════════════════════════════════════════════ */
const CHAIN_KEY = "kaas-selected-chain"
const CHAIN_EVENT = "kaas-selected-chain-changed"
export type SelectedChain = "status" | "near"

export function getSelectedChain(): SelectedChain {
  if (typeof window === "undefined") return "status"
  return (window.localStorage.getItem(CHAIN_KEY) as SelectedChain) || "status"
}

function setSelectedChain(value: SelectedChain) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CHAIN_KEY, value)
  window.dispatchEvent(new CustomEvent(CHAIN_EVENT, { detail: value }))
}

/**
 * ChainBadge — 읽기 전용 상태 표시
 * 에이전트 walletType에서 결정된 payment chain을 그대로 보여준다.
 * walletType 변경 시 localStorage(selectedChain)도 자동 동기화하여
 * catalog/console(CHAIN_EVENT 구독자)이 연쇄 반영되도록 한다.
 * 교차 선택을 원천 차단 — MetaMask → Status, NEAR → NEAR 고정.
 */
function ChainBadge({ walletType }: { walletType: "evm" | "near" }) {
  useEffect(() => {
    const next: SelectedChain = walletType === "near" ? "near" : "status"
    if (getSelectedChain() !== next) setSelectedChain(next)
  }, [walletType])

  const isNear = walletType === "near"
  return (
    <div
      title={isNear ? "NEAR Protocol Testnet — L1" : "Status Network Sepolia — gasless L2"}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold leading-tight flex-shrink-0",
        isNear
          ? "bg-[#F3EFFA] text-[#5B3D87] border-[#7B5EA7]/30"
          : "bg-[#EFF7F3] text-[#2D7A5E] border-[#2D7A5E]/30",
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isNear ? "bg-[#7B5EA7]" : "bg-[#2D7A5E]")} />
      <span className="flex flex-col items-start">
        <span>{isNear ? "NEAR Protocol" : "Status Network"}</span>
        <span className="text-[9px] font-medium opacity-70">{isNear ? "L1 Testnet" : "Gasless L2 (Sepolia)"}</span>
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Agent Self-Report (Git-style diff)
   — 에이전트가 자기 지식 상태를 점검해서 생성한 리포트
   — 터미널 스타일 output으로 "학습 증거" 명확히
═══════════════════════════════════════════════ */
/**
 * SelfReportLog — shared terminal-style self-report renderer.
 * Used both by the KnowledgeDiffModal (large) and by the floating agent console (small).
 * Size-in-chars is intentionally not displayed (it is often zero in the live report).
 */
export function SelfReportLog({
  data,
  agentId,
  agentName,
  generatedAt,
  source,
}: {
  data: any
  agentId: string
  agentName: string
  generatedAt: string
  source: "agent" | "none"
}) {
  const addedTopics = new Set<string>(
    (data?.timeline ?? []).filter((t: any) => t.action === "purchase").map((t: any) => t.conceptId),
  )
  const modifiedTopics = new Set<string>(
    (data?.timeline ?? []).filter((t: any) => t.action === "follow").map((t: any) => t.conceptId),
  )
  const allKnowledge: Array<{ topic: string; lastUpdated: string }> = data?.currentKnowledge ?? []
  const unchanged = allKnowledge.filter(
    (k) => !addedTopics.has(k.topic) && !modifiedTopics.has(k.topic),
  )
  const categoryOf = (id: string) => {
    if (["rag", "embeddings", "chain-of-thought"].includes(id)) return "basics"
    if (["multi-agent", "agent-architectures", "fine-tuning"].includes(id)) return "advanced"
    if (["evaluation", "prompt-engineering"].includes(id)) return "core"
    return "misc"
  }
  const fmtTime = (iso: string) => {
    if (!iso) return ""
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
  }
  const timelineByConcept = new Map<string, any>()
  ;(data?.timeline ?? []).forEach((t: any) => {
    if (!timelineByConcept.has(t.conceptId)) timelineByConcept.set(t.conceptId, t)
  })

  return (
    <>
      {/* Header — agent + generated + agent-signed badge */}
      <div className="text-[#7C8490] flex items-center gap-2 flex-wrap">
        <span className="text-[#A8B3C1]">📝 AGENT SELF-REPORT</span>
        {source === "agent" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#27C93F] text-black font-bold uppercase">
            ✓ agent-signed
          </span>
        )}
        <span className="text-[#C7A7FF] ml-auto">{agentName}</span>
        <span className="text-[#6B7280]">· {fmtTime(generatedAt)}</span>
      </div>

      {/* Added */}
      {addedTopics.size > 0 && (
        <div className="mt-3">
          <p className="text-[#27C93F]">+ ADDED ({addedTopics.size})</p>
          {[...addedTopics].map((topic) => {
            const t = timelineByConcept.get(topic)
            if (!t) return null
            return (
              <div key={topic} className="mt-1.5 pl-1">
                <p className="text-[#27C93F]">+ <span className="font-bold">{t.conceptTitle}</span></p>
                <div className="pl-4 text-[11px]">
                  <p><span className="text-[#6B7280]">★ </span>{t.qualityScore}<span className="text-[#6B7280]"> · {fmtTime(t.at)} · </span><span className="text-[#F59E6A]">{t.action}</span> ({t.creditsConsumed}cr)</p>
                  {t.onChainFailed ? (
                    <p className="text-[#FFBD2E]">⚠ on-chain failed</p>
                  ) : (
                    <p>
                      <span className={cn(t.chain === "status" || t.chain === "status-hoodi" ? "text-[#27C93F]" : "text-[#C7A7FF]")}>{t.chain}</span>
                      {" · "}
                      <a href={t.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B9CE8] underline break-all">
                        {t.txHash.slice(0, 12)}...{t.txHash.slice(-6)}
                      </a>
                    </p>
                  )}
                  {t.evidence?.length > 0 && t.evidence.map((e: any, ei: number) => (
                    <p key={ei} className="text-[10px]">
                      <span className="text-[#6B7280]">├─ </span>
                      <span className="text-[#C7A7FF]">{e.source}</span>
                      {e.curator && <span className="text-[#6B7280]"> ({e.curator}/{e.curatorTier})</span>}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modified */}
      {modifiedTopics.size > 0 && (
        <div className="mt-3">
          <p className="text-[#FFBD2E]">~ MODIFIED ({modifiedTopics.size})</p>
          {[...modifiedTopics].map((topic) => {
            const t = timelineByConcept.get(topic)
            if (!t) return null
            return (
              <div key={topic} className="mt-1 pl-1">
                <p className="text-[#FFBD2E]">~ <span className="font-bold">{t.conceptTitle}</span> <span className="text-[#6B7280]">(follow)</span></p>
                <p className="pl-4 text-[11px] text-[#6B7280]">{fmtTime(t.at)} · {t.creditsConsumed}cr
                  {!t.onChainFailed && t.explorerUrl && (
                    <> · <a href={t.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B9CE8] underline break-all">{t.txHash.slice(0, 12)}...</a></>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Unchanged */}
      {unchanged.length > 0 && (
        <div className="mt-3">
          <p className="text-[#6B7280]">= UNCHANGED ({unchanged.length})</p>
          {unchanged.map((k) => (
            <p key={k.topic} className="text-[#6B7280] pl-1">= {k.topic} <span className="text-[#4A5160]">({k.lastUpdated})</span></p>
          ))}
        </div>
      )}

      {/* Local Skills — stdio MCP가 스캔한 ~/.claude/skills/ 실제 파일 목록 */}
      <div className="mt-3">
        <p className="text-[#6B9CE8]">
          📁 LOCAL SKILLS ({data?.localSkills?.count ?? 0})
          <span className="text-[#6B7280] text-[10px] ml-2">@ {data?.localSkills?.base_dir ?? "~/.claude/skills"}</span>
        </p>
        {!data?.localSkills ? (
          <div className="pl-1 text-[11px] space-y-0.5">
            <p className="text-[#FFBD2E]">⚠ local_skills not in report</p>
            <p className="text-[#6B7280]">
              Skills are saved to <span className="text-[#D0D7E0]">~/.claude/skills/</span> only when you
              <span className="text-[#C7A7FF]"> purchase via Claude Code (stdio MCP)</span>.
            </p>
            <p className="text-[#6B7280]">
              Web UI purchases (Status Network / NEAR Gasless) don't touch your filesystem — no skill files to report.
            </p>
            <p className="text-[#6B7280]">
              If you <span className="text-[#D0D7E0]">did</span> use Claude Code and still see this, restart the stdio MCP server.
            </p>
          </div>
        ) : (!data.localSkills.items || data.localSkills.items.length === 0) ? (
          <p className="pl-1 text-[#6B7280] text-[11px]">(no skill directories found in ~/.claude/skills/)</p>
        ) : (
            data.localSkills.items.map((s: any) => {
              // dir 끝의 폴더명을 기술명으로 사용 (예: cherry-rag → cherry-rag)
              const folderName = (s.dir ?? "").split("/").filter(Boolean).pop() ?? "unknown"
              const sizeKb = (Number(s.sizeBytes ?? 0) / 1024).toFixed(1)
              const mtime = s.mtime ? fmtTime(s.mtime) : ""
              return (
                <div key={s.dir} className="mt-1 pl-1">
                  <p className="text-[#D0D7E0]">
                    <span className={s.hasSkillMd ? "text-[#27C93F]" : "text-[#FFBD2E]"}>
                      {s.hasSkillMd ? "✓" : "✗"}
                    </span>{" "}
                    <span className="font-bold text-[#C7A7FF]">{folderName}</span>
                  </p>
                  <p className="pl-4 text-[11px] text-[#7C8490]">
                    <span className="text-[#6B7280]">├─ dir:</span>{" "}
                    <span className="text-[#6B9CE8] break-all">{s.dir}</span>
                  </p>
                  <p className="pl-4 text-[11px] text-[#7C8490]">
                    <span className="text-[#6B7280]">├─ file:</span>{" "}
                    <span className={s.hasSkillMd ? "text-[#D0D7E0]" : "text-[#FFBD2E]"}>
                      SKILL.md
                    </span>
                    {s.hasSkillMd && (
                      <>
                        <span className="text-[#6B7280]"> · </span>
                        <span className="text-[#F59E6A]">{sizeKb} KB</span>
                      </>
                    )}
                  </p>
                  {mtime && (
                    <p className="pl-4 text-[11px] text-[#7C8490]">
                      <span className="text-[#6B7280]">└─ mtime:</span>{" "}
                      <span className="text-[#6B7280]">{mtime}</span>
                    </p>
                  )}
                </div>
              )
            })
          )}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-2 border-t border-[#2A2F3B] text-[#7C8490]">
        <span>total {allKnowledge.length} · </span>
        <span className="text-[#27C93F]">+{addedTopics.size}</span>
        <span> · spent </span>
        <span className="text-[#D4854A]">{data.summary?.totalSpent ?? 0}cr</span>
        {data?.localSkills && (
          <>
            <span> · </span>
            <span className="text-[#6B9CE8]">{data.localSkills.items?.filter((s: any) => s.hasSkillMd).length ?? 0} skills</span>
          </>
        )}
      </div>
    </>
  )
}

function KnowledgeDiffModal({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState("")
  const [generatedAt, setGeneratedAt] = useState<string>("")

  const [source, setSource] = useState<"agent" | "none">("none")

  const loadReport = () => {
    setData(null)
    setError("")
    setSource("none")
    // self-report(에이전트 프로세스 경유) 시도 — MCP 연결 필수
    import("@/lib/api").then(({ fetchAgentSelfReport }) =>
      fetchAgentSelfReport(agentId)
        .then((r: any) => {
          if (r.ok) {
            // 에이전트가 직접 보낸 리포트 → 모달 기존 포맷에 매핑
            const rpt = r.report
            setData({
              agentName: rpt.agent?.name ?? agentName,
              currentKnowledge: rpt.current_knowledge ?? [],
              timeline: (rpt.recent_events ?? []).map((e: any) => ({
                at: e.at,
                action: e.action,
                conceptId: e.conceptId,
                conceptTitle: e.conceptTitle,
                contentMd: "",
                contentSize: e.contentSize,
                contentPreview: e.contentPreview ?? "",
                evidence: e.evidence ?? [],
                qualityScore: e.qualityScore,
                creditsConsumed: e.creditsConsumed,
                chain: e.chain,
                txHash: e.txHash,
                explorerUrl: e.txHash
                  ? e.chain === "near" ? `https://testnet.nearblocks.io/txns/${e.txHash}`
                  : e.chain === "status-hoodi" ? `https://hoodiscan.status.network/tx/${e.txHash}`
                  : e.chain === "status" ? `https://sepoliascan.status.network/tx/${e.txHash}`
                  : "" : "",
                onChainFailed: !e.txHash || e.onChain === false,
              })),
              summary: {
                limit: rpt.recent_events?.length ?? 0,
                totalEvents: rpt.summary?.recent_events ?? 0,
                totalSpent: rpt.summary?.credits_spent ?? 0,
                byAction: (rpt.recent_events ?? []).reduce((acc: any, e: any) => { acc[e.action] = (acc[e.action] ?? 0) + 1; return acc }, {}),
                byChain: (rpt.recent_events ?? []).reduce((acc: any, e: any) => { acc[e.chain ?? "mock"] = (acc[e.chain ?? "mock"] ?? 0) + 1; return acc }, {}),
              },
              // 로컬에 저장된 skill 파일 스캔 결과 (stdio MCP가 스캔한 ~/.claude/skills/)
              localSkills: rpt.local_skills ?? null,
              _meta: {
                reporter: rpt.reporter,
                reportedAt: rpt.reported_at,
                uptime: rpt.uptime_seconds,
                pid: rpt.session_pid,
                signature: rpt.signature,
              },
            })
            setSource("agent")
            setGeneratedAt(rpt.reported_at ?? new Date().toISOString())
          } else {
            setError(`${r.error}\n\n💡 ${r.hint ?? ""}`)
          }
        })
        .catch((e: any) => setError(e.message || "Self-report request failed"))
    )
  }

  useEffect(() => { loadReport() }, [agentId])

  // ─── 데이터 조합: added / modified / unchanged ───
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="relative bg-[#0D1017] text-[#D0D7E0] rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace" }}
      >
        {/* Title bar (terminal style) */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2B] border-b border-[#2A2F3B] rounded-t-xl">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <span className="text-[11px] text-[#7C8490] flex-1 text-center">agent-self-report.log</span>
          <button onClick={loadReport} className="text-[10px] text-[#7C8490] hover:text-[#D0D7E0] px-2 py-0.5 rounded cursor-pointer">↻ refresh</button>
          <button onClick={onClose} className="p-1 hover:bg-[#2A2F3B] rounded cursor-pointer">
            <X size={12} className="text-[#7C8490]" />
          </button>
        </div>

        {/* Terminal body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[12px] leading-[1.65]">
          {error && (
            <div className="space-y-1">
              <p className="text-[#FFBD2E]">⚠ Agent self-report unavailable</p>
              <p className="text-[#FF6B6B] text-[11px] whitespace-pre-wrap">{error}</p>
              <p className="text-[#7C8490] text-[11px] mt-2">
                This report is generated directly by the agent process (MCP stdio).{'\n'}
                If the agent is not connected, no report can be received.
              </p>
              <button onClick={loadReport} className="mt-2 text-[10px] text-[#6B9CE8] hover:underline cursor-pointer">
                $ retry
              </button>
            </div>
          )}
          {!data && !error && <p className="text-[#7C8490]">$ requesting self-report from agent via WebSocket...</p>}

          {data && (
            <SelfReportLog data={data} agentId={agentId} agentName={agentName} generatedAt={generatedAt} source={source} />
          )}
        </div>
      </div>
    </div>
  )
}

function CompactPrivacyToggle() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    setEnabled(getPrivacyMode())
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail)
    window.addEventListener(PRIVACY_MODE_EVENT, handler)
    return () => window.removeEventListener(PRIVACY_MODE_EVENT, handler)
  }, [])
  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setPrivacyMode(next)
  }
  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={enabled}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer flex-shrink-0 mb-1.5",
        enabled
          ? "border-[#7B5EA7] bg-[#F3EFFA]"
          : "border-[#E4E1EE] bg-white hover:border-[#C7B8E8]",
      )}
    >
      <div className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center text-[14px] flex-shrink-0",
        enabled ? "bg-[#7B5EA7] text-white" : "bg-[#F3EFFA] text-[#7B5EA7]",
      )}>
        🔒
      </div>
      <div className="text-left leading-tight" style={{ width: 120 }}>
        <p className={cn(
          "text-[12px] font-bold",
          enabled ? "text-[#5B3D87]" : "text-[#1A1626]",
        )}>
          Privacy Mode
        </p>
        <p className="text-[10px] text-[#6B727E] mt-0.5 whitespace-nowrap">
          {enabled ? "Routed via NEAR AI TEE" : "Protect sensitive knowledge"}
        </p>
      </div>
      <span
        className={cn(
          "relative rounded-full transition-colors flex-shrink-0 ml-1",
          enabled ? "bg-[#7B5EA7]" : "bg-[#D5CFE2]",
        )}
        style={{ width: 36, height: 20 }}
      >
        <span
          className="absolute bg-white rounded-full shadow-sm transition-transform"
          style={{
            width: 16,
            height: 16,
            top: 2,
            left: 2,
            transform: enabled ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </span>
    </button>
  )
}

function PrivacyModeToggle() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    setEnabled(getPrivacyMode())
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail)
    window.addEventListener(PRIVACY_MODE_EVENT, handler)
    return () => window.removeEventListener(PRIVACY_MODE_EVENT, handler)
  }, [])
  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setPrivacyMode(next)
  }
  return (
    <div className={cn(
      "mb-4 rounded-xl border p-3 flex items-center justify-between transition-all",
      enabled
        ? "border-[#7B5EA7] bg-gradient-to-r from-[#F3EFFA] to-[#EDE5F9]"
        : "border-[#E4E1EE] bg-white",
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center text-[18px] transition-colors",
          enabled ? "bg-[#7B5EA7] text-white" : "bg-[#F3EFFA] text-[#7B5EA7]",
        )}>
          🔒
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#1A1626] flex items-center gap-1.5">
            Privacy Mode
            {enabled && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#7B5EA7] text-white uppercase tracking-wide">
                TEE Active
              </span>
            )}
          </p>
          <p className="text-[11px] text-[#6B727E] mt-0.5">
            {enabled
              ? "LLM inference is routed through NEAR AI Cloud TEE. Input/output hidden from operators."
              : "Turn ON to protect privacy when consuming sensitive knowledge. Routes via NEAR AI TEE."}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={enabled}
        className={cn(
          "relative rounded-full transition-colors cursor-pointer flex-shrink-0",
          enabled ? "bg-[#7B5EA7]" : "bg-[#D5CFE2]",
        )}
        style={{ width: 48, height: 28 }}
      >
        <span
          className="absolute bg-white rounded-full shadow-sm transition-transform"
          style={{
            width: 24,
            height: 24,
            top: 2,
            left: 2,
            transform: enabled ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */
type AgentKnowledge = { topic: string; lastUpdated: string }

type Agent = {
  id: string
  name: string
  icon: string
  walletAddress: string
  walletType: "evm" | "near"
  karmaTier: string
  karmaBalance: number
  credits: number
  totalDeposited: number
  totalConsumed: number
  domainInterests: string[]
  llmProvider: string
  llmModel: string
  apiKey: string
  registeredAt: string
  knowledge: AgentKnowledge[]
}

type QueryLog = { id: string; question: string; depth: string; creditsConsumed: number; provenanceHash: string; explorerUrl: string; timestamp: string }
type LedgerEntry = { id: string; type: "deposit" | "consume"; amount: number; description: string; txHash?: string; timestamp: string }

/* ═══════════════════════════════════════════════
   Mock data
═══════════════════════════════════════════════ */

const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-1", name: "Coding Assistant", icon: "🤖",
    walletAddress: "0x742d...F4a8", karmaTier: "Silver", karmaBalance: 1250,
    credits: 230, totalDeposited: 500, totalConsumed: 270,
    domainInterests: ["AI Engineering", "LLM Frameworks", "Embeddings"],
    walletType: "evm" as const, apiKey: "ck_live_a1b2c3d4e5f6g7h8i9j0", registeredAt: "2026-04-10",
    llmProvider: "claude", llmModel: "claude-opus-4-6",
    knowledge: [
      { topic: "RAG", lastUpdated: "2025-11-15" },
      { topic: "Prompt Engineering", lastUpdated: "2026-01-20" },
      { topic: "Embeddings", lastUpdated: "2026-04-12" },
    ],
  },
  {
    id: "agent-2", name: "Research Bot", icon: "🔬",
    walletAddress: "0x892a...B3c1", karmaTier: "Bronze", karmaBalance: 320,
    credits: 150, totalDeposited: 200, totalConsumed: 50,
    domainInterests: ["Embeddings", "RAG Pipelines", "Semantic Search"],
    walletType: "evm" as const, apiKey: "ck_live_k9l8m7n6o5p4q3r2s1t0", registeredAt: "2026-04-12",
    llmProvider: "openai", llmModel: "gpt-4o",
    knowledge: [
      { topic: "Embeddings", lastUpdated: "2026-04-10" },
      { topic: "Semantic Search", lastUpdated: "2026-03-01" },
    ],
  },
  {
    id: "agent-3", name: "Support Bot", icon: "💬",
    walletAddress: "0x553f...D7e2", karmaTier: "Bronze", karmaBalance: 180,
    credits: 80, totalDeposited: 100, totalConsumed: 20,
    domainInterests: ["Prompt Engineering", "Evaluation"],
    walletType: "evm" as const, apiKey: "ck_live_u1v2w3x4y5z6a7b8c9d0", registeredAt: "2026-04-13",
    llmProvider: "claude", llmModel: "claude-sonnet-4-5",
    knowledge: [
      { topic: "Prompt Engineering", lastUpdated: "2026-04-01" },
    ],
  },
]

const MOCK_QUERIES: Record<string, QueryLog[]> = {
  "agent-1": [
    { id: "q1", question: "RAG latest updates", depth: "evidence", creditsConsumed: 20, provenanceHash: "0xa1b2c3d4", explorerUrl: "https://sepoliascan.status.network/tx/0xa1b2c3", timestamp: "2026-04-13T15:00:00Z" },
    { id: "q2", question: "Chain-of-Thought effectiveness", depth: "concept", creditsConsumed: 10, provenanceHash: "0xd4e5f6a1", explorerUrl: "https://sepoliascan.status.network/tx/0xd4e5f6", timestamp: "2026-04-13T14:00:00Z" },
    { id: "q3", question: "Agent architecture patterns", depth: "evidence", creditsConsumed: 20, provenanceHash: "0xf6a1b2c3", explorerUrl: "https://sepoliascan.status.network/tx/0xf6a1b2", timestamp: "2026-04-12T11:15:00Z" },
    { id: "q4", question: "Fine-tuning vs RAG comparison", depth: "evidence", creditsConsumed: 20, provenanceHash: "0xb2c3d4e5", explorerUrl: "https://sepoliascan.status.network/tx/0xb2c3d4", timestamp: "2026-04-13T09:30:00Z" },
    { id: "q5", question: "Embeddings model selection", depth: "summary", creditsConsumed: 5, provenanceHash: "0xc3d4e5f6", explorerUrl: "https://sepoliascan.status.network/tx/0xc3d4e5", timestamp: "2026-04-12T16:00:00Z" },
  ],
  "agent-2": [
    { id: "q6", question: "Semantic Search best practices", depth: "concept", creditsConsumed: 10, provenanceHash: "0xe5f6a1b2", explorerUrl: "https://sepoliascan.status.network/tx/0xe5f6a1", timestamp: "2026-04-13T10:00:00Z" },
  ],
  "agent-3": [],
}


/* ═══════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════ */
function relDate(s: string) {
  if (!s) return ""
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`
}
const DEPTH_COLOR: Record<string, string> = { summary: "#2D7A5E", concept: "#7B5EA7", evidence: "#C94B6E" }
const TIER_COLOR: Record<string, string> = { Silver: "#D4854A", Gold: "#D4854A", Bronze: "#9E97B3", Platinum: "#7B5EA7" }

/* ═══════════════════════════════════════════════
   Left Panel — Agent List + Detail
═══════════════════════════════════════════════ */
function AgentPanel({
  agents, selectedId, onSelect, onAdd, onDelete, onUpdate,
}: {
  agents: Agent[]; selectedId: string; onSelect: (id: string) => void; onAdd: () => void; onDelete: (id: string) => void; onUpdate: (id: string, patch: Partial<Agent>) => void
}) {
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0]
  const [cmdCopied, setCmdCopied] = useState(false)
  const [removeCopied, setRemoveCopied] = useState(false)
  const [testCopied, setTestCopied] = useState(false)
  const [mcpConnected, setMcpConnected] = useState(false)
  // MCP 서버 가동 상태 실시간 폴링 (10초마다)
  // — /mcp/sessions 엔드포인트 도달 가능 여부로 서버 alive 체크
  // (Claude Code는 stdio 방식이라 HTTP 세션 목록엔 안 뜨지만, endpoint가 살아있으면 stdio도 가능)
  useEffect(() => {
    if (!selected?.id) { setMcpConnected(false); return }
    let cancelled = false
    const check = async () => {
      try {
        const { fetchMcpSessions } = await import("@/lib/api")
        await fetchMcpSessions() // 200 OK면 서버 alive
        if (!cancelled) setMcpConnected(true)
      } catch {
        if (!cancelled) setMcpConnected(false)
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [selected?.id])

  if (!selected) return null

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://solteti.site'
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (siteUrl.includes('localhost:3000') ? 'http://localhost:4000' : 'https://api.solteti.site')
  const [osTab, setOsTab] = useState<"mac" | "win">("mac")
  const mcpCommandMac = `curl -so ~/cherry-agent.js ${siteUrl}/cherry-agent.js && curl -so ~/cherry-kaas.sh ${siteUrl}/cherry-kaas.sh && chmod +x ~/cherry-kaas.sh && claude mcp add cherry-kaas ~/cherry-kaas.sh --env KAAS_AGENT_API_KEY=${selected.apiKey} --env KAAS_WS_URL=${apiUrl}`
  const mcpCommandWin = `curl.exe -so "$env:USERPROFILE\\cherry-agent.js" ${siteUrl}/cherry-agent.js; curl.exe -so "$env:USERPROFILE\\cherry-kaas.bat" ${siteUrl}/cherry-kaas.bat; claude mcp add cherry-kaas "$env:USERPROFILE\\cherry-kaas.bat" --env KAAS_AGENT_API_KEY=${selected.apiKey} --env KAAS_WS_URL=${apiUrl}`
  const mcpCommand = osTab === "mac" ? mcpCommandMac : mcpCommandWin
  const removeCommand = `claude mcp remove cherry-kaas`

  const handleCmdCopy = () => {
    navigator.clipboard.writeText(mcpCommand)
    setCmdCopied(true)
    setTimeout(() => setCmdCopied(false), 2000)
  }

  const handleRemoveCopy = () => {
    navigator.clipboard.writeText(removeCommand)
    setRemoveCopied(true)
    setTimeout(() => setRemoveCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent list — 스크롤 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#1A1626]">My Agents</h3>
          <button
            onClick={onAdd}
            className="w-6 h-6 rounded-md border border-[#E4E1EE] flex items-center justify-center hover:border-[var(--cherry)] hover:text-[var(--cherry)] text-[#6B727E] cursor-pointer transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className="space-y-1.5">
          {agents.map((a) => (
            <div
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2 transition-all cursor-pointer border",
                a.id === selectedId
                  ? "border-[#D4854A] bg-[#FFF8F0]"
                  : "border-[#E4E1EE] hover:border-[#C7B8E8] bg-white"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px]">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#1A1626] truncate">{a.name}</p>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const { fetchAgentSelfReport } = await import("@/lib/api")
                      const r = await fetchAgentSelfReport(a.id)
                      if (r?.ok && r?.report) {
                        window.dispatchEvent(new CustomEvent("kaas-self-report", {
                          detail: { report: r.report, agentId: a.id, agentName: a.name },
                        }))
                      } else {
                        window.dispatchEvent(new CustomEvent("kaas-self-report-error", {
                          detail: { error: r?.error ?? "Self-report unavailable", hint: r?.hint },
                        }))
                      }
                    } catch (err: any) {
                      window.dispatchEvent(new CustomEvent("kaas-self-report-error", {
                        detail: { error: err?.message ?? "Self-report request failed" },
                      }))
                    }
                  }}
                  title="View Knowledge Diff (self-report)"
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-[#D4854A] text-[#A85D2C] bg-white hover:bg-[#FFF3E5] hover:border-[#A85D2C] cursor-pointer flex-shrink-0 transition-colors"
                >
                  📚 <span>Diff</span>
                </button>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-bold text-[#1A1626]">{a.credits}<span className="text-[9px] font-semibold text-[#6B727E]"> cr</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected agent detail — 고정 하단 */}
      <div className="shrink-0 border-t border-[#E4E1EE] pt-3 mt-3 space-y-3">


        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">MCP Server</p>
          <div className="flex items-center gap-1.5">
            <Globe size={12} className={mcpConnected ? "text-[#2D7A5E]" : "text-[#9E97B3]"} />
            <span className="text-[11px] font-mono text-[#1A1626]">cherry-kaas.mcp.server</span>
            {mcpConnected ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EFF7F3] text-[#2D7A5E] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D7A5E] animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1F7] text-[#9E97B3] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9E97B3]" />
                Disconnected
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#EFF7F3] text-[#2D7A5E] border border-[#A8D4C0] mb-1.5">
            ✓ Paste & run in terminal
          </span>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E]">Claude Code Connection</p>
            <div className="flex items-center gap-0.5 bg-[#F3F1F7] rounded-md p-0.5">
              <button
                onClick={() => setOsTab("mac")}
                className={cn("text-[9px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors", osTab === "mac" ? "bg-white text-[#1A1626] shadow-sm" : "text-[#9E97B3] hover:text-[#6B727E]")}
              >
                Mac / Linux
              </button>
              <button
                onClick={() => setOsTab("win")}
                className={cn("text-[9px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors", osTab === "win" ? "bg-white text-[#1A1626] shadow-sm" : "text-[#9E97B3] hover:text-[#6B727E]")}
              >
                Windows
              </button>
            </div>
          </div>
          <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE] relative">
            <p className="text-[10px] font-mono text-[#1A1626] break-all leading-relaxed pr-6">{mcpCommand}</p>
            <button
              onClick={handleCmdCopy}
              className="absolute top-2 right-2 p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
              title="Copy command"
            >
              {cmdCopied ? <Check size={12} className="text-[#2D7A5E]" /> : <Copy size={12} className="text-[#6B727E]" />}
            </button>
          </div>

        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Connection Test</p>
          <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE] relative">
            <p className="text-[10px] font-mono text-[#1A1626] pr-6">Submit a self-report of your knowledge to Cherry KaaS server.</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText("Submit a self-report of your knowledge to Cherry KaaS server.")
                setTestCopied(true)
                setTimeout(() => setTestCopied(false), 2000)
              }}
              className="absolute top-2 right-2 p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
              title="Copy test prompt"
            >
              {testCopied ? <Check size={12} className="text-[#2D7A5E]" /> : <Copy size={12} className="text-[#6B727E]" />}
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Disconnect MCP</p>
          <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE] relative">
            <p className="text-[10px] font-mono text-[#1A1626] pr-6">{removeCommand}</p>
            <button
              onClick={handleRemoveCopy}
              className="absolute top-2 right-2 p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
              title="Copy disconnect command"
            >
              {removeCopied ? <Check size={12} className="text-[#2D7A5E]" /> : <Copy size={12} className="text-[#6B727E]" />}
            </button>
          </div>
        </div>

        <button
          onClick={() => { if (confirm(`Delete agent "${selected.name}"?`)) onDelete(selected.id) }}
          className="w-full text-[12px] font-medium text-[#999] hover:text-red-400 py-0 -mt-2 cursor-pointer transition-colors leading-tight"
        >
          Delete Agent
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Registration Form (inline in left panel)
═══════════════════════════════════════════════ */
function RegisterForm({ onComplete, onCancel }: { onComplete: (agent: Agent) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [walletType, setWalletType] = useState<"evm" | "near">("evm")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletConnected, setWalletConnected] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")
  const [registeredKey, setRegisteredKey] = useState("")
  const [copied, setCopied] = useState(false)
  const [removeHintCopied, setRemoveHintCopied] = useState(false)

  // NEAR 선택 시 기존 연결된 세션 자동 감지 (새로 연결 필요 없으면 버튼 누를 필요 X)
  useEffect(() => {
    if (walletType !== "near") return
    let cancelled = false
    ;(async () => {
      try {
        const { getConnectedNearAccount } = await import("@/lib/near-connector")
        const acct = await getConnectedNearAccount()
        if (!cancelled && acct) {
          setWalletAddress(acct)
          setWalletConnected(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walletType])

  const connectMetaMask = async () => {
    try {
      const eth = (window as any).ethereum
      if (!eth) { setError("MetaMask is not installed"); return }
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      if (accounts[0]) {
        setWalletAddress(accounts[0])
        setWalletConnected(true)
        setError("")
      }
    } catch {
      setError("MetaMask connection failed")
    }
  }

  const connectNear = async () => {
    try {
      const { connectNearWallet } = await import("@/lib/near-connector")
      const accountId = await connectNearWallet()
      setWalletAddress(accountId)
      setWalletConnected(true)
      setError("")
    } catch (e: any) {
      console.error("[connectNear] failed:", e)
      setError(`NEAR wallet connection failed: ${e?.message ?? e}`)
    }
  }

  /** NEAR 저장된 세션을 초기화하고 다시 선택 가능하게 */
  const changeWallet = async () => {
    if (walletType === "near") {
      try {
        const { disconnectNearWallet } = await import("@/lib/near-connector")
        await disconnectNearWallet()
      } catch {
        /* ignore */
      }
    }
    setWalletAddress("")
    setWalletConnected(false)
    setError("")
  }

  const handleRegister = async () => {
    if (!name.trim() || !walletAddress) return
    setRegistering(true)
    setError("")
    try {
      const { registerAgent } = await import("@/lib/api")
      const raw: any = await registerAgent({
        name: name.trim(),
        wallet_address: walletAddress,
        wallet_type: walletType,
        domain_interests: [],
      })
      const newAgent: Agent = {
        id: raw.id, name: raw.name, icon: "🤖",
        walletAddress: raw.wallet_address ?? walletAddress,
        walletType: (raw.wallet_type ?? walletType) as "evm" | "near",
        karmaTier: raw.karma_tier ?? "Bronze", karmaBalance: 0,
        credits: 0, totalDeposited: 0, totalConsumed: 0,
        domainInterests: [], llmProvider: "", llmModel: "",
        apiKey: raw.api_key ?? "",
        registeredAt: raw.created_at ?? new Date().toISOString(),
        knowledge: [],
      }
      setRegisteredKey(raw.api_key ?? "")
      onComplete(newAgent)
    } catch (err: any) {
      setError(err.message || "Registration failed")
    } finally {
      setRegistering(false)
    }
  }

  const canRegister = name.trim() && walletConnected && !registering

  // 등록 성공 → MCP 설정 안내
  if (registeredKey) {
    const mcpConfig = `{
  "mcpServers": {
    "cherry-kaas": {
      "command": "/path/to/apps/api/start-mcp.sh",
      "env": {
        "KAAS_AGENT_API_KEY": "${registeredKey}"
      }
    }
  }
}`
    return (
      <div className="flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-[#2D7A5E]" />
          <h3 className="text-[14px] font-bold text-[#2D7A5E]">Registered!</h3>
        </div>

        <div className="rounded-lg bg-[#EFF7F3] p-3 text-[12px] text-[#2D7A5E] space-y-1">
          <p className="font-semibold">Next Steps</p>
          <p className="text-[11px]">1. Deposit credits</p>
          <p className="text-[11px]">2. Add the config below to your MCP client</p>
          <p className="text-[11px]">3. Agent starts searching/purchasing knowledge</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#D4854A] mb-1">MCP Config (copy)</p>
          <div className="relative">
            <pre className="text-[9px] font-mono bg-[#FAFAFA] rounded-lg p-3 border border-[#E4E1EE] whitespace-pre-wrap break-all select-all overflow-x-auto">{mcpConfig}</pre>
            <button
              onClick={() => { navigator.clipboard.writeText(mcpConfig); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="absolute top-2 right-2 p-1 rounded bg-white border border-[#E4E1EE] hover:border-[#D4854A] cursor-pointer"
            >
              {copied ? <Check size={10} className="text-[#2D7A5E]" /> : <Copy size={10} className="text-[#999]" />}
            </button>
          </div>
          <p className="text-[9px] text-[#999] mt-1">Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json</p>
        </div>

        <button
          onClick={() => {
            const config = JSON.stringify({
              mcpServers: {
                "cherry-kaas": {
                  command: "TODO_REPLACE_WITH_YOUR_PATH/apps/api/start-mcp.sh",
                  env: { KAAS_AGENT_API_KEY: registeredKey }
                }
              }
            }, null, 2)
            const blob = new Blob([config], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "claude_desktop_config.json"
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="w-full text-[12px] font-semibold py-2 rounded-lg bg-[#D4854A] text-white hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Key size={13} /> Download Claude Desktop Config
        </button>

        <button onClick={() => { setRegisteredKey(""); onCancel() }} className="w-full text-[12px] font-medium py-2 rounded-lg border border-[#E4E1EE] text-[#6B727E] hover:bg-[#FAFAFA] cursor-pointer">
          OK
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-[#1A1626]">Register Agent</h3>
        <button onClick={onCancel} className="text-[11px] text-[#6B727E] hover:text-[var(--cherry)] cursor-pointer">Cancel</button>
      </div>

      {error && <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>}

      <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE]">
        <p className="text-[9px] text-[#6B727E] mb-1">If you have a previous agent registered, remove it first:</p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-[#1A1626]">claude mcp remove cherry-kaas</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText("claude mcp remove cherry-kaas")
              setRemoveHintCopied(true)
              setTimeout(() => setRemoveHintCopied(false), 2000)
            }}
            className="p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
            title="Copy"
          >
            {removeHintCopied ? <Check size={11} className="text-[#2D7A5E]" /> : <Copy size={11} className="text-[#6B727E]" />}
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1.5">Agent Name</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Research Agent"
          className="w-full px-3 py-1.5 text-[12px] rounded-lg border border-[#E4E1EE] bg-[#FAFAFA] placeholder:text-[#9E97B3] focus:outline-none focus:border-[var(--cherry)]"
        />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1.5">Wallet Type</p>
        <div className="inline-flex p-0.5 bg-[#F9F7F5] rounded-lg border border-[#E4E1EE] mb-2">
          <button
            type="button"
            onClick={() => { if (!walletConnected) setWalletType("evm") }}
            disabled={walletConnected}
            className={cn(
              "text-[11px] font-semibold px-3 py-1 rounded-md transition-colors",
              walletType === "evm" ? "bg-white text-[#D4854A] shadow-sm" : "text-[#6B727E]",
              walletConnected && "opacity-60 cursor-not-allowed",
            )}
          >
            MetaMask
          </button>
          <button
            type="button"
            onClick={() => { if (!walletConnected) setWalletType("near") }}
            disabled={walletConnected}
            className={cn(
              "text-[11px] font-semibold px-3 py-1 rounded-md transition-colors",
              walletType === "near" ? "bg-white text-[#7B5EA7] shadow-sm" : "text-[#6B727E]",
              walletConnected && "opacity-60 cursor-not-allowed",
            )}
          >
            NEAR
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1.5">Connect Wallet</p>
        {walletConnected ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2D7A5E] bg-[#EFF7F3]">
            <Check size={14} className="text-[#2D7A5E]" />
            <span className="text-[11px] font-mono text-[#1A1626] flex-1 truncate">
              {walletType === "evm"
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : walletAddress}
            </span>
            <button
              type="button"
              onClick={changeWallet}
              className="text-[10px] text-[#6B727E] hover:text-[var(--cherry)] underline cursor-pointer flex-shrink-0"
            >
              Change
            </button>
          </div>
        ) : walletType === "evm" ? (
          <button onClick={connectMetaMask} className="w-full text-[12px] font-semibold py-2 rounded-lg border border-[#D4854A] text-[#D4854A] hover:bg-[#FFF8F0] cursor-pointer flex items-center justify-center gap-2">
            <Wallet size={14} /> Connect MetaMask
          </button>
        ) : (
          <button onClick={connectNear} className="w-full text-[12px] font-semibold py-2 rounded-lg border border-[#7B5EA7] text-[#7B5EA7] hover:bg-[#F3EFFA] cursor-pointer flex items-center justify-center gap-2">
            <Wallet size={14} /> Connect NEAR Wallet
          </button>
        )}
      </div>

      <button
        onClick={handleRegister}
        disabled={!canRegister}
        className={cn(
          "w-full text-[12px] font-semibold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 mt-auto",
          canRegister
            ? "bg-[var(--cherry)] text-white hover:opacity-90"
            : "bg-[#E4E1EE] text-[#9E97B3] cursor-not-allowed"
        )}
      >
        <UserPlus size={14} /> {registering ? "Registering..." : "Register Agent"}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Deposit / Withdraw Buttons
═══════════════════════════════════════════════ */
function DepositWithdrawButtons({ agent, onDeposited, pendingAmount, curatorName, onWithdrawn }: { agent: Agent; onDeposited: () => void; pendingAmount: number; curatorName?: string; onWithdrawn?: () => void }) {
  const [showDeposit, setShowDeposit] = useState(false)
  const [amount, setAmount] = useState(100)
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState(false)
  const [result, setResult] = useState<{ msg: string; ok: boolean; tx?: string; explorer?: string } | null>(null)

  const handleDeposit = async () => {
    const key = agent.apiKey
    if (!key) { alert("API Key missing. Please re-register the agent."); return }
    if (amount <= 0) { alert("Enter an amount"); return }
    setDepositing(true)
    setResult(null)
    try {
      const { depositCredits } = await import("@/lib/api")
      const res = await depositCredits(key, amount)
      setResult({
        msg: res.onChain
          ? `Deposit complete! +${amount}cr · on-chain tx`
          : `Deposit complete! +${amount}cr · on-chain failed (DB only)`,
        ok: true,
        tx: res.txHash,
        explorer: res.explorerUrl,
      })
      setShowDeposit(false)
      onDeposited()
    } catch (err: any) {
      setResult({ msg: `Deposit failed: ${err.message}`, ok: false })
    } finally {
      setDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    if (!curatorName) { alert("No curator name — cannot withdraw"); return }
    if (pendingAmount <= 0) { alert("No pending rewards to withdraw"); return }
    if (!confirm(`Withdraw ${pendingAmount}cr to curator wallet?\nThis will execute an on-chain transaction on Status Network (gasless).`)) return
    setWithdrawing(true)
    setResult(null)
    try {
      const { withdrawRewards } = await import("@/lib/api")
      const res = await withdrawRewards(curatorName)
      if (res.ok) {
        setResult({
          msg: `Withdrawn ${res.withdrawn}cr · ${res.rowsUpdated} rewards settled`,
          ok: true,
          tx: res.txHash,
          explorer: res.explorerUrl,
        })
        onWithdrawn?.()
      } else {
        setResult({ msg: `Withdraw failed: ${res.error ?? "unknown"}`, ok: false })
      }
    } catch (err: any) {
      setResult({ msg: `Withdraw failed: ${err.message}`, ok: false })
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {result && (
        <div className={cn("text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-2 flex-wrap", result.ok ? "text-[#2D7A5E] bg-[#EFF7F3]" : "text-red-500 bg-red-50")}>
          <span>{result.msg}</span>
          {result.tx && (
            <a
              href={result.explorer ?? `https://sepoliascan.status.network/tx/${result.tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] underline inline-flex items-center gap-0.5"
            >
              {result.tx.slice(0, 10)}...<ExternalLink size={9} />
            </a>
          )}
        </div>
      )}
      {showDeposit && (
        <div className="flex items-center gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={1} className="w-24 px-2 py-1 text-[12px] rounded-lg border border-[#E4E1EE] outline-none focus:border-[#D4854A]" />
          <span className="text-[11px] text-[#6B727E]">cr</span>
          <button onClick={handleDeposit} disabled={depositing} className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-[#D4854A] text-white hover:opacity-90 disabled:opacity-50">{depositing ? "..." : "Deposit"}</button>
          <button onClick={() => setShowDeposit(false)} className="text-[11px] text-[#6B727E] hover:text-[#1A1626]">Cancel</button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowDeposit(!showDeposit)} className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border border-[#D4854A] text-[#D4854A] hover:bg-[#FDF6EE] cursor-pointer flex items-center gap-1.5">
          <Wallet size={13} /> Deposit
        </button>
        <button
          onClick={() => { setWithdrawMsg(true); setTimeout(() => setWithdrawMsg(false), 3000) }}
          className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border border-[#2D7A5E] text-[#2D7A5E] hover:bg-[#EFF7F3] cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <ArrowUpRight size={13} />
          Withdraw{pendingAmount > 0 ? ` ${pendingAmount}cr` : ""}
        </button>
        {withdrawMsg && <span className="text-[10px] text-[#D4854A] font-semibold">Not yet</span>}
        <span className="text-[10px] text-[#6B727E] ml-auto">Gasless on Status Network</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Right Panel — Wallet & Rewards
═══════════════════════════════════════════════ */
function WalletPanel({ agent, onRefresh, karma, karmaLoading, karmaError, onRefreshKarma, isAdmin = false }: {
  agent: Agent; onRefresh: () => void;
  karma: import("@/lib/api").OnchainKarma | null; karmaLoading: boolean; karmaError: string | null; onRefreshKarma: () => void;
  isAdmin?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"queries" | "ledger" | "rewards">("queries")
  const [queries, setQueries] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [rewardData, setRewardData] = useState<{ pending: number; withdrawn: number; total: number; rewards: any[]; curatorName: string | null; chosenPending: number }>({ pending: 0, withdrawn: 0, total: 0, rewards: [], curatorName: null, chosenPending: 0 })

  const loadLedger = () => {
    if (!agent.apiKey) return
    import("@/lib/api").then(({ fetchLedger }) =>
      fetchLedger(agent.apiKey).then((data: any[]) => {
        if (Array.isArray(data)) setLedger(data)
      }).catch(() => {})
    )
  }

  const loadHistory = () => {
    if (!agent.apiKey) return
    import("@/lib/api").then(({ fetchHistory }) =>
      fetchHistory(agent.apiKey).then((data: any[]) => {
        if (Array.isArray(data)) setQueries(data)
      }).catch(() => {})
    )
  }

  const loadRewards = () => {
    if (!agent.name) return
    if (isAdmin) {
      // 관리자: 전체 큐레이터 보상 현황
      import("@/lib/api").then(({ fetchAllRewards, fetchCuratorRewards }) =>
        fetchAllRewards().then((data: any[]) => {
          const total = data.reduce((s: number, r: any) => s + (r.total ?? 0), 0)
          const pending = data.reduce((s: number, r: any) => s + (r.pending ?? 0), 0)
          if (data.length > 0) {
            const withPending = data.find((r: any) => (r.pending ?? 0) > 0)
            const chosen = withPending ?? data[0]
            const chosenName = chosen.curator_name
            const chosenPending = chosen.pending ?? 0
            fetchCuratorRewards(chosenName).then((d: any) => {
              setRewardData({ pending, withdrawn: total - pending, total, rewards: d.rewards ?? [], curatorName: chosenName, chosenPending })
            }).catch(() => setRewardData({ pending, withdrawn: total - pending, total, rewards: [], curatorName: chosenName, chosenPending }))
          } else {
            setRewardData({ pending: 0, withdrawn: 0, total: 0, rewards: [], curatorName: null, chosenPending: 0 })
          }
        }).catch(() => {})
      )
    } else {
      // 일반 유저: 자기 에이전트 이름으로만 조회
      import("@/lib/api").then(({ fetchCuratorRewards }) =>
        fetchCuratorRewards(agent.name).then((d: any) => {
          setRewardData({
            pending: d.pending ?? 0,
            withdrawn: d.withdrawn ?? 0,
            total: d.total ?? 0,
            rewards: d.rewards ?? [],
            curatorName: agent.name,
            chosenPending: d.pending ?? 0,
          })
        }).catch(() => setRewardData({ pending: 0, withdrawn: 0, total: 0, rewards: [], curatorName: agent.name, chosenPending: 0 }))
      )
    }
  }

  useEffect(() => {
    loadHistory()
    loadLedger()
    loadRewards()
    const onChange = () => { loadHistory(); loadLedger() }
    window.addEventListener("kaas-agents-changed", onChange)
    return () => window.removeEventListener("kaas-agents-changed", onChange)
  }, [agent.apiKey, agent.name])

  const totalEarned = rewardData.total
  const pendingAmount = rewardData.pending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[15px] font-bold text-[#1A1626]">Wallet & Rewards</h3>
        <div className="flex items-center gap-1.5">
          <Wallet size={13} className="text-[#7B5EA7]" />
          <span className="text-[12px] font-mono font-semibold text-[#1A1626]">
            {agent.walletAddress && agent.walletAddress.length > 12
              ? `${agent.walletAddress.slice(0, 6)}...${agent.walletAddress.slice(-4)}`
              : agent.walletAddress || "—"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="rounded-lg border border-[#E4E1EE] bg-white p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Coins size={13} className="text-[#D4854A]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#D4854A]">Balance</span>
          </div>
          <p className="text-[20px] font-extrabold text-[#1A1626]">{agent.credits} <span className="text-[12px] font-semibold text-[#6B727E]">cr</span></p>
          <p className="text-[11px] text-[#6B727E] mt-0.5">{agent.totalDeposited} in · {agent.totalConsumed} out</p>
        </div>
        <div className="rounded-lg border border-[#E4E1EE] bg-white p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpRight size={13} className="text-[#2D7A5E]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#2D7A5E]">Earned</span>
          </div>
          <p className="text-[20px] font-extrabold text-[#1A1626]">{totalEarned} <span className="text-[12px] font-semibold text-[#6B727E]">cr</span></p>
          <p className="text-[11px] text-[#6B727E] mt-0.5">40% revenue share</p>
        </div>
        <div className="rounded-lg border border-[#E4E1EE] bg-white p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowDownRight size={13} className="text-[#C94B6E]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#C94B6E]">Pending</span>
          </div>
          <p className="text-[20px] font-extrabold text-[#1A1626]">{pendingAmount} <span className="text-[12px] font-semibold text-[#6B727E]">cr</span></p>
          <p className="text-[11px] text-[#6B727E] mt-0.5">{rewardData.rewards.filter((r: any) => !r.withdrawn).length} to withdraw</p>
        </div>
        <div className="rounded-lg border border-[#E4E1EE] bg-white p-3 relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield size={13} className="text-[#7B5EA7]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#7B5EA7]">Karma</span>
            <button onClick={onRefreshKarma} disabled={karmaLoading} className="ml-auto text-[8px] text-[#7B5EA7] hover:underline cursor-pointer disabled:opacity-50" title="Refresh onchain">
              {karmaLoading ? "…" : "↻"}
            </button>
          </div>
          {karmaError ? (
            <p className="text-[10px] text-[#C94B6E]">⚠ {karmaError}</p>
          ) : karma ? (
            <>
              <p className="text-[18px] font-extrabold text-[#1A1626]">{karma.balance.toFixed(1)} <span className="text-[11px] font-semibold text-[#6B727E]">KARMA</span></p>
              <p className="text-[10px] text-[#6B727E] mt-0.5">tier {karma.onchainTierId} ({karma.onchainTierName})</p>
              {typeof karma.txPerEpoch === "number" && (
                <p className="text-[10px] text-[#2D7A5E] font-semibold">{karma.txPerEpoch} tx/epoch</p>
              )}
              {karma.karmaContract && (
                <a href={`https://hoodiscan.status.network/address/${karma.karmaContract}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-[#7B5EA7] hover:underline">
                  {karma.karmaContract.slice(0, 8)}…{karma.karmaContract.slice(-4)}
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-[18px] font-extrabold text-[#1A1626]">— <span className="text-[11px] font-semibold text-[#6B727E]">KARMA</span></p>
              <p className="text-[10px] text-[#6B727E] mt-0.5">{karmaLoading ? "loading..." : "click ↻"}</p>
            </>
          )}
        </div>
      </div>

      {/* 결제 체인 — 에이전트 지갑 타입에서 자동 결정 (교차 선택 불가) */}
      <div className="rounded-lg border border-[#E4E1EE] bg-white p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#6B727E]">Payment Chain</p>
            <p className="text-[10px] text-[#9E97B3] mt-0.5">Determined by this agent&rsquo;s wallet — MetaMask → Status, NEAR → NEAR</p>
          </div>
          <ChainBadge walletType={agent.walletType} />
        </div>
      </div>

      {/* Buttons */}
      <DepositWithdrawButtons
        agent={agent}
        onDeposited={() => { onRefresh(); loadLedger() }}
        pendingAmount={rewardData.chosenPending}
        curatorName={rewardData.curatorName ?? undefined}
        onWithdrawn={() => { loadRewards(); onRefresh() }}
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-[#E4E1EE]">
        {(["queries", "ledger", "rewards"] as const).map((tab) => (
          <button
            key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              "text-[12px] font-semibold px-3 py-2 border-b-2 cursor-pointer transition-all",
              activeTab === tab ? "border-[var(--cherry)] text-[#1A1626]" : "border-transparent text-[#9E97B3] hover:text-[#3D3652]"
            )}
          >
            {tab === "queries" ? `Queries (${queries.length})` : tab === "ledger" ? "Ledger" : "Rewards"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "queries" && (
          queries.length > 0 ? (
            <div>
              {queries.map((q) => {
                const conceptId = q.concept_id ?? q.conceptId ?? ""
                const actionType = q.action_type ?? q.actionType ?? "purchase"
                const credits = q.credits_consumed ?? q.creditsConsumed ?? 0
                const hash = q.provenance_hash ?? q.provenanceHash ?? ""
                const chain = q.chain ?? ""
                const time = q.created_at ?? q.timestamp ?? ""
                // 체인별 Explorer URL (NEAR는 Nearblocks — 구 explorer.testnet.near.org 죽음)
                const explorerUrl = hash
                  ? chain === "near"
                    ? `https://testnet.nearblocks.io/txns/${hash}`
                    : `https://sepoliascan.status.network/tx/${hash}`
                  : ""
                const onChainFailed = chain === "failed" || !hash
                return (
                  <div key={q.id} className="flex items-center gap-3 py-2.5 border-b border-[#F2F0F7] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1A1626] font-semibold truncate">{conceptId}</p>
                      <p className="text-[10px] text-[#6B727E] mt-0.5">{actionType} · {relDate(time)}</p>
                    </div>
                    <span className="text-[11px] text-[#D4854A] font-bold">{credits}cr</span>
                    {onChainFailed ? (
                      <span className="text-[#D4854A] text-[10px] flex-shrink-0" title="On-chain recording failed">⚠ on-chain failed</span>
                    ) : (
                      <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B727E] font-mono text-[10px] hover:underline flex-shrink-0 flex items-center gap-0.5">
                        {hash.slice(0, 10)}...<ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[12px] text-[#9E97B3]">No queries yet. Purchase knowledge from the catalog.</div>
          )
        )}

        {activeTab === "ledger" && (
          ledger.length > 0 ? (
            <div>
              {ledger.map((e) => {
                const isDeposit = e.type === "deposit"
                const amount = Math.abs(e.amount)
                const hash = e.tx_hash ?? ""
                const chain = e.chain ?? ""
                const explorerUrl = hash
                  ? chain === "near"
                    ? `https://testnet.nearblocks.io/txns/${hash}`
                    : `https://sepoliascan.status.network/tx/${hash}`
                  : ""
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-[#F2F0F7] last:border-0">
                    <span className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0",
                      isDeposit ? "bg-[#E8F5EF]" : "bg-[#FDEEE3]"
                    )}>
                      {isDeposit
                        ? <ArrowDownRight size={12} className="text-[#2D7A5E]" />
                        : <ArrowUpRight size={12} className="text-[#D4854A]" />
                      }
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1A1626] font-semibold truncate">
                        {isDeposit ? "Deposit" : "Consume"}
                        <span className="ml-1.5 text-[10px] text-[#6B727E] font-normal">{e.description}</span>
                      </p>
                      <p className="text-[10px] text-[#6B727E] mt-0.5">{relDate(e.created_at)}</p>
                    </div>
                    <span className={cn(
                      "text-[12px] font-bold flex-shrink-0",
                      isDeposit ? "text-[#2D7A5E]" : "text-[#D4854A]"
                    )}>
                      {isDeposit ? "+" : "−"}{amount}cr
                    </span>
                    {hash ? (
                      <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B727E] font-mono text-[10px] hover:underline flex-shrink-0 flex items-center gap-0.5">
                        {hash.slice(0, 10)}...<ExternalLink size={9} />
                      </a>
                    ) : e.description === "Welcome bonus" ? (
                      <span className="text-[10px] text-[#9E97B3] flex-shrink-0">🎁 welcome</span>
                    ) : (
                      <span className="text-[10px] text-[#D4854A] flex-shrink-0" title="On-chain recording failed — DB only">⚠ on-chain failed</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[12px] text-[#9E97B3]">
              No transactions yet. Deposit credits to start.
            </div>
          )
        )}

        {activeTab === "rewards" && (
          <div>
            {rewardData.rewards.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-[#9E97B3]">No reward history yet.</div>
            ) : rewardData.rewards.map((r: any) => {
              const txHash = r.tx_hash ?? ""
              const explorerUrl = txHash ? `https://sepoliascan.status.network/tx/${txHash}` : ""
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-[#F2F0F7] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#1A1626] font-semibold truncate">{r.concept_id}</p>
                    <p className="text-[10px] text-[#6B727E] mt-0.5">{r.curator_name} · {relDate(r.created_at)}</p>
                  </div>
                  <span className="text-[12px] text-[#2D7A5E] font-bold">+{r.amount} cr</span>
                  {txHash ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6B727E] font-mono text-[10px] hover:underline flex-shrink-0 flex items-center gap-0.5"
                      title={r.withdrawn ? `Withdrawn · ${txHash}` : txHash}
                    >
                      {txHash.slice(0, 10)}...<ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#9E97B3] flex-shrink-0" title="Reward accrued. Click Withdraw to settle on-chain in one transaction.">accrued (awaits withdraw)</span>
                  )}
                  {r.withdrawn
                    ? <span className="text-[10px] text-[#2D7A5E] font-semibold">Withdrawn</span>
                    : <span className="text-[10px] text-[#D4854A] font-semibold">Pending</span>}
                </div>
              )
            })}
            {rewardData.rewards.length > 0 && (
              <div className="flex items-center justify-between pt-3 text-[12px]">
                <span className="text-[#3D3652]">
                  Total: <span className="font-bold text-[#2D7A5E]">{totalEarned} cr</span> ·
                  Pending: <span className="font-bold text-[#D4854A]">{pendingAmount} cr</span>
                </span>
                <span className="text-[10px] text-[#6B727E]">40% share</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Main — 2 panel layout
═══════════════════════════════════════════════ */
export function KaasDashboardPage({ isAdmin = false, onTabChange }: { isAdmin?: boolean; onTabChange?: (tab: "dashboard" | "curation" | "template") => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [showRegister, setShowRegister] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "curation" | "template">("dashboard")

  // Karma state — 상위에서 관리하여 좌측(AgentPanel) + 우측(WalletPanel) 양쪽 접근 가능
  const [onchainKarma, setOnchainKarma] = useState<import("@/lib/api").OnchainKarma | null>(null)
  const [karmaLoading, setKarmaLoading] = useState(false)
  const [karmaError, setKarmaError] = useState<string | null>(null)

  const KARMA_CACHE_TTL = 5 * 60 * 1000
  const karmaCacheKey = (id: string) => `kaas_karma_cache:${id}`
  const readKarmaCache = (id: string): { data: import("@/lib/api").OnchainKarma; at: number } | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = sessionStorage.getItem(karmaCacheKey(id))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed.at || Date.now() - parsed.at > KARMA_CACHE_TTL) return null
      return parsed
    } catch { return null }
  }
  const writeKarmaCache = (id: string, data: import("@/lib/api").OnchainKarma) => {
    if (typeof window === "undefined") return
    try { sessionStorage.setItem(karmaCacheKey(id), JSON.stringify({ data, at: Date.now() })) } catch {}
  }

  useEffect(() => {
    if (!selectedAgentId) { setOnchainKarma(null); setKarmaError(null); return }
    const cached = readKarmaCache(selectedAgentId)
    if (cached) { setOnchainKarma(cached.data); return }
    setKarmaLoading(true); setOnchainKarma(null); setKarmaError(null)
    let cancelled = false
    ;(async () => {
      try {
        const { fetchAgentKarma } = await import("@/lib/api")
        const r = await fetchAgentKarma(selectedAgentId)
        if (!cancelled) { setOnchainKarma(r); writeKarmaCache(selectedAgentId, r) }
      } catch (e: any) {
        if (!cancelled) setKarmaError(e?.message ?? "Onchain read failed")
      } finally {
        if (!cancelled) setKarmaLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedAgentId])

  const refreshOnchainKarma = async () => {
    if (!selectedAgentId) return
    setKarmaLoading(true); setKarmaError(null)
    try {
      const { fetchAgentKarma } = await import("@/lib/api")
      const r = await fetchAgentKarma(selectedAgentId)
      setOnchainKarma(r); writeKarmaCache(selectedAgentId, r)
    } catch (e: any) {
      setKarmaError(e?.message ?? "Onchain read failed")
    } finally {
      setKarmaLoading(false)
    }
  }

  // Notify parent when the active sub-tab changes (so the floating Cherry Console can show the right context)
  useEffect(() => { onTabChange?.(activeTab) }, [activeTab, onTabChange])

  const loadAgents = async () => {
    try {
      const { fetchAgents, fetchBalance } = await import("@/lib/api")
      const raw: any[] = await fetchAgents()
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped: Agent[] = await Promise.all(raw.map(async (a) => {
          const key = a.api_key ?? ""
          let balance = { balance: 0, totalDeposited: 0, totalConsumed: 0 }
          if (key) {
            try { balance = await fetchBalance(key) } catch { /* ignore */ }
          }
          const walletAddr = a.wallet_address ?? a.walletAddress ?? ""
          // DB의 wallet_type이 비어있으면 주소 prefix로 추정 (0x → evm, 그 외 비어있지 않으면 near)
          const walletTypeGuess: "evm" | "near" =
            a.wallet_type ?? a.walletType ??
            (walletAddr.startsWith("0x") ? "evm" : (walletAddr ? "near" : "evm"))
          return {
            id: a.id, name: a.name, icon: a.icon ?? "🤖",
            walletAddress: walletAddr,
            walletType: walletTypeGuess,
            karmaTier: a.karma_tier ?? a.karmaTier ?? "Bronze",
            karmaBalance: a.karma_balance ?? a.karmaBalance ?? 0,
            credits: balance.balance, totalDeposited: balance.totalDeposited, totalConsumed: balance.totalConsumed,
            domainInterests: Array.isArray(a.domain_interests) ? a.domain_interests
              : Array.isArray(a.domainInterests) ? a.domainInterests
              : typeof a.domain_interests === "string" ? JSON.parse(a.domain_interests) : [],
            llmProvider: a.llm_provider ?? "gpt", llmModel: a.llm_model ?? "",
            apiKey: key, registeredAt: a.created_at ?? a.registeredAt ?? "", knowledge: a.knowledge ?? [],
          }
        }))
        setAgents(mapped)
        if (!selectedAgentId || !mapped.find((a) => a.id === selectedAgentId)) setSelectedAgentId(mapped[0].id)
      } else {
        setAgents([])
        setSelectedAgentId("")
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { loadAgents() }, [])

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null
  const showRegisterAuto = agents.length === 0 && !showRegister

  const tabs = [
    { key: "dashboard" as const, label: "Dashboard" },
    { key: "curation" as const, label: "Knowledge Curation" },
    ...(isAdmin ? [
      { key: "template" as const, label: "Prompt Templates" },
    ] : []),
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header + Tabs */}
      <div className="shrink-0 border-b border-[#E4E1EE] bg-white px-4 lg:px-6 pt-4 lg:pt-5 pb-0">
        <h2 className="text-[16px] lg:text-[18px] font-extrabold text-[#1A1626] mb-2 lg:mb-3" style={{ letterSpacing: "-0.3px" }}>
          Dashboard
        </h2>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          {tabs.length > 1 ? (
            <div className="flex gap-0 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "border-b-2 px-3 lg:px-4 py-2 lg:py-2.5 text-[12px] lg:text-[13px] font-semibold transition-colors whitespace-nowrap",
                    activeTab === t.key
                      ? "border-[var(--cherry)] text-[#1A1626]"
                      : "border-transparent text-[#9E97B3] hover:text-[#3D3652]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : <div />}
          <div className="flex-shrink-0 pb-2 lg:pb-0">
            <CompactPrivacyToggle />
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && (
          <div className="h-full overflow-y-auto p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 lg:h-full">
              {/* Left — Agent List + Detail */}
              <div className="lg:w-[340px] flex-shrink-0 rounded-xl border border-[#E4E1EE] bg-white p-4">
                {showRegister || showRegisterAuto ? (
                  <RegisterForm
                    onComplete={(newAgent) => {
                      setSelectedAgentId(newAgent.id)
                      setShowRegister(false)
                      // 에이전트 목록 + 잔고 새로 불러오기 (welcome 200cr 반영)
                      loadAgents()
                      window.dispatchEvent(new Event("kaas-agents-changed"))
                    }}
                    onCancel={() => setShowRegister(false)}
                  />
                ) : selectedAgent ? (
                  <AgentPanel
                    agents={agents}
                    selectedId={selectedAgentId}
                    onSelect={setSelectedAgentId}
                    onAdd={() => setShowRegister(true)}
                    onUpdate={(id, patch) => {
                      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
                    }}
                    onDelete={async (id) => {
                      const { deleteAgent } = await import("@/lib/api")
                      await deleteAgent(id)
                      setSelectedAgentId("")
                      await loadAgents()
                      window.dispatchEvent(new Event("kaas-agents-changed"))
                    }}
                  />
                ) : null}
              </div>
              {/* Right — Wallet & Rewards */}
              <div className="flex-1 rounded-xl border border-[#E4E1EE] bg-white p-4 lg:p-5 min-w-0 overflow-y-auto">
                {selectedAgent ? <WalletPanel agent={selectedAgent} onRefresh={loadAgents} karma={onchainKarma} karmaLoading={karmaLoading} karmaError={karmaError} onRefreshKarma={refreshOnchainKarma} isAdmin={isAdmin} /> : (
                  <div className="flex items-center justify-center h-full text-[13px] text-[#999]">Register an agent</div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === "curation" && (
          <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAFAFA]">
            <KnowledgeCurationPanel isAdmin={isAdmin} />
          </div>
        )}
        {activeTab === "template" && (
          <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAFAFA]">
            <TemplateEditorBody />
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Export agents for catalog integration
═══════════════════════════════════════════════ */
export { MOCK_AGENTS }
export type { Agent }

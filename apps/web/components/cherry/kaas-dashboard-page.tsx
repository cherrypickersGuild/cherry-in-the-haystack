"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Coins, ExternalLink, Shield, Wallet, ArrowUpRight, ArrowDownRight,
  Copy, Check, Globe, UserPlus, Plus,
} from "lucide-react"
import { KnowledgeCurationPanel } from "./kaas-admin-page"
import { TemplateEditorBody } from "@/app/template/edit/page"

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */
type AgentKnowledge = { topic: string; lastUpdated: string }

type Agent = {
  id: string
  name: string
  icon: string
  walletAddress: string
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
const DOMAIN_OPTIONS = [
  "AI Engineering", "LLM Frameworks", "Embeddings", "Agent Systems",
  "Fine-tuning", "Prompt Engineering", "Evaluation", "RAG Pipelines",
  "Semantic Search", "Multi-Agent",
]

const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-1", name: "Coding Assistant", icon: "🤖",
    walletAddress: "0x742d...F4a8", karmaTier: "Silver", karmaBalance: 1250,
    credits: 230, totalDeposited: 500, totalConsumed: 270,
    domainInterests: ["AI Engineering", "LLM Frameworks", "Embeddings"],
    apiKey: "ck_live_a1b2c3d4e5f6g7h8i9j0", registeredAt: "2026-04-10",
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
    apiKey: "ck_live_k9l8m7n6o5p4q3r2s1t0", registeredAt: "2026-04-12",
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
    apiKey: "ck_live_u1v2w3x4y5z6a7b8c9d0", registeredAt: "2026-04-13",
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

  const mcpCommand = `claude mcp add cherry-kaas /Users/soma/IdeaProjects/cherry-in-the-haystack/apps/api/start-mcp.sh --env KAAS_AGENT_API_KEY=${selected.apiKey} --env ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY`
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
            <button
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
                  <p className="text-[10px] text-[#6B727E] truncate">{a.domainInterests.join(", ")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-bold" style={{ color: TIER_COLOR[a.karmaTier] ?? "#9E97B3" }}>{a.karmaTier}</p>
                  <p className="text-[10px] text-[#6B727E]">{a.credits}cr</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected agent detail — 고정 하단 */}
      <div className="shrink-0 border-t border-[#E4E1EE] pt-3 mt-3 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Wallet</p>
          <div className="flex items-center gap-2">
            <Wallet size={13} className="text-[#7B5EA7]" />
            <span className="text-[12px] font-mono font-semibold text-[#1A1626]">{selected.walletAddress && selected.walletAddress.length > 12 ? `${selected.walletAddress.slice(0, 6)}...${selected.walletAddress.slice(-4)}` : selected.walletAddress || "—"}</span>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Karma Tier</p>
          <div className="flex items-center gap-2">
            <Shield size={13} style={{ color: TIER_COLOR[selected.karmaTier] }} />
            <span className="text-[13px] font-bold" style={{ color: TIER_COLOR[selected.karmaTier] }}>{selected.karmaTier}</span>
            <span className="text-[11px] text-[#6B727E]">{selected.karmaBalance.toLocaleString()} pts</span>
          </div>
        </div>


        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Domains</p>
          <div className="flex flex-wrap gap-1">
            {selected.domainInterests.map((d) => (
              <span key={d} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3EFFA] text-[#7B5EA7] border border-[#C7B8E8]">{d}</span>
            ))}
          </div>
        </div>

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
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1">Claude Code 연결</p>
          <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE] relative">
            <p className="text-[10px] font-mono text-[#1A1626] break-all leading-relaxed pr-6">{mcpCommand}</p>
            <button
              onClick={handleCmdCopy}
              className="absolute top-2 right-2 p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
              title="명령어 복사"
            >
              {cmdCopied ? <Check size={12} className="text-[#2D7A5E]" /> : <Copy size={12} className="text-[#6B727E]" />}
            </button>
          </div>
          <p className="text-[9px] text-[#9E97B3] mt-1">터미널에 붙여넣고 실행하세요</p>
          <div className="bg-[#F9F7F5] rounded-lg px-3 py-2 border border-[#E4E1EE] relative mt-1.5">
            <p className="text-[10px] font-mono text-[#9E97B3] pr-6">{removeCommand}</p>
            <button
              onClick={handleRemoveCopy}
              className="absolute top-2 right-2 p-0.5 hover:bg-white rounded cursor-pointer flex-shrink-0"
              title="연결 해제 명령어 복사"
            >
              {removeCopied ? <Check size={12} className="text-[#2D7A5E]" /> : <Copy size={12} className="text-[#6B727E]" />}
            </button>
          </div>
          <p className="text-[9px] text-[#9E97B3] mt-1">연결 해제 시 실행하세요</p>
        </div>

        <button
          onClick={() => { if (confirm(`"${selected.name}" 에이전트를 삭제할까요?`)) onDelete(selected.id) }}
          className="w-full text-[11px] text-[#999] hover:text-red-400 py-2 cursor-pointer transition-colors"
        >
          에이전트 삭제
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
  const [walletAddress, setWalletAddress] = useState("")
  const [walletConnected, setWalletConnected] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")
  const [registeredKey, setRegisteredKey] = useState("")
  const [copied, setCopied] = useState(false)

  const connectMetaMask = async () => {
    try {
      const eth = (window as any).ethereum
      if (!eth) { setError("MetaMask가 설치되어 있지 않습니다"); return }
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      if (accounts[0]) {
        setWalletAddress(accounts[0])
        setWalletConnected(true)
        setError("")
      }
    } catch {
      setError("MetaMask 연결 실패")
    }
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
        domain_interests: [],
      })
      const newAgent: Agent = {
        id: raw.id, name: raw.name, icon: "🤖",
        walletAddress: raw.wallet_address ?? walletAddress,
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
      setError(err.message || "등록 실패")
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
          <h3 className="text-[14px] font-bold text-[#2D7A5E]">등록 완료!</h3>
        </div>

        <div className="rounded-lg bg-[#EFF7F3] p-3 text-[12px] text-[#2D7A5E] space-y-1">
          <p className="font-semibold">다음 단계</p>
          <p className="text-[11px]">1. 크레딧 충전 (Deposit)</p>
          <p className="text-[11px]">2. 아래 설정을 MCP 클라이언트에 추가</p>
          <p className="text-[11px]">3. 에이전트가 지식 검색/구매 시작</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#D4854A] mb-1">MCP 설정 (복사)</p>
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
          <Key size={13} /> Claude Desktop 설정 다운로드
        </button>

        <button onClick={() => { setRegisteredKey(""); onCancel() }} className="w-full text-[12px] font-medium py-2 rounded-lg border border-[#E4E1EE] text-[#6B727E] hover:bg-[#FAFAFA] cursor-pointer">
          확인
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

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1.5">Agent Name</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Research Agent"
          className="w-full px-3 py-1.5 text-[12px] rounded-lg border border-[#E4E1EE] bg-[#FAFAFA] placeholder:text-[#9E97B3] focus:outline-none focus:border-[var(--cherry)]"
        />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B727E] mb-1.5">Connect Wallet</p>
        {walletConnected ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2D7A5E] bg-[#EFF7F3]">
            <Check size={14} className="text-[#2D7A5E]" />
            <span className="text-[11px] font-mono text-[#1A1626]">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        ) : (
          <button onClick={connectMetaMask} className="w-full text-[12px] font-semibold py-2 rounded-lg border border-[#D4854A] text-[#D4854A] hover:bg-[#FFF8F0] cursor-pointer flex items-center justify-center gap-2">
            <Wallet size={14} /> Connect MetaMask
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
        <UserPlus size={14} /> {registering ? "등록 중..." : "Register Agent"}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Deposit / Withdraw Buttons
═══════════════════════════════════════════════ */
function DepositWithdrawButtons({ agent, onDeposited, pendingAmount }: { agent: Agent; onDeposited: () => void; pendingAmount: number }) {
  const [showDeposit, setShowDeposit] = useState(false)
  const [amount, setAmount] = useState(100)
  const [depositing, setDepositing] = useState(false)
  const [result, setResult] = useState("")

  const handleDeposit = async () => {
    const key = agent.apiKey
    if (!key) { alert("API Key가 없습니다. 에이전트를 다시 등록해주세요."); return }
    if (amount <= 0) { alert("금액을 입력하세요"); return }
    setDepositing(true)
    setResult("")
    try {
      const { depositCredits } = await import("@/lib/api")
      const res = await depositCredits(key, amount)
      setResult(`충전 완료! 잔액: ${res.balance}cr`)
      setShowDeposit(false)
      onDeposited()
    } catch (err: any) {
      setResult(`충전 실패: ${err.message}`)
      alert(`충전 실패: ${err.message}`)
    } finally {
      setDepositing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {result && <p className={cn("text-[11px] px-3 py-1.5 rounded-lg", result.includes("완료") ? "text-[#2D7A5E] bg-[#EFF7F3]" : "text-red-500 bg-red-50")}>{result}</p>}
      {showDeposit && (
        <div className="flex items-center gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={1} className="w-24 px-2 py-1 text-[12px] rounded-lg border border-[#E4E1EE] outline-none focus:border-[#D4854A]" />
          <span className="text-[11px] text-[#6B727E]">cr</span>
          <button onClick={handleDeposit} disabled={depositing} className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-[#D4854A] text-white hover:opacity-90 disabled:opacity-50">{depositing ? "..." : "충전"}</button>
          <button onClick={() => setShowDeposit(false)} className="text-[11px] text-[#6B727E] hover:text-[#1A1626]">취소</button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowDeposit(!showDeposit)} className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border border-[#D4854A] text-[#D4854A] hover:bg-[#FDF6EE] cursor-pointer flex items-center gap-1.5">
          <Wallet size={13} /> Deposit
        </button>
        <span className="text-[10px] text-[#6B727E] ml-auto">Gasless on Status Network</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Right Panel — Wallet & Rewards
═══════════════════════════════════════════════ */
function WalletPanel({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<"queries" | "ledger" | "rewards">("queries")
  const [queries, setQueries] = useState<any[]>([])
  const [rewardData, setRewardData] = useState<{ pending: number; withdrawn: number; total: number; rewards: any[] }>({ pending: 0, withdrawn: 0, total: 0, rewards: [] })

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
    import("@/lib/api").then(({ fetchAllRewards }) =>
      fetchAllRewards().then((data: any[]) => {
        // 에이전트 이름으로 필터링하거나 전체 합계 표시
        const total = data.reduce((s: number, r: any) => s + (r.total ?? 0), 0)
        const pending = data.reduce((s: number, r: any) => s + (r.pending ?? 0), 0)
        // 전체 rewards 상세는 개별 큐레이터 조회
        import("@/lib/api").then(({ fetchCuratorRewards }) => {
          // 첫 번째 큐레이터 이름으로 시도 (임시)
          if (data.length > 0) {
            fetchCuratorRewards(data[0].curator_name).then((d: any) => {
              setRewardData({ pending, withdrawn: total - pending, total, rewards: d.rewards ?? [] })
            }).catch(() => setRewardData({ pending, withdrawn: total - pending, total, rewards: [] }))
          } else {
            setRewardData({ pending: 0, withdrawn: 0, total: 0, rewards: [] })
          }
        })
      }).catch(() => {})
    )
  }

  useEffect(() => {
    loadHistory()
    loadRewards()
    window.addEventListener("kaas-agents-changed", loadHistory)
    return () => window.removeEventListener("kaas-agents-changed", loadHistory)
  }, [agent.apiKey, agent.name])

  const totalEarned = rewardData.total
  const pendingAmount = rewardData.pending

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[15px] font-bold text-[#1A1626]">Wallet & Rewards</h3>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
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
      </div>

      {/* Buttons */}
      <DepositWithdrawButtons agent={agent} onDeposited={onRefresh} pendingAmount={pendingAmount} />

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
                const explorerUrl = hash ? `https://sepoliascan.status.network/tx/${hash}` : ""
                const onChainFailed = chain === "failed" || !hash
                return (
                  <div key={q.id} className="flex items-center gap-3 py-2.5 border-b border-[#F2F0F7] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1A1626] font-semibold truncate">{conceptId}</p>
                      <p className="text-[10px] text-[#6B727E] mt-0.5">{actionType} · {relDate(time)}</p>
                    </div>
                    <span className="text-[11px] text-[#D4854A] font-bold">{credits}cr</span>
                    {onChainFailed ? (
                      <span className="text-[#D4854A] text-[10px] flex-shrink-0" title="On-chain 기록 실패">⚠ on-chain 실패</span>
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
          <div className="text-center py-8 text-[12px] text-[#9E97B3]">
            {agent.totalDeposited > 0
              ? `${agent.totalDeposited}cr deposited · ${agent.totalConsumed}cr consumed`
              : "No transactions yet. Deposit credits to start."}
          </div>
        )}

        {activeTab === "rewards" && (
          <div>
            {rewardData.rewards.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-[#9E97B3]">보상 내역이 없습니다.</div>
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
                      title={txHash}
                    >
                      {txHash.slice(0, 10)}...<ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#D4854A] flex-shrink-0" title="On-chain 기록 실패 또는 처리 중">⚠ on-chain 실패</span>
                  )}
                  {r.withdrawn
                    ? <span className="text-[10px] text-[#6B727E]">Withdrawn</span>
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
export function KaasDashboardPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [showRegister, setShowRegister] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "curation" | "template">("dashboard")

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
          return {
            id: a.id, name: a.name, icon: a.icon ?? "🤖",
            walletAddress: a.wallet_address ?? a.walletAddress ?? "",
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
    { key: "dashboard" as const, label: "대시보드" },
    ...(isAdmin ? [
      { key: "curation" as const, label: "지식 큐레이팅" },
      { key: "template" as const, label: "프롬프트 템플릿" },
    ] : []),
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header + Tabs */}
      <div className="shrink-0 border-b border-[#E4E1EE] bg-white px-4 lg:px-6 pt-4 lg:pt-5 pb-0">
        <h2 className="text-[16px] lg:text-[18px] font-extrabold text-[#1A1626] mb-2 lg:mb-3" style={{ letterSpacing: "-0.3px" }}>
          Dashboard
        </h2>
        {tabs.length > 1 && (
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
        )}
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
                      setAgents((prev) => [...prev, newAgent])
                      setSelectedAgentId(newAgent.id)
                      setShowRegister(false)
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
                {selectedAgent ? <WalletPanel agent={selectedAgent} onRefresh={loadAgents} /> : (
                  <div className="flex items-center justify-center h-full text-[13px] text-[#999]">에이전트를 등록하세요</div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === "curation" && (
          <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAFAFA]">
            <KnowledgeCurationPanel />
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
